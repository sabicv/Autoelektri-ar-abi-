'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { formatEuroHR } from '@/lib/format';
import type { SectionHandle } from './sectionHandle';

interface CostEditorProps {
  jobId: string;
  tenantId: string;
  initialLaborCost: number;
  initialPartsCost: number;
  locked?: boolean;
  onSaved?: (laborCost: number, partsCost: number) => void;
}

function parseEuro(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100';

const CostEditor = forwardRef<SectionHandle, CostEditorProps>(function CostEditor(
  { jobId, tenantId, initialLaborCost, initialPartsCost, locked = false, onSaved },
  ref
) {
  const [laborInput, setLaborInput] = useState(initialLaborCost ? String(initialLaborCost) : '');
  const [partsInput, setPartsInput] = useState(initialPartsCost ? String(initialPartsCost) : '');
  const savedRef = useRef({ labor: initialLaborCost, parts: initialPartsCost });

  const laborCost = parseEuro(laborInput);
  const partsCost = parseEuro(partsInput);

  useImperativeHandle(ref, () => ({
    isDirty: () => laborCost !== savedRef.current.labor || partsCost !== savedRef.current.parts,
    save: async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from('jobs')
        .update({ total_labor_cost: laborCost, total_parts_cost: partsCost })
        .eq('id', jobId);

      if (error) {
        toast.error('Spremanje cijene nije uspjelo.');
        return false;
      }

      await supabase.from('job_events').insert({
        tenant_id: tenantId,
        job_id: jobId,
        event_type: 'COST_UPDATED',
        actor: 'mechanic',
        message: `Cijena ažurirana — rad: ${formatEuroHR(laborCost)}, dijelovi: ${formatEuroHR(partsCost)}.`,
        metadata: { laborCost, partsCost },
      });

      savedRef.current = { labor: laborCost, parts: partsCost };
      onSaved?.(laborCost, partsCost);
      return true;
    },
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`labor-${jobId}`} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Rad (€)
          </label>
          <input
            id={`labor-${jobId}`}
            type="text"
            inputMode="decimal"
            value={laborInput}
            onChange={(e) => setLaborInput(e.target.value.replace(/[^0-9,.-]/g, ''))}
            disabled={locked}
            placeholder="0,00"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`parts-${jobId}`} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Dijelovi (€)
          </label>
          <input
            id={`parts-${jobId}`}
            type="text"
            inputMode="decimal"
            value={partsInput}
            onChange={(e) => setPartsInput(e.target.value.replace(/[^0-9,.-]/g, ''))}
            disabled={locked}
            placeholder="0,00"
            className={inputClass}
          />
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Ukupno: <span className="font-bold text-slate-900 dark:text-slate-100">{formatEuroHR(laborCost + partsCost)}</span>
      </p>
    </div>
  );
});

export default CostEditor;
