'use client';

// Asks the server to render the job's work order PDF and file it in the
// job's archive. Returns false on failure; callers decide how loudly to say so.
export async function archiveWorkOrder(jobId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/jobs/${jobId}/document`, { method: 'POST' });
    return response.ok;
  } catch {
    return false;
  }
}
