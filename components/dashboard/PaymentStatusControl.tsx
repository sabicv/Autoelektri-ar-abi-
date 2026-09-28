'use client';

import { useState } from 'react';
import { CheckCircle2, CircleDashed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { PAYMENT_STATUS_LABELS_HR } from '@/lib/format';
import { archiveWorkOrder } from '@/lib/archiveWorkOrder';
import { isClosedJob } from '@/lib/jobLifecycle';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/database';

type PaymentPatch = Pick<Job, 'payment_status' | 'paid_at'> & Partial<Pick<Job, 'confirmed_at'>>;

interface PaymentStatusControlProps {
  job: Pick<Job, 'id' | 'tenant_id' | 'status' | 'payment_status' | 'paid_at' | 'confirmed_at'>;
  onChanged: (patch: PaymentPatch) => void;
  onArchived?: () => void;
}

// One switch, both directions: amber "Za naplatu" ⇄ green "Plaćeno".
export default function PaymentStatusControl({ job, onChanged, onArchived }: PaymentStatusControlProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isPaid = job.payment_status === 'PAID';

  async function toggle() {
    // Taking a payment back means the bill is being corrected, so a locked
    // job reopens with it — otherwise labour and parts couldn't be edited.
    const reopen = isPaid && job.confirmed_at !== null;
    const patch: PaymentPatch = isPaid
      ? { payment_status: 'UNPAID', paid_at: null, ...(reopen ? { confirmed_at: null } : {}) }
      : { payment_status: 'PAID', paid_at: new Date().toISOString() };

    setIsSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.from('jobs').update(patch).eq('id', job.id).select('id');

    if (error || !data?.length) {
      setIsSaving(false);
      toast.error('Promjena plaćanja nije uspjela.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: job.tenant_id,
      job_id: job.id,
      event_type: 'PAYMENT_STATUS_CHANGED',
      actor: 'mechanic',
      message: isPaid
        ? `Nalog vraćen na „Za naplatu“${reopen ? ' i otključan za ispravke' : ''}.`
        : 'Nalog označen kao plaćen.',
      metadata: { to: patch.payment_status, reopened: reopen },
    });

    setIsSaving(false);
    onChanged(patch);
    if (isPaid) {
      toast.success(reopen ? 'Vraćeno na „Za naplatu“ — nalog je otključan za ispravke.' : 'Vraćeno na „Za naplatu“.');
      return;
    }
    // A paid job gets its final PDF (with "PLAĆENO") filed automatically.
    const archived = await archiveWorkOrder(job.id);
    const closed = isClosedJob({ status: job.status, payment_status: 'PAID' });
    toast.success(
      closed
        ? 'Plaćeno — nalog je zatvoren i premješten u Arhivu.'
        : archived
          ? 'Plaćeno — račun spremljen u arhivu.'
          : 'Označeno kao plaćeno.'
    );
    if (archived) onArchived?.();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPaid}
      onClick={toggle}
      disabled={isSaving}
      className={cn(
        'press-effect flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border-2 px-4 text-left disabled:opacity-70',
        isPaid
          ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-500/10'
          : 'border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10'
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {isSaving ? (
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-slate-500" />
        ) : isPaid ? (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
        ) : (
          <CircleDashed className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
        )}
        <span
          className={cn(
            'text-base font-bold',
            isPaid ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
          )}
        >
          {PAYMENT_STATUS_LABELS_HR[job.payment_status]}
        </span>
        {isPaid && job.paid_at && (
          <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
            {new Date(job.paid_at).toLocaleDateString('hr-HR')}
          </span>
        )}
      </span>
      <span
        className={cn(
          'relative h-8 w-14 flex-shrink-0 rounded-full transition-colors',
          isPaid ? 'bg-emerald-500' : 'bg-amber-400'
        )}
      >
        <span
          className={cn(
            'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform',
            isPaid ? 'translate-x-7' : 'translate-x-1'
          )}
        />
      </span>
    </button>
  );
}
