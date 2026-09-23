import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Car, Phone, User } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { vehicleLabel } from '@/lib/format';
import Card from '@/components/ui/Card';
import VehicleHistoryTimeline from '@/components/dashboard/VehicleHistoryTimeline';
import type { DiagnosticReport } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ vehicleId: string }>;
}

export default async function VehiclePassportPage({ params }: PageProps) {
  const { vehicleId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', vehicleId).maybeSingle();
  if (!vehicle) notFound();

  const { data: client } = await supabase.from('clients').select('*').eq('id', vehicle.client_id).maybeSingle();

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  const jobList = jobs ?? [];
  const jobIds = jobList.map((j) => j.id);

  const { data: reports } =
    jobIds.length > 0
      ? await supabase.from('diagnostic_reports').select('*').in('job_id', jobIds)
      : { data: [] as DiagnosticReport[] };

  const reportsByJobId = new Map<string, DiagnosticReport[]>();
  for (const report of reports ?? []) {
    const existing = reportsByJobId.get(report.job_id) ?? [];
    existing.push(report);
    reportsByJobId.set(report.job_id, existing);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Natrag na pretragu
      </Link>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-electric-blue/10">
            <Car className="h-7 w-7 text-blue-600 dark:text-electric-blue" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{vehicleLabel(vehicle)}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
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
        Povijest naloga ({jobList.length})
      </h2>

      <VehicleHistoryTimeline jobs={jobList} reportsByJobId={reportsByJobId} />
    </div>
  );
}
