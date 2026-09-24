'use client';

import { useCallback, useState } from 'react';
import { Loader2, Mic, MicOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { cn } from '@/lib/utils';

interface VoiceWorkLoggerProps {
  jobId: string;
  tenantId: string;
  initialWorkSummary: string | null;
  locked?: boolean;
  onSaved?: (newSummary: string) => void;
}

export default function VoiceWorkLogger({
  jobId,
  tenantId,
  initialWorkSummary,
  locked = false,
  onSaved,
}: VoiceWorkLoggerProps) {
  const [summary, setSummary] = useState(initialWorkSummary ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleFinalText = useCallback((final: string) => {
    setSummary((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
  }, []);

  const { isSupported, isRecording, interimText, toggleRecording } = useSpeechToText({
    onFinalText: handleFinalText,
  });

  async function handleSave() {
    setIsSaving(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('jobs').update({ work_summary: summary }).eq('id', jobId);

    if (error) {
      setIsSaving(false);
      toast.error('Spremanje zapisa rada nije uspjelo.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: tenantId,
      job_id: jobId,
      event_type: 'WORK_LOG_UPDATED',
      actor: 'mechanic',
      message: 'Zapis o izvedenim radovima ažuriran.',
      metadata: {},
    });

    setIsSaving(false);
    toast.success('Zapis rada spremljen.');
    onSaved?.(summary);
  }

  return (
    <fieldset disabled={locked} className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="workSummary" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Opis izvedenih radova
        </label>
        {isSupported && !locked && (
          <button
            type="button"
            onClick={toggleRecording}
            className={cn(
              'press-effect flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
              isRecording
                ? 'bg-alarm-red text-white'
                : 'bg-blue-50 text-blue-600 dark:bg-electric-blue/10 dark:text-electric-blue'
            )}
          >
            {isRecording ? <MicOff className="h-4 w-4" strokeWidth={2} /> : <Mic className="h-4 w-4" strokeWidth={2} />}
            {isRecording ? 'Zaustavi' : 'Diktiraj'}
          </button>
        )}
      </div>

      {!isSupported && (
        <p className="text-xs text-slate-400 dark:text-slate-500">Glasovni unos nije podržan u ovom pregledniku.</p>
      )}
      {interimText && <p className="truncate text-xs italic text-slate-400">{interimText}</p>}

      <textarea
        id="workSummary"
        rows={4}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Opis izvedenih radova…"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
      />

      {!locked && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="press-effect flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />}
          {isSaving ? 'Spremanje…' : 'Spremi zapis rada'}
        </button>
      )}
    </fieldset>
  );
}
