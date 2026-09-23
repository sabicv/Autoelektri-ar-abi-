'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Car, ChevronDown, KeyRound, Phone, Wrench, Zap } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/components/ui/Card';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import VoiceWorkLogger from './VoiceWorkLogger';
import JobPhotoVault from './JobPhotoVault';
import NotificationDraftModal, { type NotificationType } from './NotificationDraftModal';
import SmartLockboxModal from './SmartLockboxModal';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { daysSince, formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { JOB_STATUSES, type Job, type JobStatus, type JobUpdate } from '@/types/database';

interface JobCardProps {
  job: Job;
  clientName: string;
  clientPhone: string;
  vehicle: { make: string | null; model: string | null; registration_plate: string | null };
  freeParkingDays: number;
  dailyParkingFee: number;
  onUpdated?: (job: Job) => void;
}

const STATUS_BADGE_VARIANT: Record<JobStatus, BadgeVariant> = {
  PENDING_TRIAGE: 'neutral',
  IN_DIAGNOSTIC: 'diagnostic',
  PARASITIC_DRAIN_TESTING: 'diagnostic',
  AWAITING_MODULE_REMAP: 'progress',
  IN_REPAIR: 'progress',
  FINISHED_AWAITING_PICKUP: 'progress',
  COLLECTED: 'collected',
};

export default function JobCard({
  job,
  clientName,
  clientPhone,
  vehicle,
  freeParkingDays,
  dailyParkingFee,
  onUpdated,
}: JobCardProps) {
  const [currentJob, setCurrentJob] = useState(job);
  const [expanded, setExpanded] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType | null>(null);
  const [lockboxOpen, setLockboxOpen] = useState(false);

  const hasParkingAlarm = currentJob.accrued_parking_fees > 0;
  const totalCost = currentJob.total_labor_cost + currentJob.total_parts_cost + currentJob.accrued_parking_fees;
  const daysParked = currentJob.finished_at ? daysSince(currentJob.finished_at) : 0;
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
        {hasParkingAlarm && (
          <div className="flex items-center justify-between gap-2 bg-alarm-red px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <Badge variant="alarm" pulse className="bg-white/20 text-white">
                ALARM
              </Badge>
              <span className="text-xs font-semibold">
                {daysParked} {daysParked === 1 ? 'dan' : 'dana'} parkirano
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tabular-nums">{formatEuroHR(currentJob.accrued_parking_fees)}</span>
              <button
                type="button"
                onClick={() => setNotificationType('PARKING_WARNING')}
                className="press-effect flex min-h-[36px] items-center gap-1 rounded-lg bg-white/20 px-2.5 text-xs font-bold hover:bg-white/30"
              >
                <Bell className="h-3.5 w-3.5" strokeWidth={2} /> Upozori
              </button>
            </div>
          </div>
        )}

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
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Rad" value={formatEuroHR(currentJob.total_labor_cost)} />
                  <Stat label="Dijelovi" value={formatEuroHR(currentJob.total_parts_cost)} />
                  <Stat label="Ležarina" value={formatEuroHR(currentJob.accrued_parking_fees)} />
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
                    <Wrench className="h-4 w-4" strokeWidth={2} /> Zapis rada
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
            {JOB_STATUSES.map((status) => (
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
            freeParkingDays,
            dailyParkingFee,
            daysParked,
            accruedFee: currentJob.accrued_parking_fees,
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
