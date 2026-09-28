'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Bell,
  Boxes,
  Camera,
  Car,
  ClipboardList,
  ChevronRight,
  Euro,
  History,
  KeyRound,
  LifeBuoy,
  Lock,
  MoreHorizontal,
  Phone,
  Printer,
  RefreshCw,
  Stethoscope,
  User,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CollapsibleCard from '@/components/ui/CollapsibleCard';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import { JOB_STATUS_BADGE_VARIANT, PaymentChip } from './JobBadges';
import ClientVehicleEditor from './ClientVehicleEditor';
import CostEditor from './CostEditor';
import PaymentStatusControl from './PaymentStatusControl';
import DiagnosticWorkbench from './DiagnosticWorkbench';
import PartsSearchLinks from './PartsSearchLinks';
import VoiceWorkLogger from './VoiceWorkLogger';
import JobPhotoVault from './JobPhotoVault';
import JobPhotoUploader from './JobPhotoUploader';
import JobHistoryTimeline from './JobHistoryTimeline';
import type { NotificationType } from './NotificationDraftModal';
import type { SectionHandle } from './sectionHandle';
import type { StaffOption } from './tasks/TaskComposer';
import JobMessages from './tasks/JobMessages';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { daysSince, formatEuroHR, JOB_STATUS_LABELS_HR, vehicleLabel } from '@/lib/format';
import { jobTotal, redactJobForRole } from '@/lib/finance';
import { SYMPTOM_OPTIONS } from '@/lib/validation/triage';
import { cn } from '@/lib/utils';
import type { Client, Job, JobEvent, JobStatus, JobUpdate, MechanicTask, StaffRole, Vehicle } from '@/types/database';

// Opened on demand only — kept out of the job page's initial bundle.
const NotificationDraftModal = dynamic(() => import('./NotificationDraftModal'), { ssr: false });
const SmartLockboxModal = dynamic(() => import('./SmartLockboxModal'), { ssr: false });
const TaskComposer = dynamic(() => import('./tasks/TaskComposer'), { ssr: false });
const HelpRequestSheet = dynamic(() => import('./tasks/HelpRequestSheet'), { ssr: false });

const SELECTABLE_JOB_STATUSES: JobStatus[] = [
  'PENDING_TRIAGE',
  'IN_DIAGNOSTIC',
  'PARASITIC_DRAIN_TESTING',
  'IN_REPAIR',
  'WAITING_PARTS',
  'FINISHED_AWAITING_PICKUP',
  'COLLECTED',
];

const DIAGNOSTIC_PHASE_STATUSES: JobStatus[] = ['IN_DIAGNOSTIC', 'PARASITIC_DRAIN_TESTING', 'AWAITING_MODULE_REMAP'];

const SYMPTOM_LABELS = new Map<string, string>(SYMPTOM_OPTIONS.map((o) => [o.code, o.label]));

interface JobDetailViewProps {
  job: Job;
  client: Client;
  vehicle: Vehicle;
  events: JobEvent[];
  viewerRole: StaffRole;
  currentUserId: string;
  staff: StaffOption[];
  staffNames: Record<string, string>;
  messages: MechanicTask[];
  openMessages: boolean;
}

export default function JobDetailView({
  job,
  client,
  vehicle,
  events,
  viewerRole,
  currentUserId,
  staff,
  staffNames,
  messages: initialMessages,
  openMessages,
}: JobDetailViewProps) {
  const isOwner = viewerRole === 'owner';
  const [currentJob, setCurrentJob] = useState(job);
  const [currentClient, setCurrentClient] = useState(client);
  const [currentVehicle, setCurrentVehicle] = useState(vehicle);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [notificationType, setNotificationType] = useState<NotificationType | null>(null);
  const [lockboxOpen, setLockboxOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const diagnosticRef = useRef<SectionHandle>(null);
  const workRef = useRef<SectionHandle>(null);
  const costRef = useRef<SectionHandle>(null);
  const detailsRef = useRef<SectionHandle>(null);

  const locked = currentJob.confirmed_at !== null;
  const totalCost = jobTotal(currentJob);
  const daysParked = currentJob.finished_at ? daysSince(currentJob.finished_at) : 0;
  const showParkedDuration = currentJob.status === 'FINISHED_AWAITING_PICKUP' && daysParked > 0;
  const clientFirstName = currentClient.first_name;
  const isFinished = currentJob.status === 'FINISHED_AWAITING_PICKUP';
  const isDiagnosticPhase = DIAGNOSTIC_PHASE_STATUSES.includes(currentJob.status);

  const symptomSummary = currentJob.symptoms.map((code) => SYMPTOM_LABELS.get(code) ?? code).join(', ');

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

    setCurrentJob(redactJobForRole(data, viewerRole));
    toast.success(`Status: ${JOB_STATUS_LABELS_HR[newStatus]}`);
  }

  // Saves only the sections that actually changed. null = nothing to save.
  async function saveChangedSections(): Promise<boolean | null> {
    const dirty = [diagnosticRef, workRef, costRef, detailsRef]
      .map((r) => r.current)
      .filter((s): s is SectionHandle => s !== null && s.isDirty());
    if (dirty.length === 0) return null;

    for (const section of dirty) {
      if (!(await section.save())) return false;
    }
    return true;
  }

  async function handleSave() {
    setIsSaving(true);
    const result = await saveChangedSections();
    setIsSaving(false);
    // Photos are stored the moment they're added, so "nothing pending" is a
    // confirmation, not an error.
    if (result !== false) toast.success(result === null ? 'Sve je spremljeno.' : 'Promjene spremljene.');
  }

  async function handleConfirm() {
    if (!window.confirm('Zaključati nalog? Nakon toga se podaci više ne mogu mijenjati.')) {
      return;
    }

    setIsConfirming(true);
    if ((await saveChangedSections()) === false) {
      setIsConfirming(false);
      return;
    }

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

    setCurrentJob(redactJobForRole(data, viewerRole));
    toast.success('Nalog je zaključan.');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <Link
        href="/dashboard/jobs"
        className="inline-flex min-h-[48px] items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Natrag na poslove
      </Link>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={JOB_STATUS_BADGE_VARIANT[currentJob.status]}>{JOB_STATUS_LABELS_HR[currentJob.status]}</Badge>
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
          {isOwner && totalCost > 0 && <PaymentChip status={currentJob.payment_status} />}
        </div>

        <Link
          href={`/dashboard/vehicles/${currentVehicle.id}`}
          className="mt-2 flex items-center gap-1.5 text-lg font-bold text-slate-900 dark:text-slate-100"
        >
          <Car className="h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={2} />
          <span className="truncate">{vehicleLabel(currentVehicle)}</span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" strokeWidth={2} />
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-300">
          <User className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
          {currentClient.first_name} {currentClient.last_name}
        </p>
        {symptomSummary && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{symptomSummary}</p>}
        {showParkedDuration && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">
            Vozilo parkirano {daysParked} {daysParked === 1 ? 'dan' : 'dana'}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <a
            href={`tel:${currentClient.phone_number}`}
            className="press-effect inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
          >
            <Phone className="h-4 w-4" strokeWidth={2} /> Nazovi
          </a>
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setStatusDrawerOpen(true)}>
            <RefreshCw className="h-4 w-4" strokeWidth={2} /> Status
          </Button>
          <Button variant="secondary" size="sm" className="px-3" aria-label="Više radnji" onClick={() => setMoreOpen(true)}>
            <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
          </Button>
        </div>

        {isDiagnosticPhase && (
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setNotificationType('DIAGNOSTIC_COMPLETE')}>
            <Stethoscope className="h-4 w-4" strokeWidth={2} /> Dijagnoza gotova — obavijesti klijenta
          </Button>
        )}
        {isFinished && isOwner && (
          <Button variant="primary" size="sm" className="mt-2 w-full" onClick={() => setNotificationType('JOB_FINISHED')}>
            <Bell className="h-4 w-4" strokeWidth={2} /> Obavijesti klijenta da je gotovo
          </Button>
        )}
        {!isOwner && (
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="press-effect mt-2 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 border-alarm-red text-base font-semibold text-alarm-red dark:border-red-400 dark:text-red-400"
          >
            <LifeBuoy className="h-5 w-5" strokeWidth={2} /> Trebam pomoć
          </button>
        )}

        <div className="mt-1 flex justify-end">
          <JobMessages
            messages={messages}
            onMessagesChange={setMessages}
            staffNames={staffNames}
            receivers={staff}
            role={viewerRole}
            currentUserId={currentUserId}
            tenantId={currentJob.tenant_id}
            jobId={currentJob.id}
            jobLabel={vehicleLabel(currentVehicle)}
            defaultOpen={openMessages}
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Stethoscope className="h-4 w-4" strokeWidth={2} /> Dijagnostika
        </h2>
        <DiagnosticWorkbench
          ref={diagnosticRef}
          jobId={currentJob.id}
          tenantId={currentJob.tenant_id}
          initialDiagnosticNotes={currentJob.diagnostic_notes}
          locked={locked}
          onSaved={(notes) => setCurrentJob((prev) => ({ ...prev, diagnostic_notes: notes }))}
        />
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Wrench className="h-4 w-4" strokeWidth={2} /> Izvedeni radovi
        </h2>
        <VoiceWorkLogger
          ref={workRef}
          jobId={currentJob.id}
          tenantId={currentJob.tenant_id}
          initialWorkSummary={currentJob.work_summary}
          locked={locked}
          onSaved={(summary) => setCurrentJob((prev) => ({ ...prev, work_summary: summary }))}
        />
      </Card>

      <CollapsibleCard title="Traži dio kod dobavljača" icon={<Boxes className="h-4 w-4" strokeWidth={2} />}>
        <PartsSearchLinks />
      </CollapsibleCard>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          <Camera className="h-4 w-4" strokeWidth={2} /> Fotografije i dokumenti
        </h2>
        <div className="space-y-3">
          <JobPhotoVault key={photoRefreshKey} jobId={currentJob.id} allowDelete={!locked} />
          <JobPhotoUploader
            jobId={currentJob.id}
            tenantId={currentJob.tenant_id}
            onUploaded={() => setPhotoRefreshKey((k) => k + 1)}
          />
        </div>
      </Card>

      {isOwner && (
        <Card className="space-y-3 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
            <Euro className="h-4 w-4" strokeWidth={2} /> Cijena i plaćanje
          </h2>
          <CostEditor
            ref={costRef}
            jobId={currentJob.id}
            tenantId={currentJob.tenant_id}
            initialLaborCost={currentJob.total_labor_cost}
            initialPartsCost={currentJob.total_parts_cost}
            locked={locked}
            onSaved={(laborCost, partsCost) =>
              setCurrentJob((prev) => ({ ...prev, total_labor_cost: laborCost, total_parts_cost: partsCost }))
            }
          />
          <PaymentStatusControl job={currentJob} onChanged={(patch) => setCurrentJob((prev) => ({ ...prev, ...patch }))} />
        </Card>
      )}

      <CollapsibleCard title="Uredi klijenta i vozilo" icon={<User className="h-4 w-4" strokeWidth={2} />}>
        <ClientVehicleEditor
          ref={detailsRef}
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
      </CollapsibleCard>

      <CollapsibleCard
        title={`Povijest naloga (${events.length})`}
        icon={<History className="h-4 w-4" strokeWidth={2} />}
      >
        <JobHistoryTimeline events={events} />
      </CollapsibleCard>

      {!locked && (
        <div className="sticky bottom-0 z-20 -mx-4 flex gap-2 border-t border-slate-200 bg-slate-50/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-workshop-border dark:bg-workshop-dark/95">
          <Button
            variant="primary"
            size="sm"
            className="min-h-[52px] flex-1 whitespace-nowrap"
            isLoading={isSaving}
            disabled={isConfirming}
            onClick={handleSave}
          >
            Spremi promjene
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[52px] flex-1 whitespace-nowrap"
            isLoading={isConfirming}
            disabled={isSaving}
            onClick={handleConfirm}
          >
            Zaključaj nalog
          </Button>
        </div>
      )}

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

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerTitle className="px-4 pt-4 text-base font-bold text-slate-900 dark:text-slate-100">Više radnji</DrawerTitle>
          <div className="space-y-1 p-4 pt-3">
            <a
              href={`/dashboard/jobs/${currentJob.id}/nalog`}
              target="_blank"
              rel="noopener noreferrer"
              className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
            >
              <Printer className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
              {isOwner && totalCost > 0 ? `Radni nalog za ispis (${formatEuroHR(totalCost)})` : 'Radni nalog za ispis'}
            </a>
            <Link
              href={`/dashboard/vehicles/${currentVehicle.id}`}
              className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
            >
              <Car className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
              Povijest vozila
            </Link>
            {isFinished && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setLockboxOpen(true);
                }}
                className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
              >
                <KeyRound className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                Pametni sef (preuzimanje ključeva)
              </button>
            )}
            {isOwner && staff.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setTaskOpen(true);
                }}
                className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
              >
                <ClipboardList className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                Zadatak mehaničaru
              </button>
            )}
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

      {taskOpen && (
        <TaskComposer
          open
          onClose={() => setTaskOpen(false)}
          tenantId={currentJob.tenant_id}
          currentUserId={currentUserId}
          staff={staff}
          jobId={currentJob.id}
          jobLabel={vehicleLabel(currentVehicle)}
          onSent={(task) => setMessages((prev) => [...prev, task])}
        />
      )}

      {helpOpen && (
        <HelpRequestSheet
          open
          onClose={() => setHelpOpen(false)}
          tenantId={currentJob.tenant_id}
          jobId={currentJob.id}
          onSent={(task) => setMessages((prev) => [...prev, task])}
        />
      )}
    </div>
  );
}
