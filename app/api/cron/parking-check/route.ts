import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatEuroHR } from '@/lib/format';

// =====================================================================
// Daily parking bottleneck cron. Configured in vercel.json to run once a
// day; Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}`
// on cron-triggered requests when CRON_SECRET is set as a project env
// var, which is what we check below.
//
// This mutates billing-affecting data (accrued_parking_fees), so unlike
// the Vapi webhook it fails CLOSED: if CRON_SECRET isn't configured at
// all, every request is rejected rather than allowed through.
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

  const { data: updated, error } = await admin.rpc('recalculate_parking_fees');

  if (error) {
    console.error('recalculate_parking_fees failed', error);
    return NextResponse.json({ error: 'Cron job failed.' }, { status: 500 });
  }

  const rows = updated ?? [];

  // "Draft parking warning alert" — a reviewable timeline entry per job,
  // not an auto-sent WhatsApp message. A mechanic decides whether/when to
  // actually notify the client via NotificationDraftModal (PARKING_WARNING).
  for (const row of rows) {
    const { error: eventError } = await admin.from('job_events').insert({
      tenant_id: row.tenant_id,
      job_id: row.job_id,
      event_type: 'PARKING_FEE_UPDATED',
      actor: 'system',
      message: `Vozilo parkirano ${row.days_parked} dana. Obračunata ležarina: ${formatEuroHR(row.accrued_fee)}. Potreban pregled od strane radionice.`,
      metadata: { daysParked: row.days_parked, accruedFee: row.accrued_fee },
    });
    if (eventError) {
      console.error('Failed to log PARKING_FEE_UPDATED event', row, eventError);
    }
  }

  return NextResponse.json({
    processedAt: new Date().toISOString(),
    flaggedJobs: rows.length,
    jobs: rows,
  });
}
