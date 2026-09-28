'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Car, CheckCircle2, ClipboardList, Hand, LifeBuoy, Plus, Reply, X } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/components/ui/Card';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useSignedUrls } from '@/lib/useSignedUrls';
import { cn } from '@/lib/utils';
import type { MechanicTask, StaffRole, TaskStatus } from '@/types/database';
import type { StaffOption } from './TaskComposer';

const TaskComposer = dynamic(() => import('./TaskComposer'), { ssr: false });

const TASK_STATUS_HR: Record<TaskStatus, string> = { PENDING: 'Novo', IN_PROGRESS: 'U radu', DONE: 'Gotovo' };
const HELP_STATUS_HR: Record<TaskStatus, string> = { PENDING: 'Čeka odgovor', IN_PROGRESS: 'U tijeku', DONE: 'Riješeno' };

const DONE_VISIBLE_MS = 12 * 60 * 60 * 1000;

interface TaskFeedProps {
  initialTasks: MechanicTask[];
  role: StaffRole;
  currentUserId: string;
  tenantId: string;
  staff: StaffOption[];
  jobLabels: Record<string, string>;
}

export default function TaskFeed({ initialTasks, role, currentUserId, tenantId, staff, jobLabels }: TaskFeedProps) {
  const isOwner = role === 'owner';
  const [tasks, setTasks] = useState(initialTasks);
  const [composer, setComposer] = useState<{ replyTo?: MechanicTask } | null>(null);
  const staffNames = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);
  const receivers = useMemo(() => staff.filter((s) => s.id !== currentUserId), [staff, currentUserId]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    // RLS still applies to the stream; filters just keep it small. A
    // mechanic listens for tasks to them and for replies on their own help requests.
    const filters = isOwner ? [`tenant_id=eq.${tenantId}`] : [`receiver_id=eq.${currentUserId}`, `sender_id=eq.${currentUserId}`];

    const handle = (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: MechanicTask; old: Partial<MechanicTask> }) => {
      if (payload.eventType === 'DELETE') {
        setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
        return;
      }
      const task = payload.new;
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev]));
      const addressedToMe = task.receiver_id === currentUserId || (isOwner && task.kind === 'HELP' && task.sender_id !== currentUserId);
      if (payload.eventType === 'INSERT' && addressedToMe) {
        navigator.vibrate?.([200, 100, 200]);
        toast(task.kind === 'HELP' ? 'Trebam pomoć' : 'Novi zadatak', { description: task.message_text });
      }
    };

    let channel = supabase.channel(`mechanic-tasks-${currentUserId}`);
    for (const filter of filters) {
      channel = channel.on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'mechanic_tasks', filter },
        handle as never
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOwner, tenantId, currentUserId]);

  const visible = useMemo(() => {
    const cutoff = Date.now() - DONE_VISIBLE_MS;
    return tasks
      .filter((t) => t.status !== 'DONE' || new Date(t.updated_at).getTime() > cutoff)
      .sort((a, b) => {
        // Open help requests first, then open tasks, then recently finished.
        const rank = (t: MechanicTask) => (t.status === 'DONE' ? 2 : t.kind === 'HELP' ? 0 : 1);
        return rank(a) - rank(b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tasks]);

  const photoUrls = useSignedUrls(visible.flatMap((t) => (t.photo_path ? [t.photo_path] : [])));

  async function setStatus(task: MechanicTask, status: TaskStatus) {
    const previous = task.status;
    const updatedAt = new Date().toISOString();
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status, updated_at: updatedAt } : t)));
    const { error } = await createBrowserSupabaseClient()
      .from('mechanic_tasks')
      .update({ status, updated_at: updatedAt })
      .eq('id', task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: previous } : t)));
      toast.error('Promjena nije spremljena. Provjerite vezu.');
    }
  }

  async function remove(task: MechanicTask) {
    if (!window.confirm('Obrisati zadatak?')) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error } = await createBrowserSupabaseClient().from('mechanic_tasks').delete().eq('id', task.id);
    if (error) {
      setTasks((prev) => [task, ...prev]);
      toast.error('Brisanje nije uspjelo.');
    }
  }

  // A mechanic with nothing assigned sees no extra block on Poslovi.
  if (!isOwner && visible.length === 0) return null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-slate-100">
          <ClipboardList className="h-5 w-5" strokeWidth={2} />
          {isOwner ? 'Zadaci' : 'Moji zadaci'}
        </h2>
        {isOwner && receivers.length > 0 && (
          <button
            type="button"
            onClick={() => setComposer({})}
            className="press-effect flex min-h-[48px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2} /> Novi zadatak
          </button>
        )}
      </div>

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((task) => {
            const done = task.status === 'DONE';
            const isHelp = task.kind === 'HELP';
            const sender = task.sender_id ? staffNames.get(task.sender_id) : null;
            const receiver = task.receiver_id ? staffNames.get(task.receiver_id) : null;
            const who = isHelp ? sender : isOwner ? (receiver ? `→ ${receiver}` : null) : sender;
            const photoUrl = task.photo_path ? photoUrls[task.photo_path] : undefined;
            const canAct = !done && (task.receiver_id === currentUserId || isOwner);

            return (
              <li
                key={task.id}
                className={cn(
                  'rounded-xl border p-3',
                  done
                    ? 'border-slate-200 opacity-60 dark:border-workshop-border'
                    : isHelp
                      ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10'
                      : task.status === 'IN_PROGRESS'
                        ? 'border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/10'
                        : 'border-slate-200 dark:border-workshop-border'
                )}
              >
                {isHelp && (
                  <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                    <LifeBuoy className="h-3.5 w-3.5" strokeWidth={2.5} /> Trebam pomoć
                  </p>
                )}
                <div className="flex items-start gap-3">
                  {photoUrl && (
                    <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    </a>
                  )}
                  <p
                    className={cn(
                      'min-w-0 flex-1 whitespace-pre-wrap text-base font-semibold text-slate-900 dark:text-slate-100',
                      done && 'line-through'
                    )}
                  >
                    {task.message_text}
                  </p>
                  {isOwner && !task.job_id && (
                    <button
                      type="button"
                      onClick={() => remove(task)}
                      aria-label="Obriši zadatak"
                      className="press-effect -m-2 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-slate-400"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-300">
                  <span className="font-semibold">{(isHelp ? HELP_STATUS_HR : TASK_STATUS_HR)[task.status]}</span>
                  {who && <span>{who}</span>}
                  <span>{new Date(task.created_at).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}</span>
                  {task.job_id && (
                    <Link
                      href={`/dashboard/jobs/${task.job_id}`}
                      className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-blue-600 dark:text-electric-blue"
                    >
                      <Car className="h-3.5 w-3.5" strokeWidth={2} />
                      {jobLabels[task.job_id] ?? 'Nalog'}
                    </Link>
                  )}
                </div>

                {isHelp && isOwner && !done && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setComposer({ replyTo: task })}
                      className="press-effect flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
                    >
                      <Reply className="h-4 w-4" strokeWidth={2} /> Odgovori
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(task, 'DONE')}
                      className="press-effect flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200"
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Riješeno
                    </button>
                  </div>
                )}

                {!isHelp && canAct && (
                  <button
                    type="button"
                    onClick={() => setStatus(task, task.status === 'PENDING' ? 'IN_PROGRESS' : 'DONE')}
                    className={cn(
                      'press-effect mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white',
                      task.status === 'PENDING' ? 'bg-blue-600 dark:bg-electric-blue dark:text-workshop-dark' : 'bg-emerald-600'
                    )}
                  >
                    {task.status === 'PENDING' ? (
                      <>
                        <Hand className="h-4 w-4" strokeWidth={2} /> Preuzmi
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Gotovo
                      </>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {composer && (
        <TaskComposer
          open
          onClose={() => setComposer(null)}
          tenantId={tenantId}
          currentUserId={currentUserId}
          staff={receivers}
          jobId={composer.replyTo?.job_id ?? undefined}
          jobLabel={composer.replyTo?.job_id ? jobLabels[composer.replyTo.job_id] : undefined}
          replyTo={
            composer.replyTo?.sender_id ? { id: composer.replyTo.id, senderId: composer.replyTo.sender_id } : undefined
          }
          onSent={(task) => {
            setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]));
            // Replying to a help request resolves it.
            if (composer.replyTo) setStatus(composer.replyTo, 'DONE');
          }}
        />
      )}
    </Card>
  );
}
