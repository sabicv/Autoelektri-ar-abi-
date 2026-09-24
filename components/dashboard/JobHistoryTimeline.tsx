import { History } from 'lucide-react';
import type { JobEvent } from '@/types/database';

const ACTOR_LABELS_HR: Record<JobEvent['actor'], string> = {
  system: 'Sustav',
  mechanic: 'Mehaničar',
  client: 'Klijent',
};

export default function JobHistoryTimeline({ events }: { events: JobEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Još nema zabilježenih događaja.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-workshop-surface-hover">
            <History className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 dark:border-workshop-border">
            <p className="text-sm text-slate-800 dark:text-slate-200">{event.message ?? event.event_type}</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              {ACTOR_LABELS_HR[event.actor]} ·{' '}
              {new Date(event.created_at).toLocaleString('hr-HR', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
