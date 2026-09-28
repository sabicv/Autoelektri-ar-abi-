import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Car, Phone, User } from 'lucide-react';
import { getSessionProfile } from '@/lib/session';
import { isPdfPath, vehicleLabel } from '@/lib/format';
import { redactJobForRole } from '@/lib/finance';
import Card from '@/components/ui/Card';
import VehicleHistoryTimeline, { type TimelinePhoto } from '@/components/dashboard/VehicleHistoryTimeline';
import type { DiagnosticReport, JobPhoto } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ vehicleId: string }>;
}

export default async function VehiclePassportPage({ params }: PageProps) {
  const { vehicleId } = await params;
  const { supabase, profile } = await getSessionProfile();
  const isOwner = profile.role === 'owner';

  const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', vehicleId).maybeSingle();
  if (!vehicle) notFound();

  const { data: client } = await supabase.from('clients').select('*').eq('id', vehicle.client_id).maybeSingle();

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  const jobList = (jobs ?? []).map((j) => redactJobForRole(j, profile.role));
  const jobIds = jobList.map((j) => j.id);

  const [{ data: reports }, { data: photoRows }, { data: messageRows }] =
    jobIds.length > 0
      ? await Promise.all([
          supabase.from('diagnostic_reports').select('*').in('job_id', jobIds),
          supabase.from('job_photos').select('*').in('job_id', jobIds),
          supabase.from('mechanic_tasks').select('job_id').in('job_id', jobIds),
        ])
      : [{ data: [] as DiagnosticReport[] }, { data: [] as JobPhoto[] }, { data: [] as { job_id: string | null }[] }];

  const messageCounts: Record<string, number> = {};
  for (const m of messageRows ?? []) if (m.job_id) messageCounts[m.job_id] = (messageCounts[m.job_id] ?? 0) + 1;

  const reportsByJobId = new Map<string, DiagnosticReport[]>();
  for (const report of reports ?? []) {
    const existing = reportsByJobId.get(report.job_id) ?? [];
    existing.push(report);
    reportsByJobId.set(report.job_id, existing);
  }

  // One batch of signed URLs for the whole vehicle instead of one request per job.
  const rows = photoRows ?? [];
  const { data: signed } =
    rows.length > 0
      ? await supabase.storage.from('job-vault').createSignedUrls(
          rows.map((p) => p.photo_url),
          3600
        )
      : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const captured = (p: JobPhoto) => p.taken_at ?? p.created_at;

  const photosByJobId: Record<string, TimelinePhoto[]> = {};
  for (const p of [...rows].sort((a, b) => captured(b).localeCompare(captured(a)))) {
    (photosByJobId[p.job_id] ??= []).push({
      id: p.id,
      path: p.photo_url,
      url: urlByPath.get(p.photo_url) ?? '',
      tag: p.tag,
      caption: p.caption,
      createdAt: p.created_at,
      takenAt: p.taken_at,
      gpsLat: p.gps_lat,
      gpsLng: p.gps_lng,
      isPdf: isPdfPath(p.photo_url),
    });
  }

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/clients"
        className="inline-flex min-h-[48px] items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Natrag na klijente
      </Link>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-workshop-surface-hover">
            <Car className="h-7 w-7 text-slate-500 dark:text-slate-300" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{vehicleLabel(vehicle)}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-300">
              {vehicle.year && <span>Godina: {vehicle.year}</span>}
              {vehicle.vin && <span>VIN: {vehicle.vin}</span>}
            </div>
          </div>
        </div>

        {client && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm dark:border-workshop-border">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <User className="h-4 w-4 text-slate-400" strokeWidth={2} />
              {client.first_name} {client.last_name}
            </span>
            <a
              href={`tel:${client.phone_number}`}
              className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-electric-blue"
            >
              <Phone className="h-4 w-4" strokeWidth={2} />
              {client.phone_number}
            </a>
          </div>
        )}
      </Card>

      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
        Povijest vozila ({jobList.length})
      </h2>

      <VehicleHistoryTimeline
        jobs={jobList}
        reportsByJobId={reportsByJobId}
        photosByJobId={photosByJobId}
        messageCounts={messageCounts}
        showCosts={isOwner}
      />
    </div>
  );
}
