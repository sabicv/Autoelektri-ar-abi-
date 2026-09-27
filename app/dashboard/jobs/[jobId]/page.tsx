import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/session';
import { redactEventsForRole, redactJobForRole } from '@/lib/finance';
import JobDetailView from '@/components/dashboard/JobDetailView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { jobId } = await params;
  const { supabase, profile } = await getSessionProfile();

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) notFound();

  const [{ data: client }, { data: vehicle }, { data: events }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', job.client_id).maybeSingle(),
    supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
    supabase.from('job_events').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
  ]);

  if (!client || !vehicle) notFound();

  return (
    <JobDetailView
      job={redactJobForRole(job, profile.role)}
      client={client}
      vehicle={vehicle}
      events={redactEventsForRole(events ?? [], profile.role)}
      viewerRole={profile.role}
    />
  );
}
