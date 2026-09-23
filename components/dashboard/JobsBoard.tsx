'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import JobCard from './JobCard';
import { cn } from '@/lib/utils';
import type { Client, Job, Vehicle } from '@/types/database';

type Filter = 'ACTIVE' | 'ALARM' | 'COLLECTED' | 'ALL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ACTIVE', label: 'Aktivno' },
  { key: 'ALARM', label: 'Ležarina' },
  { key: 'COLLECTED', label: 'Završeno' },
  { key: 'ALL', label: 'Sve' },
];

interface JobsBoardProps {
  jobs: Job[];
  clients: Client[];
  vehicles: Vehicle[];
  freeParkingDays: number;
  dailyParkingFee: number;
}

export default function JobsBoard({ jobs, clients, vehicles, freeParkingDays, dailyParkingFee }: JobsBoardProps) {
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [jobList, setJobList] = useState(jobs);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const filteredJobs = useMemo(() => {
    switch (filter) {
      case 'ACTIVE':
        return jobList.filter((j) => j.status !== 'COLLECTED');
      case 'ALARM':
        return jobList.filter((j) => j.accrued_parking_fees > 0);
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
                    freeParkingDays={freeParkingDays}
                    dailyParkingFee={dailyParkingFee}
                    onUpdated={handleJobUpdated}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
