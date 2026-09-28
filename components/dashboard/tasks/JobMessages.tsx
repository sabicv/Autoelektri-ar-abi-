'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { LifeBuoy, MessagesSquare, Plus, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import { updateTaskStatus } from '@/lib/taskStatus';
import { useSignedUrls } from '@/lib/useSignedUrls';
import { cn } from '@/lib/utils';
import type { MechanicTask, StaffRole } from '@/types/database';
import type { StaffOption } from './TaskComposer';

const TaskComposer = dynamic(() => import('./TaskComposer'), { ssr: false });
const HelpRequestSheet = dynamic(() => import('./HelpRequestSheet'), { ssr: false });

interface JobMessagesProps {
  messages: MechanicTask[];
  onMessagesChange: (next: MechanicTask[]) => void;
  staffNames: Record<string, string>;
  receivers: StaffOption[];
  role: StaffRole;
  currentUserId: string;
  tenantId: string;
  jobId: string;
  jobLabel: string;
  defaultOpen?: boolean;
}

function kindLabel(m: MechanicTask) {
  if (m.reply_to_id) return 'Odgovor';
  return m.kind === 'HELP' ? 'Trebam pomoć' : 'Zadatak';
}

function statusLabel(m: MechanicTask) {
  if (m.kind === 'HELP') return m.status === 'DONE' ? 'riješeno' : 'otvoreno';
  return { PENDING: 'novo', IN_PROGRESS: 'preuzeto', DONE: 'gotovo' }[m.status];
}

// Who writes next: the owner answers with a task to that mechanic, a
// mechanic answers through the channel to management (kind HELP, marked
// as a reply). Either side can always start a new message, also after a
// help request has been resolved.
type Composer =
  | { mode: 'owner'; replyTo?: MechanicTask }
  | { mode: 'mechanic'; replyTo?: MechanicTask };

// The job's internal record: every task, help request and reply, oldest
// first. Kept behind a small counter so it never crowds the job screen.
export default function JobMessages({
  messages,
  onMessagesChange,
  staffNames,
  receivers,
  role,
  currentUserId,
  tenantId,
  jobId,
  jobLabel,
  defaultOpen = false,
}: JobMessagesProps) {
  const isOwner = role === 'owner';
  const [open, setOpen] = useState(defaultOpen && messages.length > 0);
  const [composer, setComposer] = useState<Composer | null>(null);
  const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photoUrls = useSignedUrls(open ? ordered.flatMap((m) => (m.photo_path ? [m.photo_path] : [])) : []);
  const openHelp = messages.filter((m) => m.kind === 'HELP' && !m.reply_to_id && m.status !== 'DONE').length;

  async function resolve(help: MechanicTask) {
    const saved = await updateTaskStatus(help.id, 'DONE');
    if (!saved) {
      toast.error('Promjena nije spremljena. Osvježite stranicu i pokušajte ponovno.');
      return;
    }
    onMessagesChange(messages.map((m) => (m.id === help.id ? saved : m)));
  }

  function canReply(m: MechanicTask) {
    if (!m.sender_id || m.sender_id === currentUserId) return false;
    return isOwner ? m.kind === 'HELP' : m.receiver_id === currentUserId;
  }

  function startReply(m: MechanicTask) {
    setComposer({ mode: isOwner ? 'owner' : 'mechanic', replyTo: m });
  }

  function handleSent(task: MechanicTask) {
    const replyTo = composer?.replyTo;
    // Answering an open help request resolves it.
    const resolves = isOwner && replyTo?.kind === 'HELP' && replyTo.status !== 'DONE';
    const updatedAt = new Date().toISOString();
    onMessagesChange([
      ...messages.map((m) => (resolves && m.id === replyTo?.id ? { ...m, status: 'DONE' as const, updated_at: updatedAt } : m)),
      task,
    ]);
    if (resolves && replyTo) {
      updateTaskStatus(replyTo.id, 'DONE').then((saved) => !saved && toast.error('Zahtjev nije označen kao riješen.'));
    }
  }

  if (messages.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'press-effect inline-flex min-h-[48px] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold',
          openHelp > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-300'
        )}
      >
        {openHelp > 0 ? <LifeBuoy className="h-4 w-4" strokeWidth={2} /> : <MessagesSquare className="h-4 w-4" strokeWidth={2} />}
        Interne poruke ({messages.length})
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerTitle className="px-4 pt-4 text-base font-bold text-slate-900 dark:text-slate-100">Interne poruke</DrawerTitle>
          <ol className="space-y-4 overflow-y-auto px-4 py-4">
            {ordered.map((m) => {
              const from = m.sender_id ? (staffNames[m.sender_id] ?? 'Djelatnik') : 'Djelatnik';
              const to = m.kind === 'HELP' ? 'vlasniku' : m.receiver_id ? (staffNames[m.receiver_id] ?? 'djelatniku') : '';
              const url = m.photo_path ? photoUrls[m.photo_path] : undefined;
              const isOpenHelp = isOwner && m.kind === 'HELP' && m.status !== 'DONE';
              return (
                <li key={m.id} className="border-l-2 border-slate-200 pl-3 dark:border-workshop-border">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500 dark:text-slate-300">
                    <span
                      className={cn(
                        'font-bold uppercase tracking-wide',
                        m.kind === 'HELP' && !m.reply_to_id && 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {kindLabel(m)}
                    </span>
                    <span>
                      {from} → {to}
                    </span>
                    <span>{new Date(m.created_at).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span>· {statusLabel(m)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100">{m.message_text}</p>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    </a>
                  )}
                  {(canReply(m) || isOpenHelp) && (
                    <div className="mt-2 flex gap-2">
                      {canReply(m) && (
                        <button
                          type="button"
                          onClick={() => startReply(m)}
                          className="press-effect flex min-h-[48px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
                        >
                          <Reply className="h-4 w-4" strokeWidth={2} /> Odgovori
                        </button>
                      )}
                      {isOpenHelp && (
                        <button
                          type="button"
                          onClick={() => resolve(m)}
                          className="press-effect min-h-[48px] rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200"
                        >
                          Riješeno
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Always there, so a resolved thread never ends the conversation. */}
          {(!isOwner || receivers.length > 0) && (
            <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-workshop-border">
              {/* A mechanic's new message to management is a help request. */}
              <button
                type="button"
                onClick={() => setComposer({ mode: isOwner ? 'owner' : 'mechanic' })}
                className={cn(
                  'press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold',
                  isOwner
                    ? 'border-blue-600 text-blue-700 dark:border-electric-blue dark:text-electric-blue'
                    : 'border-alarm-red text-alarm-red dark:border-red-400 dark:text-red-400'
                )}
              >
                {isOwner ? <Plus className="h-4 w-4" strokeWidth={2} /> : <LifeBuoy className="h-4 w-4" strokeWidth={2} />}
                {isOwner ? 'Nova poruka radniku' : 'Trebam pomoć'}
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {composer?.mode === 'owner' && (
        <TaskComposer
          open
          onClose={() => setComposer(null)}
          tenantId={tenantId}
          currentUserId={currentUserId}
          staff={receivers}
          jobId={jobId}
          jobLabel={jobLabel}
          replyTo={
            composer.replyTo?.sender_id ? { id: composer.replyTo.id, senderId: composer.replyTo.sender_id } : undefined
          }
          onSent={handleSent}
        />
      )}

      {composer?.mode === 'mechanic' && (
        <HelpRequestSheet
          open
          onClose={() => setComposer(null)}
          tenantId={tenantId}
          jobId={jobId}
          replyToId={composer.replyTo?.id}
          onSent={handleSent}
        />
      )}
    </>
  );
}
