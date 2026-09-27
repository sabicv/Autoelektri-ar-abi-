import type { Job, JobEvent, StaffRole } from '@/types/database';

type JobMoney = Pick<Job, 'total_labor_cost' | 'total_parts_cost' | 'accrued_parking_fees'>;

export function jobTotal(job: JobMoney): number {
  return job.total_labor_cost + job.total_parts_cost + job.accrued_parking_fees;
}

// Mechanics see jobs but not money. RLS is row-level only, so pages strip
// these before anything reaches the browser (writes are blocked separately
// by a DB trigger). Zeroed rather than removed to keep the Job type intact.
export function redactJobForRole<T extends Job>(job: T, role: StaffRole): T {
  if (role === 'owner') return job;
  return {
    ...job,
    total_labor_cost: 0,
    total_parts_cost: 0,
    accrued_parking_fees: 0,
    payment_status: 'UNPAID',
    paid_at: null,
  };
}

const FINANCIAL_EVENT_TYPES = new Set([
  'COST_UPDATED',
  'PAYMENT_STATUS_CHANGED',
  'UPSELL_REQUESTED',
  'UPSELL_APPROVED',
  'UPSELL_REJECTED',
]);

export function redactEventsForRole(events: JobEvent[], role: StaffRole): JobEvent[] {
  if (role === 'owner') return events;
  return events
    .filter((e) => !FINANCIAL_EVENT_TYPES.has(e.event_type) && !e.message?.includes('€'))
    .map((e) => ({ ...e, metadata: {} }));
}
