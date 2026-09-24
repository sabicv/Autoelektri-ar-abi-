import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import JobDetailView from '@/components/dashboard/JobDetailView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { jobId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) notFound();

  const [{ data: client }, { data: vehicle }, { data: events }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', job.client_id).maybeSingle(),
    supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
    supabase.from('job_events').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
  ]);

  if (!client || !vehicle) notFound();

  return <JobDetailView job={job} client={client} vehicle={vehicle} events={events ?? []} />;
}
