'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Car, CheckCircle2, ClipboardList, Hand, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/components/ui/Card';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { MechanicTask, StaffRole, TaskStatus } from '@/types/database';
import type { StaffOption } from './TaskComposer';

const TaskComposer = dynamic(() => import('./TaskComposer'), { ssr: false });

const STATUS_LABELS_HR: Record<TaskStatus, string> = {
  PENDING: 'Novo',
  IN_PROGRESS: 'U radu',
  DONE: 'Gotovo',
};

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
  const [composerOpen, setComposerOpen] = useState(false);
  const staffNames = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);
  const receivers = useMemo(() => staff.filter((s) => s.id !== currentUserId), [staff, currentUserId]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    // RLS still applies to the stream; the filter just keeps it small.
    const filter = isOwner ? `tenant_id=eq.${tenantId}` : `receiver_id=eq.${currentUserId}`;

    const channel = supabase
      .channel(`mechanic-tasks-${currentUserId}`)
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'mechanic_tasks', filter },
        (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: MechanicTask; old: Partial<MechanicTask> }) => {
          if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
            return;
          }
          const task = payload.new;
          setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev]));
          if (payload.eventType === 'INSERT' && task.receiver_id === currentUserId) {
            navigator.vibrate?.([200, 100, 200]);
            toast('Novi zadatak', { description: task.message_text });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOwner, tenantId, currentUserId]);

  const visible = useMemo(() => {
    const cutoff = Date.now() - DONE_VISIBLE_MS;
    return tasks
      .filter((t) => t.status !== 'DONE' || new Date(t.updated_at).getTime() > cutoff)
      .sort((a, b) => {
        if ((a.status === 'DONE') !== (b.status === 'DONE')) return a.status === 'DONE' ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tasks]);

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
            onClick={() => setComposerOpen(true)}
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
            const who = isOwner ? staffNames.get(task.receiver_id) : task.sender_id ? staffNames.get(task.sender_id) : null;
            return (
              <li
                key={task.id}
                className={cn(
                  'rounded-xl border p-3',
                  done
                    ? 'border-slate-200 opacity-60 dark:border-workshop-border'
                    : task.status === 'IN_PROGRESS'
                      ? 'border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/10'
                      : 'border-blue-300 bg-blue-50/50 dark:border-electric-blue/40 dark:bg-electric-blue/10'
                )}
              >
                <div className="flex items-start gap-2">
                  <p
                    className={cn(
                      'min-w-0 flex-1 whitespace-pre-wrap text-base font-semibold text-slate-900 dark:text-slate-100',
                      done && 'line-through'
                    )}
                  >
                    {task.message_text}
                  </p>
                  {isOwner && (
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
                  <span className="font-semibold">{STATUS_LABELS_HR[task.status]}</span>
                  {who && <span>{isOwner ? `→ ${who}` : who}</span>}
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

                {!done && (task.receiver_id === currentUserId || isOwner) && (
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

      {composerOpen && (
        <TaskComposer
          open
          onClose={() => setComposerOpen(false)}
          tenantId={tenantId}
          currentUserId={currentUserId}
          staff={receivers}
          onSent={(task) => setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]))}
        />
      )}
    </Card>
  );
}
