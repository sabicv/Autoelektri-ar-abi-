'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Lock, Zap } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { daysSince, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import { cn } from '@/lib/utils';
import type { Job, JobStatus } from '@/types/database';
import { JOB_STATUS_BADGE_VARIANT, JOB_STATUS_BORDER_CLASS, PaymentChip } from './JobBadges';

const FINISHED_STATUSES: JobStatus[] = ['FINISHED_AWAITING_PICKUP', 'COLLECTED'];

interface JobCardProps {
  job: Job;
  clientName: string;
  vehicle: { make: string | null; model: string | null; registration_plate: string | null };
}

// Left: what and whose. Right: state. The left stripe repeats the status
// colour so a scrolled list reads at a glance; HITNO always wins.
export default function JobCard({ job, clientName, vehicle }: JobCardProps) {
  const daysParked = job.finished_at ? daysSince(job.finished_at) : 0;
  const showParkedDuration = job.status === 'FINISHED_AWAITING_PICKUP' && daysParked > 0;
  // Mechanics get money fields zeroed server-side, so this only ever shows for owners.
  const unpaid = job.payment_status === 'UNPAID' && jobTotal(job) > 0 && FINISHED_STATUSES.includes(job.status);

  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 350, damping: 32 }}>
      <Link href={`/dashboard/jobs/${job.id}`}>
        <Card
          hoverLift
          className={cn(
            'press-effect border-l-4 p-4',
            job.is_emergency ? 'border-l-alarm-red' : JOB_STATUS_BORDER_CLASS[job.status]
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-base font-bold text-slate-900 dark:text-slate-100">{vehicleLabel(vehicle)}</p>
            <Badge variant={JOB_STATUS_BADGE_VARIANT[job.status]} className="flex-shrink-0">
              {JOB_STATUS_LABELS_HR[job.status]}
            </Badge>
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-slate-500 dark:text-slate-300">{clientName}</p>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {job.confirmed_at && <Lock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} aria-label="Zaključano" />}
              {unpaid && <PaymentChip status="UNPAID" />}
              {job.is_emergency && (
                <Badge variant="emergency">
                  <Zap className="h-3 w-3" strokeWidth={2.5} /> HITNO
                </Badge>
              )}
            </div>
          </div>

          {showParkedDuration && (
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
              Čeka preuzimanje {daysParked} {daysParked === 1 ? 'dan' : 'dana'}
            </p>
          )}
        </Card>
      </Link>
    </motion.div>
  );
}
