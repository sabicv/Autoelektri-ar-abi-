'use client';

import { useCallback, useEffect, useState } from 'react';
import { Car, Loader2, Mic, MicOff, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { clearDraft, readDraft, writeDraft } from '@/lib/drafts';
import { cn } from '@/lib/utils';
import type { MechanicTask } from '@/types/database';

export interface StaffOption {
  id: string;
  name: string;
}

interface TaskComposerProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currentUserId: string;
  staff: StaffOption[];
  jobId?: string;
  jobLabel?: string;
  // Replying to a help request: the reply goes straight back to its sender.
  replyTo?: { id: string; senderId: string };
  onSent?: (task: MechanicTask) => void;
}

export default function TaskComposer({
  open,
  onClose,
  tenantId,
  currentUserId,
  staff,
  jobId,
  jobLabel,
  replyTo,
  onSent,
}: TaskComposerProps) {
  const draftKey = `draft:task:${tenantId}:${replyTo?.id ?? jobId ?? 'general'}`;
  const [receiverId, setReceiverId] = useState<string | null>(
    replyTo?.senderId ?? (staff.length === 1 ? staff[0].id : null)
  );
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const draft = readDraft<{ receiverId: string | null; message: string }>(draftKey);
    if (draft) {
      setMessage(draft.message);
      if (draft.receiverId && staff.some((s) => s.id === draft.receiverId)) setReceiverId(draft.receiverId);
    }
  }, [open, draftKey, staff]);

  useEffect(() => {
    if (!open) return;
    if (message.trim()) writeDraft(draftKey, { receiverId, message });
    else clearDraft(draftKey);
  }, [open, draftKey, receiverId, message]);

  const handleFinalText = useCallback((final: string) => {
    setMessage((prev) => (prev ? `${prev} ${final}`.trim() : final.trim()));
  }, []);
  const { isSupported, isRecording, interimText, toggleRecording } = useSpeechToText({ onFinalText: handleFinalText });

  // Closing on purpose discards the text. The draft only exists to survive
  // an accidental reload or a dropped signal, not a deliberate "no".
  function close() {
    clearDraft(draftKey);
    setMessage('');
    onClose();
  }

  async function send() {
    if (!receiverId) {
      toast.error('Odaberite mehaničara.');
      return;
    }
    if (!message.trim()) {
      toast.error('Zadatak je prazan.');
      return;
    }

    setIsSending(true);
    let data: MechanicTask | null = null;
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'TASK',
          message: message.trim(),
          receiverId,
          jobId: jobId ?? null,
          replyToId: replyTo?.id ?? null,
        }),
      });
      const json = await response.json();
      if (response.ok) data = json.task;
    } catch {
      // handled below
    }
    setIsSending(false);

    if (!data) {
      toast.error('Slanje zadatka nije uspjelo. Tekst je sačuvan — pokušajte ponovno.');
      return;
    }

    toast.success(`Zadatak poslan: ${staff.find((s) => s.id === receiverId)?.name ?? 'mehaničar'}`);
    onSent?.(data);
    close();
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-h-[95dvh]">
        <DrawerTitle className="px-4 pt-4 text-base font-bold text-slate-900 dark:text-slate-100">
          {replyTo ? 'Odgovor' : 'Zadatak mehaničaru'}
        </DrawerTitle>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          {jobLabel && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <Car className="h-4 w-4" strokeWidth={2} /> {jobLabel}
            </p>
          )}

          <div className={cn('flex flex-wrap gap-2', replyTo && 'hidden')}>
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setReceiverId(s.id)}
                aria-pressed={receiverId === s.id}
                className={cn(
                  'press-effect min-h-[48px] rounded-full border-2 px-4 text-sm font-semibold',
                  receiverId === s.id
                    ? 'border-blue-600 bg-blue-600 text-white dark:border-electric-blue dark:bg-electric-blue dark:text-workshop-dark'
                    : 'border-slate-200 text-slate-700 dark:border-workshop-border dark:text-slate-200'
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div>
            {isSupported && (
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  'press-effect mb-2 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl text-base font-semibold',
                  isRecording
                    ? 'bg-alarm-red text-white'
                    : 'bg-blue-50 text-blue-700 dark:bg-electric-blue/10 dark:text-electric-blue'
                )}
              >
                {isRecording ? <MicOff className="h-5 w-5" strokeWidth={2} /> : <Mic className="h-5 w-5" strokeWidth={2} />}
                {isRecording ? 'Zaustavi' : 'Diktiraj zadatak'}
              </button>
            )}
            {interimText && <p className="mb-1 truncate text-xs italic text-slate-400">{interimText}</p>}
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={send}
            disabled={isSending}
            className="press-effect flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" strokeWidth={2} />}
            Pošalji
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
