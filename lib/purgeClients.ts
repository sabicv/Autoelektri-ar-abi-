import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

// Removes clients with everything that hangs off them: vehicles, jobs,
// diagnostics, events (all by FK cascade), plus what the cascade can't
// reach — internal messages (their job_id would only be set to null and
// they'd resurface as loose tasks) and the files in each job's storage
// folder (photos, thumbnails, PDFs, help-request photos).
export async function purgeClients(admin: AdminClient, tenantId: string, clientIds: string[]) {
  if (clientIds.length === 0) return { clients: 0, jobs: 0, files: 0 };

  const { data: jobs } = await admin
    .from('jobs')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('client_id', clientIds);
  const jobIds = (jobs ?? []).map((j) => j.id);

  let files = 0;
  if (jobIds.length > 0) {
    await admin.from('mechanic_tasks').delete().eq('tenant_id', tenantId).in('job_id', jobIds);

    const bucket = admin.storage.from('job-vault');
    for (const jobId of jobIds) {
      const folder = `${tenantId}/${jobId}`;
      const { data: objects } = await bucket.list(folder, { limit: 1000 });
      const paths = (objects ?? []).map((o) => `${folder}/${o.name}`);
      for (let i = 0; i < paths.length; i += 100) {
        await bucket.remove(paths.slice(i, i + 100));
      }
      files += paths.length;
    }
  }

  const { error } = await admin.from('clients').delete().eq('tenant_id', tenantId).in('id', clientIds);
  if (error) throw error;

  return { clients: clientIds.length, jobs: jobIds.length, files };
}
