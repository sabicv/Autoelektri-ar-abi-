'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Mic, MicOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// Minimal shape of the Web Speech API we actually use — not part of
// lib.dom.d.ts, and support varies (Chrome/Edge/Safari; no Firefox), so
// this is feature-detected and typed just enough to avoid `any` leaking
// through the component body.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface VoiceWorkLoggerProps {
  jobId: string;
  tenantId: string;
  initialWorkSummary: string | null;
  onSaved?: (newSummary: string) => void;
}

export default function VoiceWorkLogger({ jobId, tenantId, initialWorkSummary, onSaved }: VoiceWorkLoggerProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [summary, setSummary] = useState(initialWorkSummary ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!Ctor) {
      setIsSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'hr-HR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setSummary((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
      }
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast.error('Prepoznavanje govora je prekinuto.');
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }

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
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={!isSupported}
          className={cn(
            'press-effect relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            isRecording ? 'bg-alarm-red' : 'bg-blue-600 dark:bg-electric-blue dark:text-workshop-dark'
          )}
          aria-label={isRecording ? 'Zaustavi snimanje' : 'Pokreni glasovni unos'}
        >
          {isRecording && (
            <>
              <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-alarm-red/40" />
              <span className="absolute inset-0 -m-4 animate-ping rounded-full bg-alarm-red/20 [animation-delay:200ms]" />
            </>
          )}
          {isRecording ? (
            <MicOff className="relative h-6 w-6" strokeWidth={2} />
          ) : (
            <Mic className="relative h-6 w-6" strokeWidth={2} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {!isSupported ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Glasovni unos nije podržan u ovom pregledniku — koristite tipkovnicu ispod.
            </p>
          ) : isRecording ? (
            <AnimatePresence mode="wait">
              <motion.p
                key="listening"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm font-medium text-electric-blue"
              >
                Transkripcija uz AI
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                </span>
              </motion.p>
            </AnimatePresence>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Dodirnite mikrofon za glasovni unos zapisa rada.
            </p>
          )}
          {interimText && <p className="mt-1 truncate text-xs italic text-slate-400">{interimText}</p>}
        </div>
      </div>

      <textarea
        rows={4}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Opis izvedenih radova…"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
      >
        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" strokeWidth={2} />}
        {isSaving ? 'Spremanje…' : 'Spremi zapis rada'}
      </button>
    </div>
  );
}
