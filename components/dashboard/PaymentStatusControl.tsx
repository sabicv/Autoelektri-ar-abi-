'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { PAYMENT_STATUS_LABELS_HR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/database';

interface PaymentStatusControlProps {
  job: Pick<Job, 'id' | 'tenant_id' | 'payment_status' | 'paid_at'>;
  onChanged: (patch: Pick<Job, 'payment_status' | 'paid_at'>) => void;
}

export default function PaymentStatusControl({ job, onChanged }: PaymentStatusControlProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isPaid = job.payment_status === 'PAID';

  async function toggle() {
    const patch: Pick<Job, 'payment_status' | 'paid_at'> = isPaid
      ? { payment_status: 'UNPAID', paid_at: null }
      : { payment_status: 'PAID', paid_at: new Date().toISOString() };

    setIsSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('jobs').update(patch).eq('id', job.id);

    if (error) {
      setIsSaving(false);
      toast.error('Promjena plaćanja nije uspjela.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: job.tenant_id,
      job_id: job.id,
      event_type: 'PAYMENT_STATUS_CHANGED',
      actor: 'mechanic',
      message: isPaid ? 'Nalog vraćen na neplaćeno.' : 'Nalog označen kao plaćen.',
      metadata: { to: patch.payment_status },
    });

    setIsSaving(false);
    onChanged(patch);
    toast.success(isPaid ? 'Vraćeno na neplaćeno.' : 'Označeno kao plaćeno.');
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-workshop-border">
      <div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-bold',
            isPaid
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
          )}
        >
          {PAYMENT_STATUS_LABELS_HR[job.payment_status]}
        </span>
        {isPaid && job.paid_at && (
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
            {new Date(job.paid_at).toLocaleDateString('hr-HR')}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isSaving}
        className={cn(
          'press-effect flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-60',
          isPaid
            ? 'border border-slate-300 text-slate-600 dark:border-workshop-border dark:text-slate-300'
            : 'bg-emerald-600 text-white'
        )}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPaid ? (
          <Undo2 className="h-4 w-4" strokeWidth={2} />
        ) : (
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
        )}
        {isPaid ? 'Vrati na neplaćeno' : 'Označi plaćeno'}
      </button>
    </div>
  );
}
