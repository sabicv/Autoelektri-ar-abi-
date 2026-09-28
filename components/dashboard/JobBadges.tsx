import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { PAYMENT_STATUS_LABELS_HR } from '@/lib/format';
import type { JobStatus, PaymentStatus } from '@/types/database';

// One functional palette across the app: blue = being worked on,
// amber = waiting (parts, payment), green = ready, grey = new or closed.
// Red is reserved for HITNO and "Trebam pomoć".
export const JOB_STATUS_BADGE_VARIANT: Record<JobStatus, BadgeVariant> = {
  PENDING_TRIAGE: 'neutral',
  IN_DIAGNOSTIC: 'diagnostic',
  PARASITIC_DRAIN_TESTING: 'diagnostic',
  AWAITING_MODULE_REMAP: 'diagnostic',
  IN_REPAIR: 'diagnostic',
  WAITING_PARTS: 'progress',
  FINISHED_AWAITING_PICKUP: 'collected',
  COLLECTED: 'neutral',
};

export const JOB_STATUS_BORDER_CLASS: Record<JobStatus, string> = {
  PENDING_TRIAGE: 'border-l-slate-300 dark:border-l-slate-600',
  IN_DIAGNOSTIC: 'border-l-sky-500 dark:border-l-electric-blue',
  PARASITIC_DRAIN_TESTING: 'border-l-sky-500 dark:border-l-electric-blue',
  AWAITING_MODULE_REMAP: 'border-l-sky-500 dark:border-l-electric-blue',
  IN_REPAIR: 'border-l-sky-500 dark:border-l-electric-blue',
  WAITING_PARTS: 'border-l-amber-400',
  FINISHED_AWAITING_PICKUP: 'border-l-emerald-500',
  COLLECTED: 'border-l-slate-200 dark:border-l-workshop-border',
};

export function PaymentChip({ status }: { status: PaymentStatus }) {
  return <Badge variant={status === 'PAID' ? 'collected' : 'progress'}>{PAYMENT_STATUS_LABELS_HR[status]}</Badge>;
}
