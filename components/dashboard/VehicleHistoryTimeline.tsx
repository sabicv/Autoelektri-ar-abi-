'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronRight, FileText, Search, Wrench } from 'lucide-react';
import { jobTotal } from '@/lib/finance';
import Badge from '@/components/ui/Badge';
import { JOB_STATUS_BADGE_VARIANT } from './JobBadges';
import type { LightboxPhoto } from './PhotoLightbox';
import { formatEuroHR, JOB_STATUS_LABELS_HR, PHOTO_TAG_LABELS_HR } from '@/lib/format';
import type { DiagnosticReport, Job } from '@/types/database';

const PhotoLightbox = dynamic(() => import('./PhotoLightbox'), { ssr: false });

export interface TimelinePhoto extends LightboxPhoto {
  isPdf: boolean;
}

interface VehicleHistoryTimelineProps {
  jobs: Job[];
  reportsByJobId: Map<string, DiagnosticReport[]>;
  photosByJobId: Record<string, TimelinePhoto[]>;
  showCosts: boolean;
}

const THUMBS_PER_JOB = 6;

export default function VehicleHistoryTimeline({ jobs, reportsByJobId, photosByJobId, showCosts }: VehicleHistoryTimelineProps) {
  const [dtcQuery, setDtcQuery] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filteredJobs = useMemo(() => {
    const query = dtcQuery.trim().toUpperCase();
    if (!query) return jobs;
    return jobs.filter((job) =>
      (reportsByJobId.get(job.id) ?? []).some((r) => r.dtc_codes.some((code) => code.toUpperCase().includes(query)))
    );
  }, [jobs, dtcQuery, reportsByJobId]);

  // One lightbox for the whole vehicle, newest first, so swiping walks
  // back through its entire photo history.
  const allImages = useMemo(
    () => filteredJobs.flatMap((job) => (photosByJobId[job.id] ?? []).filter((p) => !p.isPdf)),
    [filteredJobs, photosByJobId]
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
        <input
          value={dtcQuery}
          onChange={(e) => setDtcQuery(e.target.value)}
          placeholder="Traži DTC kod"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
        />
      </div>

      {filteredJobs.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          {dtcQuery ? `Nema naloga s kodom "${dtcQuery}".` : 'Još nema naloga za ovo vozilo.'}
        </p>
      ) : (
        <ol className="relative ml-2 space-y-6 border-l-2 border-slate-200 pl-5 dark:border-workshop-border">
          {filteredJobs.map((job) => {
            const codes = Array.from(new Set((reportsByJobId.get(job.id) ?? []).flatMap((r) => r.dtc_codes)));
            const photos = photosByJobId[job.id] ?? [];
            const shown = photos.slice(0, THUMBS_PER_JOB);

            return (
              <li key={job.id} className="relative">
                <span className="absolute -left-[29px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400 dark:border-workshop-dark dark:bg-slate-500" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {new Date(job.created_at).toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <Badge variant={JOB_STATUS_BADGE_VARIANT[job.status]} className="mt-1">
                      {JOB_STATUS_LABELS_HR[job.status]}
                    </Badge>
                  </div>
                  {showCosts && jobTotal(job) > 0 && (
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatEuroHR(jobTotal(job))}
                    </span>
                  )}
                </div>

                {codes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {codes.map((code) => (
                      <span key={code} className="rounded-full bg-electric-blue/10 px-2.5 py-1 text-xs font-bold text-electric-blue">
                        {code}
                      </span>
                    ))}
                  </div>
                )}

                {job.diagnostic_notes && (
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{job.diagnostic_notes}</p>
                )}
                {job.work_summary && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <Wrench className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
                    {job.work_summary}
                  </p>
                )}

                {shown.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {shown.map((photo, i) => {
                      const extra = i === THUMBS_PER_JOB - 1 ? photos.length - THUMBS_PER_JOB : 0;
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          aria-label={PHOTO_TAG_LABELS_HR[photo.tag]}
                          onClick={() =>
                            photo.isPdf
                              ? photo.url && window.open(photo.url, '_blank', 'noopener')
                              : setLightboxIndex(allImages.findIndex((p) => p.id === photo.id))
                          }
                          className="press-effect relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-workshop-border dark:bg-workshop-surface-hover"
                        >
                          {photo.isPdf || !photo.url ? (
                            <FileText className="h-6 w-6 text-slate-400" strokeWidth={1.5} />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                          {extra > 0 && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-bold text-white">
                              +{extra}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="mt-2 inline-flex min-h-[48px] items-center gap-1 text-sm font-semibold text-blue-600 dark:text-electric-blue"
                >
                  Otvori nalog <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {lightboxIndex !== null && lightboxIndex >= 0 && (
        <PhotoLightbox photos={allImages} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
