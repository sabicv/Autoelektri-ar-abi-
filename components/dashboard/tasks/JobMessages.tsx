'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { LifeBuoy, MessagesSquare, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useSignedUrls } from '@/lib/useSignedUrls';
import { cn } from '@/lib/utils';
import type { MechanicTask, StaffRole } from '@/types/database';
import type { StaffOption } from './TaskComposer';

const TaskComposer = dynamic(() => import('./TaskComposer'), { ssr: false });

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
  if (m.kind === 'HELP') return 'Trebam pomoć';
  return m.reply_to_id ? 'Odgovor' : 'Zadatak';
}

function statusLabel(m: MechanicTask) {
  if (m.kind === 'HELP') return m.status === 'DONE' ? 'riješeno' : 'otvoreno';
  return { PENDING: 'novo', IN_PROGRESS: 'u radu', DONE: 'gotovo' }[m.status];
}

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
  const [open, setOpen] = useState(defaultOpen && messages.length > 0);
  const [replyTo, setReplyTo] = useState<MechanicTask | null>(null);
  const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photoUrls = useSignedUrls(open ? ordered.flatMap((m) => (m.photo_path ? [m.photo_path] : [])) : []);
  const openHelp = messages.filter((m) => m.kind === 'HELP' && m.status !== 'DONE').length;

  async function resolve(help: MechanicTask) {
    const updatedAt = new Date().toISOString();
    const { error } = await createBrowserSupabaseClient()
      .from('mechanic_tasks')
      .update({ status: 'DONE', updated_at: updatedAt })
      .eq('id', help.id);
    if (error) {
      toast.error('Promjena nije spremljena.');
      return;
    }
    onMessagesChange(messages.map((m) => (m.id === help.id ? { ...m, status: 'DONE', updated_at: updatedAt } : m)));
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
              return (
                <li key={m.id} className="border-l-2 border-slate-200 pl-3 dark:border-workshop-border">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500 dark:text-slate-300">
                    <span className={cn('font-bold uppercase tracking-wide', m.kind === 'HELP' && 'text-red-600 dark:text-red-400')}>
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
                  {role === 'owner' && m.kind === 'HELP' && m.status !== 'DONE' && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="press-effect flex min-h-[48px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
                      >
                        <Reply className="h-4 w-4" strokeWidth={2} /> Odgovori
                      </button>
                      <button
                        type="button"
                        onClick={() => resolve(m)}
                        className="press-effect min-h-[48px] rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200"
                      >
                        Riješeno
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </DrawerContent>
      </Drawer>

      {replyTo && replyTo.sender_id && (
        <TaskComposer
          open
          onClose={() => setReplyTo(null)}
          tenantId={tenantId}
          currentUserId={currentUserId}
          staff={receivers}
          jobId={jobId}
          jobLabel={jobLabel}
          replyTo={{ id: replyTo.id, senderId: replyTo.sender_id }}
          onSent={(task) => {
            // Replying resolves the help request.
            const updatedAt = new Date().toISOString();
            onMessagesChange([
              ...messages.map((m) => (m.id === replyTo.id ? { ...m, status: 'DONE' as const, updated_at: updatedAt } : m)),
              task,
            ]);
            createBrowserSupabaseClient()
              .from('mechanic_tasks')
              .update({ status: 'DONE', updated_at: updatedAt })
              .eq('id', replyTo.id)
              .then(({ error }) => error && toast.error('Zahtjev nije označen kao riješen.'));
          }}
        />
      )}
    </>
  );
}
