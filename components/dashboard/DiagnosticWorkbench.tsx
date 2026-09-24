'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BatteryWarning, Loader2, Mic, MicOff, Plus, Save, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { searchDtcCodes } from '@/lib/dtc-codes';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { cn } from '@/lib/utils';
import Skeleton from '@/components/ui/Skeleton';

interface DiagnosticWorkbenchProps {
  jobId: string;
  tenantId: string;
  initialDiagnosticNotes: string | null;
  locked?: boolean;
  onSaved?: (diagnosticNotes: string) => void;
}

export default function DiagnosticWorkbench({
  jobId,
  tenantId,
  initialDiagnosticNotes,
  locked = false,
  onSaved,
}: DiagnosticWorkbenchProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [dtcCodes, setDtcCodes] = useState<string[]>([]);
  const [dtcInput, setDtcInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [batteryDrainMa, setBatteryDrainMa] = useState('');
  const [moduleNotes, setModuleNotes] = useState('');
  const [diagnosticNotes, setDiagnosticNotes] = useState(initialDiagnosticNotes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (data) {
        setDtcCodes(data.dtc_codes ?? []);
        setBatteryDrainMa(data.battery_drain_ma !== null ? String(data.battery_drain_ma) : '');
        setModuleNotes(data.module_notes ?? '');
      }
      setIsLoading(false);
    }

    loadLatestReport();
    return () => {
      cancelled = true;
    };
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

  async function handleSave() {
    setIsSaving(true);
    const supabase = createBrowserSupabaseClient();

    const parsedDrain = batteryDrainMa.trim() ? Number(batteryDrainMa.replace(',', '.')) : null;

    const { error: reportError } = await supabase.from('diagnostic_reports').insert({
      job_id: jobId,
      dtc_codes: dtcCodes,
      battery_drain_ma: Number.isFinite(parsedDrain) ? parsedDrain : null,
      module_notes: moduleNotes || null,
    });

    if (reportError) {
      setIsSaving(false);
      toast.error('Spremanje dijagnostičkog nalaza nije uspjelo.');
      return;
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({ diagnostic_notes: diagnosticNotes || null })
      .eq('id', jobId);

    if (jobError) {
      setIsSaving(false);
      toast.error('Nalaz je spremljen, ali napomene naloga nisu ažurirane.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: tenantId,
      job_id: jobId,
      event_type: 'DIAGNOSTIC_REPORT_SAVED',
      actor: 'mechanic',
      message: dtcCodes.length > 0 ? `Dijagnostički nalaz spremljen: ${dtcCodes.join(', ')}.` : 'Dijagnostički nalaz spremljen.',
      metadata: { dtcCodes, batteryDrainMa: parsedDrain },
    });

    setIsSaving(false);
    toast.success('Dijagnostički nalaz spremljen.');
    onSaved?.(diagnosticNotes);
  }

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
      {locked && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Nalog je zaključan — nalaz se više ne može mijenjati.
        </p>
      )}
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
            placeholder="npr. 350"
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
              <span
                key={code}
                className="flex items-center gap-1 rounded-full bg-electric-blue/10 px-2.5 py-1 text-xs font-bold text-electric-blue"
              >
                {code}
                <button
                  type="button"
                  onClick={() => removeCode(code)}
                  aria-label={`Ukloni ${code}`}
                  className="rounded-full hover:bg-electric-blue/20"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </span>
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
              placeholder="Upišite kod (npr. P0300) ili pretražite..."
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
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-workshop-surface-hover"
                >
                  <span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{s.code}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">{s.description}</span>
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
          Napomene o modulima / CAN-bus / sleep modu
        </label>
        <textarea
          id="moduleNotes"
          rows={2}
          value={moduleNotes}
          onChange={(e) => setModuleNotes(e.target.value)}
          placeholder="Npr. vozilo ulazi u sleep mod nakon 40 min, CAN-bus integritet uredan..."
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="diagnosticNotes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Dijagnostičke napomene (scope očitanja, integritet instalacije)
          </label>
          {dictationSupported && (
            <button
              type="button"
              onClick={toggleNotesDictation}
              className={cn(
                'press-effect flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
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
          placeholder="Nalaz dijagnostike — odvojeno od popisa izvedenih radova ispod."
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
        />
      </div>

      {!locked && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" strokeWidth={2} />}
          {isSaving ? 'Spremanje…' : 'Spremi dijagnostički nalaz'}
        </button>
      )}
    </fieldset>
  );
}
