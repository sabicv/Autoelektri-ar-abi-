import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSessionProfile } from '@/lib/session';
import { redactJobForRole } from '@/lib/finance';
import { ClientDetailsCard, VehicleCard } from '@/components/dashboard/ClientProfile';
import { JobList } from '@/components/dashboard/archive/ArchiveJobsTab';
import { EmptyState } from '@/components/dashboard/archive/shared';
import type { Client } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientPage({ params }: PageProps) {
  const { clientId } = await params;
  const { supabase, profile } = await getSessionProfile();

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) notFound();

  const [{ data: vehicles }, { data: jobs }] = await Promise.all([
    supabase.from('vehicles').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
    supabase.from('jobs').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
  ]);

  const vehicleList = vehicles ?? [];
  const jobList = (jobs ?? []).map((j) => redactJobForRole(j, profile.role));

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/clients"
        className="inline-flex min-h-[48px] items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Klijenti
      </Link>

      <ClientDetailsCard client={client} />

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Vozila ({vehicleList.length})</h2>
        {vehicleList.length === 0 ? (
          <EmptyState>Klijent nema upisanih vozila.</EmptyState>
        ) : (
          vehicleList.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Nalozi ({jobList.length})</h2>
        {jobList.length === 0 ? (
          <EmptyState>Još nema naloga za ovog klijenta.</EmptyState>
        ) : (
          // No clients map: every row is this client, so the subtitle is just the date.
          <JobList
            jobs={jobList}
            vehicles={new Map(vehicleList.map((v) => [v.id, v]))}
            clients={new Map<string, Client>()}
          />
        )}
      </section>
    </div>
  );
}
