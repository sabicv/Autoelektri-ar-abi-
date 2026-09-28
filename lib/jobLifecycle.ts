import type { Job } from '@/types/database';

// A job leaves Poslovi for Arhiva once nothing is left to do in the
// workshop: the car has been collected, or the work is finished and paid.
// Its messages, photos and documents stay attached to it either way.
export function isClosedJob(job: Pick<Job, 'status' | 'payment_status'>) {
  return job.status === 'COLLECTED' || (job.status === 'FINISHED_AWAITING_PICKUP' && job.payment_status === 'PAID');
}

// The same rule as PostgREST filters, so lists are cut on the server.
// Closed: .or(CLOSED_JOBS_FILTER)
export const CLOSED_JOBS_FILTER = 'status.eq.COLLECTED,and(status.eq.FINISHED_AWAITING_PICKUP,payment_status.eq.PAID)';
// Open: .neq('status', 'COLLECTED').or(OPEN_JOBS_FILTER)
export const OPEN_JOBS_FILTER = 'status.neq.FINISHED_AWAITING_PICKUP,payment_status.neq.PAID';

// Where "Natrag" on a job leads, carried as ?from= by the list that opened it.
export function jobBackLink(from: string | undefined): { href: string; label: string } {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (from === 'arhiva') return { href: '/dashboard/archive', label: 'Natrag na arhivu' };
  if (from === 'poslovanje') return { href: '/dashboard/analytics', label: 'Natrag na poslovanje' };
  if (from?.startsWith('musterija:') && uuid.test(from.slice(10))) {
    return { href: `/dashboard/clients/${from.slice(10)}`, label: 'Natrag na mušteriju' };
  }
  if (from?.startsWith('vozilo:') && uuid.test(from.slice(7))) {
    return { href: `/dashboard/vehicles/${from.slice(7)}`, label: 'Natrag na vozilo' };
  }
  return { href: '/dashboard/jobs', label: 'Natrag na poslove' };
}
