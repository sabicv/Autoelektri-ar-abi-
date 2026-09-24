'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { formatEuroHR } from '@/lib/format';

interface CostEditorProps {
  jobId: string;
  tenantId: string;
  initialLaborCost: number;
  initialPartsCost: number;
  onSaved?: (laborCost: number, partsCost: number) => void;
}

function parseEuro(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function CostEditor({ jobId, tenantId, initialLaborCost, initialPartsCost, onSaved }: CostEditorProps) {
  const [laborInput, setLaborInput] = useState(initialLaborCost ? String(initialLaborCost) : '');
  const [partsInput, setPartsInput] = useState(initialPartsCost ? String(initialPartsCost) : '');
  const [isSaving, setIsSaving] = useState(false);

  const laborCost = parseEuro(laborInput);
  const partsCost = parseEuro(partsInput);

  async function handleSave() {
    setIsSaving(true);
    const supabase = createBrowserSupabaseClient();

    const { error } = await supabase
      .from('jobs')
      .update({ total_labor_cost: laborCost, total_parts_cost: partsCost })
      .eq('id', jobId);

    if (error) {
      setIsSaving(false);
      toast.error('Spremanje cijene nije uspjelo.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: tenantId,
      job_id: jobId,
      event_type: 'COST_UPDATED',
      actor: 'mechanic',
      message: `Cijena ažurirana — rad: ${formatEuroHR(laborCost)}, dijelovi: ${formatEuroHR(partsCost)}.`,
      metadata: { laborCost, partsCost },
    });

    setIsSaving(false);
    toast.success('Cijena spremljena.');
    onSaved?.(laborCost, partsCost);
  }

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
            placeholder="0,00"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
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
            placeholder="0,00"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ukupno: <span className="font-bold text-slate-900 dark:text-slate-100">{formatEuroHR(laborCost + partsCost)}</span>
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="press-effect flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />}
          Spremi
        </button>
      </div>
    </div>
  );
}
