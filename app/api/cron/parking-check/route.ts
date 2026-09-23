import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =====================================================================
// Daily parking duration check. Configured in vercel.json to run once a
// day; Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}`
// on cron-triggered requests when CRON_SECRET is set as a project env
// var, which is what we check below.
//
// This used to accrue a monetary penalty (accrued_parking_fees) — the
// platform no longer does aggressive fee enforcement. It now only leaves
// a passive, informational note on the job's timeline ("vehicle has been
// sitting N days"), with no fee, no alarm, no auto-sent client message.
// =====================================================================

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: pending, error } = await admin.rpc('recalculate_parking_fees');

  if (error) {
    console.error('recalculate_parking_fees failed', error);
    return NextResponse.json({ error: 'Cron job failed.' }, { status: 500 });
  }

  const rows = pending ?? [];

  for (const row of rows) {
    const { error: eventError } = await admin.from('job_events').insert({
      tenant_id: row.tenant_id,
      job_id: row.job_id,
      event_type: 'PARKING_DURATION_LOGGED',
      actor: 'system',
      message: `Vozilo je na parkingu ${row.days_parked} ${row.days_parked === 1 ? 'dan' : 'dana'}.`,
      metadata: { daysParked: row.days_parked },
    });
    if (eventError) {
      console.error('Failed to log PARKING_DURATION_LOGGED event', row, eventError);
    }
  }

  return NextResponse.json({
    processedAt: new Date().toISOString(),
    vehiclesLoggedCount: rows.length,
    jobs: rows,
  });
}
