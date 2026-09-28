import { notFound } from 'next/navigation';
import { getSessionProfile } from '@/lib/session';
import { redactEventsForRole, redactJobForRole } from '@/lib/finance';
import { jobBackLink } from '@/lib/jobLifecycle';
import JobDetailView from '@/components/dashboard/JobDetailView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ poruke?: string; from?: string }>;
}

export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const { jobId } = await params;
  const { poruke, from } = await searchParams;
  const { supabase, user, profile } = await getSessionProfile();

  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) notFound();

  const [{ data: client }, { data: vehicle }, { data: events }, { data: staff }, { data: messages }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', job.client_id).maybeSingle(),
    supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle(),
    supabase.from('job_events').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('created_at'),
    supabase.from('mechanic_tasks').select('*').eq('job_id', jobId).order('created_at'),
  ]);

  if (!client || !vehicle) notFound();

  const staffList = (staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? 'Djelatnik' }));

  return (
    <JobDetailView
      job={redactJobForRole(job, profile.role)}
      client={client}
      vehicle={vehicle}
      events={redactEventsForRole(events ?? [], profile.role)}
      viewerRole={profile.role}
      currentUserId={user.id}
      staff={staffList.filter((s) => s.id !== user.id)}
      staffNames={Object.fromEntries(staffList.map((s) => [s.id, s.name]))}
      messages={messages ?? []}
      openMessages={poruke === '1'}
      back={jobBackLink(from)}
    />
  );
}
