'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Car, ChevronRight, Clock, Lock, Zap } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { daysSince, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import type { Job, JobStatus } from '@/types/database';

interface JobCardProps {
  job: Job;
  clientName: string;
  vehicle: { make: string | null; model: string | null; registration_plate: string | null };
}

const STATUS_BADGE_VARIANT: Record<JobStatus, BadgeVariant> = {
  PENDING_TRIAGE: 'neutral',
  IN_DIAGNOSTIC: 'diagnostic',
  PARASITIC_DRAIN_TESTING: 'diagnostic',
  AWAITING_MODULE_REMAP: 'diagnostic',
  IN_REPAIR: 'progress',
  FINISHED_AWAITING_PICKUP: 'collected',
  COLLECTED: 'collected',
};

export default function JobCard({ job, clientName, vehicle }: JobCardProps) {
  const daysParked = job.finished_at ? daysSince(job.finished_at) : 0;
  const showParkedDuration = job.status === 'FINISHED_AWAITING_PICKUP' && daysParked > 0;

  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 350, damping: 32 }}>
      <Link href={`/dashboard/jobs/${job.id}`}>
        <Card hoverLift className="press-effect flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={STATUS_BADGE_VARIANT[job.status]}>{JOB_STATUS_LABELS_HR[job.status]}</Badge>
              {job.is_emergency && (
                <Badge variant="emergency">
                  <Zap className="h-3 w-3" strokeWidth={2.5} /> HITNO
                </Badge>
              )}
              {job.confirmed_at && (
                <Badge variant="neutral">
                  <Lock className="h-3 w-3" strokeWidth={2.5} />
                </Badge>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 truncate text-base font-bold text-slate-900 dark:text-slate-100">
              <Car className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
              {vehicleLabel(vehicle)}
            </p>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{clientName}</p>
            {showParkedDuration && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                Vozilo parkirano {daysParked} {daysParked === 1 ? 'dan' : 'dana'}
              </p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300 dark:text-slate-600" strokeWidth={2} />
        </Card>
      </Link>
    </motion.div>
  );
}
