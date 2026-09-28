'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BatteryWarning, Mic, MicOff, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { searchDtcCodes } from '@/lib/dtc-codes';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { cn } from '@/lib/utils';
import Skeleton from '@/components/ui/Skeleton';
import type { SectionHandle } from './sectionHandle';
import { clearDraft, readDraft, writeDraft } from '@/lib/drafts';

interface DiagnosticDraft {
  codes: string[];
  drain: string;
  modules: string;
  notes: string;
}

interface DiagnosticWorkbenchProps {
  jobId: string;
  tenantId: string;
  initialDiagnosticNotes: string | null;
  locked?: boolean;
  onSaved?: (diagnosticNotes: string) => void;
}

const DiagnosticWorkbench = forwardRef<SectionHandle, DiagnosticWorkbenchProps>(function DiagnosticWorkbench(
  { jobId, tenantId, initialDiagnosticNotes, locked = false, onSaved },
  ref
) {
  const [isLoading, setIsLoading] = useState(true);
  const [dtcCodes, setDtcCodes] = useState<string[]>([]);
  const [dtcInput, setDtcInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [batteryDrainMa, setBatteryDrainMa] = useState('');
  const [moduleNotes, setModuleNotes] = useState('');
  const [diagnosticNotes, setDiagnosticNotes] = useState(initialDiagnosticNotes ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef('');
  const snapshot = (codes: string[], drain: string, modules: string, notes: string) =>
    JSON.stringify([codes, drain, modules, notes]);
  const draftKey = `draft:job:${jobId}:diagnostic`;

  useEffect(() => {
    if (isLoading) return;
    if (snapshot(dtcCodes, batteryDrainMa, moduleNotes, diagnosticNotes) === savedRef.current) clearDraft(draftKey);
    else writeDraft(draftKey, { codes: dtcCodes, drain: batteryDrainMa, modules: moduleNotes, notes: diagnosticNotes } satisfies DiagnosticDraft);
  }, [isLoading, dtcCodes, batteryDrainMa, moduleNotes, diagnosticNotes, draftKey]);

  const suggestions = useMemo(
    () => searchDtcCodes(dtcInput).filter((s) => !dtcCodes.includes(s.code)),
    [dtcInput, dtcCodes]
  );

  const handleDiagnosticNotesDictation = useCallback((final: string) => {
    setDiagnosticNotes((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
  }, []);

  const {
    isSupported: dictationSupported,
    isRecording: isDictatingNotes,
    interimText: notesInterimText,
    toggleRecording: toggleNotesDictation,
  } = useSpeechToText({ onFinalText: handleDiagnosticNotesDictation });

  useEffect(() => {
    let cancelled = false;

    async function loadLatestReport() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase
        .from('diagnostic_reports')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      const codes = data?.dtc_codes ?? [];
      const drain = data?.battery_drain_ma != null ? String(data.battery_drain_ma) : '';
      const modules = data?.module_notes ?? '';
      savedRef.current = snapshot(codes, drain, modules, initialDiagnosticNotes ?? '');

      // Unsaved input from a closed tab / lost signal wins over the saved report.
      const draft = locked ? null : readDraft<DiagnosticDraft>(draftKey);
      setDtcCodes(draft?.codes ?? codes);
      setBatteryDrainMa(draft?.drain ?? drain);
      setModuleNotes(draft?.modules ?? modules);
      if (draft) setDiagnosticNotes(draft.notes);
      setIsLoading(false);
    }

    loadLatestReport();
    return () => {
      cancelled = true;
    };
    // initialDiagnosticNotes only seeds the snapshot on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function addCode(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code || dtcCodes.includes(code)) return;
    setDtcCodes((prev) => [...prev, code]);
    setDtcInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeCode(code: string) {
    setDtcCodes((prev) => prev.filter((c) => c !== code));
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (suggestions.length > 0) {
        addCode(suggestions[0].code);
      } else if (dtcInput.trim()) {
        addCode(dtcInput);
      }
    }
  }

  useImperativeHandle(ref, () => ({
    isDirty: () => !isLoading && snapshot(dtcCodes, batteryDrainMa, moduleNotes, diagnosticNotes) !== savedRef.current,
    save: async () => {
      const supabase = createBrowserSupabaseClient();
      const parsedDrain = batteryDrainMa.trim() ? Number(batteryDrainMa.replace(',', '.')) : null;

      const { error: reportError } = await supabase.from('diagnostic_reports').insert({
        job_id: jobId,
        dtc_codes: dtcCodes,
        battery_drain_ma: Number.isFinite(parsedDrain) ? parsedDrain : null,
        module_notes: moduleNotes || null,
      });

      if (reportError) {
        toast.error('Spremanje dijagnostike nije uspjelo.');
        return false;
      }

      const { error: jobError } = await supabase
        .from('jobs')
        .update({ diagnostic_notes: diagnosticNotes || null })
        .eq('id', jobId);

      if (jobError) {
        toast.error('Dijagnostika je spremljena, ali napomene nisu.');
        return false;
      }

      await supabase.from('job_events').insert({
        tenant_id: tenantId,
        job_id: jobId,
        event_type: 'DIAGNOSTIC_REPORT_SAVED',
        actor: 'mechanic',
        message: dtcCodes.length > 0 ? `Dijagnostički nalaz spremljen: ${dtcCodes.join(', ')}.` : 'Dijagnostički nalaz spremljen.',
        metadata: { dtcCodes, batteryDrainMa: parsedDrain },
      });

      savedRef.current = snapshot(dtcCodes, batteryDrainMa, moduleNotes, diagnosticNotes);
      clearDraft(draftKey);
      onSaved?.(diagnosticNotes);
      return true;
    },
  }));

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <fieldset disabled={locked} className="space-y-4">
      {/* Battery drain — highlighted per spec, not buried among other fields */}
      <div className="flex items-center gap-3 rounded-xl border-2 border-electric-blue/30 bg-electric-blue/5 px-3 py-2.5 dark:border-electric-blue/40 dark:bg-electric-blue/10">
        <BatteryWarning className="h-5 w-5 flex-shrink-0 text-electric-blue" strokeWidth={2} />
        <div className="flex-1">
          <label htmlFor="batteryDrainMa" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Parazitsko pražnjenje (mA)
          </label>
          <input
            id="batteryDrainMa"
            type="text"
            inputMode="decimal"
            value={batteryDrainMa}
            onChange={(e) => setBatteryDrainMa(e.target.value.replace(/[^0-9,.-]/g, ''))}
            placeholder="—"
            className="mt-0.5 w-full bg-transparent text-lg font-bold text-slate-900 focus:outline-none dark:text-slate-100"
          />
        </div>
      </div>

      {/* DTC codes — searchable tag input */}
      <div>
        <label htmlFor="dtcInput" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          DTC kodovi kvara
        </label>

        {dtcCodes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {dtcCodes.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => removeCode(code)}
                aria-label={`Ukloni ${code}`}
                className="press-effect flex min-h-[48px] items-center gap-1.5 rounded-full bg-electric-blue/10 px-4 text-sm font-bold text-electric-blue hover:bg-electric-blue/20"
              >
                {code}
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover">
            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
            <input
              ref={inputRef}
              id="dtcInput"
              value={dtcInput}
              onChange={(e) => {
                setDtcInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={handleInputKeyDown}
              placeholder="Dodaj kod"
              className="w-full bg-transparent text-sm text-slate-900 focus:outline-none dark:text-slate-100"
            />
          </div>

          {showSuggestions && dtcInput && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-workshop-border dark:bg-workshop-surface">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addCode(s.code)}
                  className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-workshop-surface-hover"
                >
                  <span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{s.code}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-300">{s.description}</span>
                  </span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addCode(dtcInput)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-blue-600 hover:bg-slate-50 dark:border-workshop-border dark:text-electric-blue dark:hover:bg-workshop-surface-hover"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Dodaj &quot;{dtcInput.toUpperCase()}&quot; kao novi kod
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="moduleNotes" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Moduli / CAN-bus
        </label>
        <textarea
          id="moduleNotes"
          rows={2}
          value={moduleNotes}
          onChange={(e) => setModuleNotes(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="diagnosticNotes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nalaz dijagnostike
          </label>
          {dictationSupported && (
            <button
              type="button"
              onClick={toggleNotesDictation}
              className={cn(
                'press-effect flex min-h-[48px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
                isDictatingNotes
                  ? 'bg-alarm-red text-white'
                  : 'bg-blue-50 text-blue-600 dark:bg-electric-blue/10 dark:text-electric-blue'
              )}
            >
              {isDictatingNotes ? <MicOff className="h-4 w-4" strokeWidth={2} /> : <Mic className="h-4 w-4" strokeWidth={2} />}
              {isDictatingNotes ? 'Zaustavi' : 'Diktiraj'}
            </button>
          )}
        </div>
        {notesInterimText && <p className="mb-1 truncate text-xs italic text-slate-400">{notesInterimText}</p>}
        <textarea
          id="diagnosticNotes"
          rows={3}
          value={diagnosticNotes}
          onChange={(e) => setDiagnosticNotes(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
        />
      </div>
    </fieldset>
  );
});

export default DiagnosticWorkbench;
