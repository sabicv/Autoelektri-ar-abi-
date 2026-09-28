'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, LifeBuoy, Loader2, Mic, MicOff, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/compressImage';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { cn } from '@/lib/utils';
import type { MechanicTask } from '@/types/database';

interface HelpRequestSheetProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  jobId: string;
  onSent?: (task: MechanicTask) => void;
}

export default function HelpRequestSheet({ open, onClose, tenantId, jobId, onSent }: HelpRequestSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ path: string; previewUrl: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleFinalText = useCallback((final: string) => {
    setMessage((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
  }, []);
  const { isSupported, isRecording, interimText, toggleRecording } = useSpeechToText({ onFinalText: handleFinalText });

  async function discardPhoto() {
    if (!photo) return;
    URL.revokeObjectURL(photo.previewUrl);
    await createBrowserSupabaseClient().storage.from('job-vault').remove([photo.path]);
    setPhoto(null);
  }

  async function handleFile(original: File | undefined) {
    if (!original) return;
    setIsUploading(true);
    await discardPhoto();
    const file = await compressImage(original);
    const path = `${tenantId}/${jobId}/HELP_${Date.now()}.jpg`;
    const { error } = await createBrowserSupabaseClient()
      .storage.from('job-vault')
      .upload(path, file, { contentType: file.type, upsert: false });
    setIsUploading(false);
    if (error) {
      toast.error('Slika se nije poslala. Provjerite vezu i pokušajte ponovno.');
      return;
    }
    setPhoto({ path, previewUrl: URL.createObjectURL(file) });
  }

  function close() {
    discardPhoto();
    setMessage('');
    onClose();
  }

  async function send() {
    if (!photo && !message.trim()) {
      toast.error('Uslikajte problem ili ga opišite.');
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'HELP',
          jobId,
          message: message.trim() || 'Trebam pomoć oko ovog vozila.',
          photoPath: photo?.path ?? null,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      toast.success('Poslano — vlasnik je obaviješten.');
      onSent?.(json.task);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      setPhoto(null);
      setMessage('');
      onClose();
    } catch {
      toast.error('Slanje nije uspjelo. Pokušajte ponovno.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-h-[95dvh]">
        <DrawerTitle className="flex items-center gap-2 px-4 pt-4 text-base font-bold text-red-600 dark:text-red-400">
          <LifeBuoy className="h-5 w-5" strokeWidth={2} /> Trebam pomoć
        </DrawerTitle>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          {photo ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="" className="max-h-64 w-full rounded-2xl object-cover" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="press-effect absolute bottom-2 right-2 flex min-h-[48px] items-center gap-1.5 rounded-xl bg-black/60 px-4 text-sm font-semibold text-white"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2} /> Ponovno
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="press-effect flex min-h-[128px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-red-300 bg-red-50/60 text-base font-semibold text-red-700 disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
            >
              {isUploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" strokeWidth={2} />}
              Uslikaj problem
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />

          <div>
            {isSupported && (
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  'press-effect mb-2 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold',
                  isRecording ? 'bg-alarm-red text-white' : 'bg-slate-100 text-slate-700 dark:bg-workshop-surface-hover dark:text-slate-200'
                )}
              >
                {isRecording ? <MicOff className="h-5 w-5" strokeWidth={2} /> : <Mic className="h-5 w-5" strokeWidth={2} />}
                {isRecording ? 'Zaustavi' : 'Diktiraj'}
              </button>
            )}
            {interimText && <p className="mb-1 truncate text-xs italic text-slate-400">{interimText}</p>}
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={send}
            disabled={isSending || isUploading}
            className="press-effect flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-alarm-red text-base font-semibold text-white disabled:opacity-60"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LifeBuoy className="h-5 w-5" strokeWidth={2} />}
            Pošalji vlasniku
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
