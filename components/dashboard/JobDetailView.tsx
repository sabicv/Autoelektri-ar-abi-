'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  Boxes,
  Car,
  CheckCircle2,
  History,
  KeyRound,
  Lock,
  Phone,
  Printer,
  Stethoscope,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import ClientVehicleEditor from './ClientVehicleEditor';
import CostEditor from './CostEditor';
import DiagnosticWorkbench from './DiagnosticWorkbench';
import PartsSearchLinks from './PartsSearchLinks';
import VoiceWorkLogger from './VoiceWorkLogger';
import JobPhotoVault from './JobPhotoVault';
import JobPhotoUploader from './JobPhotoUploader';
import JobHistoryTimeline from './JobHistoryTimeline';
import NotificationDraftModal, { type NotificationType } from './NotificationDraftModal';
import SmartLockboxModal from './SmartLockboxModal';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { daysSince, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { JOB_STATUSES, type Client, type Job, type JobEvent, type JobStatus, type JobUpdate, type Vehicle } from '@/types/database';

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

interface JobDetailViewProps {
  job: Job;
  client: Client;
  vehicle: Vehicle;
  events: JobEvent[];
}

export default function JobDetailView({ job, client, vehicle, events }: JobDetailViewProps) {
  const [currentJob, setCurrentJob] = useState(job);
  const [currentClient, setCurrentClient] = useState(client);
  const [currentVehicle, setCurrentVehicle] = useState(vehicle);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType | null>(null);
  const [lockboxOpen, setLockboxOpen] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);

  const locked = currentJob.confirmed_at !== null;
  const totalCost = currentJob.total_labor_cost + currentJob.total_parts_cost + currentJob.accrued_parking_fees;
  const daysParked = currentJob.finished_at ? daysSince(currentJob.finished_at) : 0;
  const showParkedDuration = currentJob.status === 'FINISHED_AWAITING_PICKUP' && daysParked > 0;
  const clientFirstName = currentClient.first_name;

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

    const { data, error } = await supabase.from('jobs').update(patch).eq('id', currentJob.id).select('*').single();

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
  }

  async function handleConfirm() {
    if (!window.confirm('Potvrditi i zaključati nalog? Podaci (klijent, vozilo, dijagnoza, cijena) se nakon toga više neće moći mijenjati.')) {
      return;
    }

    setIsConfirming(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from('jobs')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', currentJob.id)
      .select('*')
      .single();

    setIsConfirming(false);

    if (error || !data) {
      toast.error('Potvrda naloga nije uspjela.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: currentJob.tenant_id,
      job_id: currentJob.id,
      event_type: 'JOB_CONFIRMED',
      actor: 'mechanic',
      message: 'Nalog potvrđen i zaključan.',
      metadata: {},
    });

    setCurrentJob(data);
    toast.success('Nalog je potvrđen i zaključan.');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Natrag na poslove
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_BADGE_VARIANT[currentJob.status]}>{JOB_STATUS_LABELS_HR[currentJob.status]}</Badge>
          {currentJob.is_emergency && (
            <Badge variant="emergency">
              <Zap className="h-3 w-3" strokeWidth={2.5} /> HITNO
            </Badge>
          )}
          {locked && (
            <Badge variant="neutral">
              <Lock className="h-3 w-3" strokeWidth={2.5} /> Zaključano
            </Badge>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
          <Car className="h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={2} />
          {vehicleLabel(currentVehicle)}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <User className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
          {currentClient.first_name} {currentClient.last_name}
        </p>
        {showParkedDuration && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Vozilo parkirano {daysParked} {daysParked === 1 ? 'dan' : 'dana'}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`tel:${currentClient.phone_number}`}
            className="press-effect inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
          >
            <Phone className="h-4 w-4" strokeWidth={2} /> Nazovi
          </a>
          <Button variant="secondary" size="sm" onClick={() => setStatusDrawerOpen(true)}>
            Promijeni status
          </Button>
          <a
            href={`/dashboard/jobs/${currentJob.id}/nalog`}
            target="_blank"
            rel="noopener noreferrer"
            className="press-effect inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
          >
            <Printer className="h-4 w-4" strokeWidth={2} /> Radni nalog
          </a>
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
      </Card>

      {!locked && (
        <Card className="flex items-center justify-between gap-3 border-2 border-blue-200 bg-blue-50/50 p-4 dark:border-electric-blue/30 dark:bg-electric-blue/5">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Nalog je u statusu nacrta — sve se može mijenjati. Potvrdi kad su podaci konačni.
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="press-effect flex min-h-[44px] flex-shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Potvrdi nalog
          </button>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <User className="h-4 w-4" strokeWidth={2} /> Klijent i vozilo
        </h2>
        <ClientVehicleEditor
          jobId={currentJob.id}
          tenantId={currentJob.tenant_id}
          client={currentClient}
          vehicle={currentVehicle}
          symptoms={currentJob.symptoms}
          isEmergency={currentJob.is_emergency}
          locked={locked}
          onSaved={(data) => {
            setCurrentClient(data.client);
            setCurrentVehicle(data.vehicle);
            setCurrentJob((prev) => ({ ...prev, symptoms: data.symptoms, is_emergency: data.isEmergency }));
          }}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Cijena</h2>
        <CostEditor
          jobId={currentJob.id}
          tenantId={currentJob.tenant_id}
          initialLaborCost={currentJob.total_labor_cost}
          initialPartsCost={currentJob.total_parts_cost}
          locked={locked}
          onSaved={(laborCost, partsCost) =>
            setCurrentJob((prev) => ({ ...prev, total_labor_cost: laborCost, total_parts_cost: partsCost }))
          }
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Stethoscope className="h-4 w-4" strokeWidth={2} /> Dijagnostička radna ploča
        </h2>
        <DiagnosticWorkbench
          jobId={currentJob.id}
          tenantId={currentJob.tenant_id}
          initialDiagnosticNotes={currentJob.diagnostic_notes}
          locked={locked}
          onSaved={(notes) => setCurrentJob((prev) => ({ ...prev, diagnostic_notes: notes }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Boxes className="h-4 w-4" strokeWidth={2} /> Traži dio kod dobavljača
        </h2>
        <PartsSearchLinks />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Wrench className="h-4 w-4" strokeWidth={2} /> Izvedeni radovi i sažetak
        </h2>
        <VoiceWorkLogger
          jobId={currentJob.id}
          tenantId={currentJob.tenant_id}
          initialWorkSummary={currentJob.work_summary}
          locked={locked}
          onSaved={(summary) => setCurrentJob((prev) => ({ ...prev, work_summary: summary }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-200">Foto arhiv</h2>
        <div className="space-y-3">
          <JobPhotoVault key={photoRefreshKey} jobId={currentJob.id} allowDelete={!locked} />
          <JobPhotoUploader
            jobId={currentJob.id}
            tenantId={currentJob.tenant_id}
            onUploaded={() => setPhotoRefreshKey((k) => k + 1)}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <History className="h-4 w-4" strokeWidth={2} /> Povijest naloga
        </h2>
        <JobHistoryTimeline events={events} />
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
            vehicleLabel: vehicleLabel(currentVehicle),
            totalAmount: totalCost,
          }}
        />
      )}

      {lockboxOpen && (
        <SmartLockboxModal open onClose={() => setLockboxOpen(false)} job={{ id: currentJob.id, clientFirstName }} />
      )}
    </div>
  );
}
