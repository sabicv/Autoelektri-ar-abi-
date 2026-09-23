'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Car, ChevronDown, Clock, KeyRound, Phone, Stethoscope, Wrench, Zap } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/components/ui/Card';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import DiagnosticWorkbench from './DiagnosticWorkbench';
import VoiceWorkLogger from './VoiceWorkLogger';
import JobPhotoVault from './JobPhotoVault';
import NotificationDraftModal, { type NotificationType } from './NotificationDraftModal';
import SmartLockboxModal from './SmartLockboxModal';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { daysSince, formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Job, JobStatus, JobUpdate } from '@/types/database';

interface JobCardProps {
  job: Job;
  clientName: string;
  clientPhone: string;
  vehicle: { make: string | null; model: string | null; registration_plate: string | null };
  onUpdated?: (job: Job) => void;
}

// Curated, repair-workflow-only status picker. AWAITING_MODULE_REMAP is
// intentionally not offered here — it now shares a label ("Test pražnjenja
// / moduli") with PARASITIC_DRAIN_TESTING, so the drawer picks one
// canonical value instead of showing two buttons with identical text.
// The enum value itself is kept for any pre-existing historical records.
const SELECTABLE_JOB_STATUSES: JobStatus[] = [
  'PENDING_TRIAGE',
  'IN_DIAGNOSTIC',
  'PARASITIC_DRAIN_TESTING',
  'IN_REPAIR',
  'FINISHED_AWAITING_PICKUP',
  'COLLECTED',
];

const STATUS_BADGE_VARIANT: Record<JobStatus, BadgeVariant> = {
  PENDING_TRIAGE: 'neutral',
  IN_DIAGNOSTIC: 'diagnostic',
  PARASITIC_DRAIN_TESTING: 'diagnostic',
  AWAITING_MODULE_REMAP: 'diagnostic',
  IN_REPAIR: 'progress',
  FINISHED_AWAITING_PICKUP: 'collected',
  COLLECTED: 'collected',
};

const DIAGNOSTIC_PHASE_STATUSES: JobStatus[] = ['IN_DIAGNOSTIC', 'PARASITIC_DRAIN_TESTING', 'AWAITING_MODULE_REMAP'];

export default function JobCard({ job, clientName, clientPhone, vehicle, onUpdated }: JobCardProps) {
  const [currentJob, setCurrentJob] = useState(job);
  const [expanded, setExpanded] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType | null>(null);
  const [lockboxOpen, setLockboxOpen] = useState(false);

  const totalCost = currentJob.total_labor_cost + currentJob.total_parts_cost + currentJob.accrued_parking_fees;
  const daysParked = currentJob.finished_at ? daysSince(currentJob.finished_at) : 0;
  const showParkedDuration = currentJob.status === 'FINISHED_AWAITING_PICKUP' && daysParked > 0;
  const clientFirstName = clientName.split(' ')[0] || clientName;

  async function changeStatus(newStatus: JobStatus) {
    if (newStatus === currentJob.status) {
      setStatusDrawerOpen(false);
      return;
    }

    setIsChangingStatus(true);
    const supabase = createBrowserSupabaseClient();

    const patch: JobUpdate = { status: newStatus };
    if (newStatus === 'FINISHED_AWAITING_PICKUP' && !currentJob.finished_at) {
      patch.finished_at = new Date().toISOString();
    }
    if (newStatus === 'COLLECTED' && !currentJob.collected_at) {
      patch.collected_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(patch)
      .eq('id', currentJob.id)
      .select('*')
      .single();

    setIsChangingStatus(false);
    setStatusDrawerOpen(false);

    if (error || !data) {
      toast.error('Promjena statusa nije uspjela.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: currentJob.tenant_id,
      job_id: currentJob.id,
      event_type: 'STATUS_CHANGED',
      actor: 'mechanic',
      message: `Status promijenjen u "${JOB_STATUS_LABELS_HR[newStatus]}".`,
      metadata: { from: currentJob.status, to: newStatus },
    });

    setCurrentJob(data);
    toast.success(`Status: ${JOB_STATUS_LABELS_HR[newStatus]}`);
    onUpdated?.(data);
  }

  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 350, damping: 32 }}>
      <Card hoverLift className="overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="press-effect w-full px-4 py-4 text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={STATUS_BADGE_VARIANT[currentJob.status]}>
                  {JOB_STATUS_LABELS_HR[currentJob.status]}
                </Badge>
                {currentJob.is_emergency && (
                  <Badge variant="emergency">
                    <Zap className="h-3 w-3" strokeWidth={2.5} /> HITNO
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

            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0 pt-1">
              <ChevronDown className="h-5 w-5 text-slate-400" strokeWidth={2} />
            </motion.div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-slate-100 dark:border-workshop-border"
            >
              <div className="space-y-5 px-4 py-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Rad" value={formatEuroHR(currentJob.total_labor_cost)} />
                  <Stat label="Dijelovi" value={formatEuroHR(currentJob.total_parts_cost)} />
                  <Stat label="Ukupno" value={formatEuroHR(totalCost)} emphasis />
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`tel:${clientPhone}`}
                    className="press-effect inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
                  >
                    <Phone className="h-4 w-4" strokeWidth={2} /> Nazovi
                  </a>
                  <Button variant="secondary" size="sm" onClick={() => setStatusDrawerOpen(true)}>
                    Promijeni status
                  </Button>
                  {DIAGNOSTIC_PHASE_STATUSES.includes(currentJob.status) && (
                    <Button variant="outline" size="sm" onClick={() => setNotificationType('DIAGNOSTIC_COMPLETE')}>
                      <Stethoscope className="h-4 w-4" strokeWidth={2} /> Dijagnoza gotova
                    </Button>
                  )}
                  {currentJob.status === 'FINISHED_AWAITING_PICKUP' && (
                    <>
                      <Button variant="primary" size="sm" onClick={() => setNotificationType('JOB_FINISHED')}>
                        <Bell className="h-4 w-4" strokeWidth={2} /> Obavijesti klijenta
                      </Button>
                      <Button variant="success" size="sm" onClick={() => setLockboxOpen(true)}>
                        <KeyRound className="h-4 w-4" strokeWidth={2} /> Pametni sef
                      </Button>
                    </>
                  )}
                </div>

                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Stethoscope className="h-4 w-4" strokeWidth={2} /> Dijagnostička radna ploča
                  </h3>
                  <DiagnosticWorkbench
                    jobId={currentJob.id}
                    tenantId={currentJob.tenant_id}
                    initialDiagnosticNotes={currentJob.diagnostic_notes}
                    onSaved={(notes) => setCurrentJob((prev) => ({ ...prev, diagnostic_notes: notes }))}
                  />
                </section>

                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <Wrench className="h-4 w-4" strokeWidth={2} /> Izvedeni radovi i sažetak
                  </h3>
                  <VoiceWorkLogger
                    jobId={currentJob.id}
                    tenantId={currentJob.tenant_id}
                    initialWorkSummary={currentJob.work_summary}
                    onSaved={(summary) => setCurrentJob((prev) => ({ ...prev, work_summary: summary }))}
                  />
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-200">Foto arhiv</h3>
                  <JobPhotoVault jobId={currentJob.id} />
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Drawer open={statusDrawerOpen} onOpenChange={setStatusDrawerOpen}>
        <DrawerContent>
          <DrawerTitle className="px-4 pt-4 text-base font-bold text-slate-900 dark:text-slate-100">
            Promijeni status naloga
          </DrawerTitle>
          <div className="space-y-2 overflow-y-auto px-4 py-4">
            {SELECTABLE_JOB_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={isChangingStatus}
                onClick={() => changeStatus(status)}
                className={cn(
                  'press-effect flex min-h-[52px] w-full items-center justify-between rounded-xl border-2 px-4 text-left text-sm font-semibold disabled:opacity-50',
                  status === currentJob.status
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-electric-blue dark:bg-electric-blue/10 dark:text-electric-blue'
                    : 'border-slate-200 text-slate-700 dark:border-workshop-border dark:text-slate-200'
                )}
              >
                {JOB_STATUS_LABELS_HR[status]}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {notificationType && (
        <NotificationDraftModal
          open
          onClose={() => setNotificationType(null)}
          type={notificationType}
          tenantId={currentJob.tenant_id}
          job={{
            id: currentJob.id,
            clientFirstName,
            vehicleLabel: vehicleLabel(vehicle),
            totalAmount: totalCost,
          }}
        />
      )}

      {lockboxOpen && (
        <SmartLockboxModal
          open
          onClose={() => setLockboxOpen(false)}
          job={{ id: currentJob.id, clientFirstName }}
        />
      )}
    </motion.div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('font-bold text-slate-900 dark:text-slate-100', emphasis && 'text-blue-600 dark:text-electric-blue')}>
        {value}
      </p>
    </div>
  );
}
