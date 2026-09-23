'use client';

import { useMemo, useState } from 'react';
import { Search, Wrench } from 'lucide-react';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import JobPhotoVault from './JobPhotoVault';
import { formatEuroHR, JOB_STATUS_LABELS_HR } from '@/lib/format';
import type { DiagnosticReport, Job, JobStatus } from '@/types/database';

const STATUS_BADGE_VARIANT: Record<JobStatus, BadgeVariant> = {
  PENDING_TRIAGE: 'neutral',
  IN_DIAGNOSTIC: 'diagnostic',
  PARASITIC_DRAIN_TESTING: 'diagnostic',
  AWAITING_MODULE_REMAP: 'diagnostic',
  IN_REPAIR: 'progress',
  FINISHED_AWAITING_PICKUP: 'collected',
  COLLECTED: 'collected',
};

interface VehicleHistoryTimelineProps {
  jobs: Job[];
  reportsByJobId: Map<string, DiagnosticReport[]>;
}

export default function VehicleHistoryTimeline({ jobs, reportsByJobId }: VehicleHistoryTimelineProps) {
  const [dtcQuery, setDtcQuery] = useState('');

  const filteredJobs = useMemo(() => {
    const query = dtcQuery.trim().toUpperCase();
    if (!query) return jobs;

    return jobs.filter((job) => {
      const reports = reportsByJobId.get(job.id) ?? [];
      return reports.some((r) => r.dtc_codes.some((code) => code.toUpperCase().includes(query)));
    });
  }, [jobs, dtcQuery, reportsByJobId]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
        <input
          value={dtcQuery}
          onChange={(e) => setDtcQuery(e.target.value)}
          placeholder="Pretraži povijest po DTC kodu (npr. P0300)..."
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
        />
      </div>

      {filteredJobs.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {dtcQuery ? `Nema naloga s DTC kodom koji sadrži "${dtcQuery}".` : 'Nema zabilježenih naloga za ovo vozilo.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const reports = reportsByJobId.get(job.id) ?? [];
            const allCodes = Array.from(new Set(reports.flatMap((r) => r.dtc_codes)));
            const totalCost = job.total_labor_cost + job.total_parts_cost + job.accrued_parking_fees;

            return (
              <Card key={job.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[job.status]}>{JOB_STATUS_LABELS_HR[job.status]}</Badge>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {new Date(job.created_at).toLocaleDateString('hr-HR')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {formatEuroHR(totalCost)}
                  </span>
                </div>

                {allCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded-full bg-electric-blue/10 px-2.5 py-1 text-xs font-bold text-electric-blue"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}

                {job.diagnostic_notes && (
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Dijagnoza:</span> {job.diagnostic_notes}
                  </p>
                )}

                {job.work_summary && (
                  <p className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <Wrench className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
                    {job.work_summary}
                  </p>
                )}

                <JobPhotoVault jobId={job.id} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
