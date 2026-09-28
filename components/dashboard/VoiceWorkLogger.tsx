'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { clearDraft, readDraft, writeDraft } from '@/lib/drafts';
import { cn } from '@/lib/utils';
import type { SectionHandle } from './sectionHandle';

interface VoiceWorkLoggerProps {
  jobId: string;
  tenantId: string;
  initialWorkSummary: string | null;
  locked?: boolean;
  onSaved?: (newSummary: string) => void;
}

const VoiceWorkLogger = forwardRef<SectionHandle, VoiceWorkLoggerProps>(function VoiceWorkLogger(
  { jobId, tenantId, initialWorkSummary, locked = false, onSaved },
  ref
) {
  const [summary, setSummary] = useState(initialWorkSummary ?? '');
  const savedRef = useRef(initialWorkSummary ?? '');
  const draftKey = `draft:job:${jobId}:work`;

  useEffect(() => {
    if (locked) return;
    const draft = readDraft<string>(draftKey);
    if (draft !== null && draft !== savedRef.current) setSummary(draft);
  }, [draftKey, locked]);

  useEffect(() => {
    if (summary === savedRef.current) clearDraft(draftKey);
    else writeDraft(draftKey, summary);
  }, [summary, draftKey]);

  const handleFinalText = useCallback((final: string) => {
    setSummary((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
  }, []);

  const { isSupported, isRecording, interimText, toggleRecording } = useSpeechToText({
    onFinalText: handleFinalText,
  });

  useImperativeHandle(ref, () => ({
    isDirty: () => summary !== savedRef.current,
    save: async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.from('jobs').update({ work_summary: summary }).eq('id', jobId);

      if (error) {
        toast.error('Spremanje izvedenih radova nije uspjelo.');
        return false;
      }

      await supabase.from('job_events').insert({
        tenant_id: tenantId,
        job_id: jobId,
        event_type: 'WORK_LOG_UPDATED',
        actor: 'mechanic',
        message: 'Zapis o izvedenim radovima ažuriran.',
        metadata: {},
      });

      savedRef.current = summary;
      clearDraft(draftKey);
      onSaved?.(summary);
      return true;
    },
  }));

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
              'press-effect flex min-h-[48px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
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

      {interimText && <p className="truncate text-xs italic text-slate-400">{interimText}</p>}

      <textarea
        id="workSummary"
        rows={4}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
      />
    </fieldset>
  );
});

export default VoiceWorkLogger;
