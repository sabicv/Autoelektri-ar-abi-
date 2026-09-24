'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, Plus } from 'lucide-react';
import JobCard from './JobCard';
import NewJobModal from './NewJobModal';
import { cn } from '@/lib/utils';
import type { Client, Job, Vehicle } from '@/types/database';

type Filter = 'ACTIVE' | 'DIAGNOSTIC' | 'READY' | 'COLLECTED' | 'ALL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ACTIVE', label: 'Aktivno' },
  { key: 'DIAGNOSTIC', label: 'U dijagnostici' },
  { key: 'READY', label: 'Spremno' },
  { key: 'COLLECTED', label: 'Preuzeto' },
  { key: 'ALL', label: 'Sve' },
];

const DIAGNOSTIC_STATUSES: Job['status'][] = ['IN_DIAGNOSTIC', 'PARASITIC_DRAIN_TESTING', 'AWAITING_MODULE_REMAP'];

interface JobsBoardProps {
  jobs: Job[];
  clients: Client[];
  vehicles: Vehicle[];
}

export default function JobsBoard({ jobs, clients, vehicles }: JobsBoardProps) {
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [jobList, setJobList] = useState(jobs);
  const [newJobOpen, setNewJobOpen] = useState(false);

  // Keep local state in sync when the server refetches (e.g. after
  // creating a new job triggers router.refresh()) — useState's initial
  // value only applies on first mount, so without this a freshly created
  // job wouldn't appear until a full page reload.
  useEffect(() => {
    setJobList(jobs);
  }, [jobs]);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const filteredJobs = useMemo(() => {
    switch (filter) {
      case 'ACTIVE':
        return jobList.filter((j) => j.status !== 'COLLECTED');
      case 'DIAGNOSTIC':
        return jobList.filter((j) => DIAGNOSTIC_STATUSES.includes(j.status));
      case 'READY':
        return jobList.filter((j) => j.status === 'FINISHED_AWAITING_PICKUP');
      case 'COLLECTED':
        return jobList.filter((j) => j.status === 'COLLECTED');
      case 'ALL':
      default:
        return jobList;
    }
  }, [jobList, filter]);

  function handleJobUpdated(updated: Job) {
    setJobList((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setNewJobOpen(true)}
        className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
      >
        <Plus className="h-5 w-5" strokeWidth={2} /> Novi nalog
      </button>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-workshop-surface">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'press-effect min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors',
              filter === f.key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-workshop-surface-hover dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-16 text-slate-400 dark:border-workshop-border">
          <Inbox className="h-8 w-8" strokeWidth={2} />
          <p className="text-sm">Nema poslova u ovoj kategoriji.</p>
        </div>
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence initial={false}>
            {filteredJobs.map((job) => {
              const client = clientMap.get(job.client_id);
              const vehicle = vehicleMap.get(job.vehicle_id);
              if (!client || !vehicle) return null;

              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <JobCard
                    job={job}
                    clientName={`${client.first_name} ${client.last_name}`}
                    clientPhone={client.phone_number}
                    vehicle={vehicle}
                    onUpdated={handleJobUpdated}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <NewJobModal open={newJobOpen} onClose={() => setNewJobOpen(false)} />
    </div>
  );
}
