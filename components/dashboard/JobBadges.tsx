import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { PAYMENT_STATUS_LABELS_HR } from '@/lib/format';
import type { JobStatus, PaymentStatus } from '@/types/database';

export const JOB_STATUS_BADGE_VARIANT: Record<JobStatus, BadgeVariant> = {
  PENDING_TRIAGE: 'neutral',
  IN_DIAGNOSTIC: 'diagnostic',
  PARASITIC_DRAIN_TESTING: 'diagnostic',
  AWAITING_MODULE_REMAP: 'diagnostic',
  IN_REPAIR: 'progress',
  FINISHED_AWAITING_PICKUP: 'collected',
  COLLECTED: 'collected',
};

export function PaymentChip({ status }: { status: PaymentStatus }) {
  return <Badge variant={status === 'PAID' ? 'collected' : 'progress'}>{PAYMENT_STATUS_LABELS_HR[status]}</Badge>;
}
