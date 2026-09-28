'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Car, ChevronDown, Loader2, Mic, MicOff, Phone, Send, User, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import PhotoUploadDropzone, { type UploadedPhoto } from '@/components/triage/PhotoUploadDropzone';
import RegistrationScanner, { type ExtractedFields } from './RegistrationScanner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { COUNTRY_CODES, SYMPTOM_OPTIONS, type SymptomCode } from '@/lib/validation/triage';
import { existingVehicleJobSchema, newClientSchema, newJobSchema } from '@/lib/validation/newJob';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { vehicleLabel } from '@/lib/format';
import { clearDraft, readDraft, writeDraft } from '@/lib/drafts';
import { thumbPath } from '@/lib/thumbnails';
import { cn } from '@/lib/utils';
import type { Client, Vehicle } from '@/types/database';

interface NewJobModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  title?: string;
  // 'client' registers a client + vehicle only, without opening a job.
  mode?: 'job' | 'client';
}

interface FormValues {
  firstName: string;
  lastName: string;
  countryCode: string;
  phoneNumber: string;
  registrationPlate: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  symptoms: SymptomCode[];
  description: string;
  isEmergency: boolean;
  address: string;
  oib: string;
}

const initialValues: FormValues = {
  firstName: '',
  lastName: '',
  countryCode: '+385',
  phoneNumber: '',
  registrationPlate: '',
  make: '',
  model: '',
  year: '',
  vin: '',
  symptoms: [],
  description: '',
  isEmergency: false,
  address: '',
  oib: '',
};

interface KnownVehicle {
  vehicle: Vehicle;
  client: Client;
}

interface Draft {
  values: FormValues;
  selectedVehicleId: string | null;
}

// "ZG 1234-AB", "zg1234ab" and "ZG-1234-AB" are the same plate.
function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9ČĆŽŠĐ]/g, '');
}

export default function NewJobModal({ open, onClose, tenantId, title = 'Novi nalog', mode = 'job' }: NewJobModalProps) {
  const router = useRouter();
  const isJobMode = mode === 'job';
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationPhoto, setRegistrationPhoto] = useState<UploadedPhoto | null>(null);
  const [intakePhotos, setIntakePhotos] = useState<UploadedPhoto[]>([]);
  const [showExtra, setShowExtra] = useState(false);
  const [known, setKnown] = useState<KnownVehicle[]>([]);
  const [selected, setSelected] = useState<KnownVehicle | null>(null);
  // Stays open once something is in it (e.g. VIN/year filled by the AI read).
  const extraOpen = showExtra || Boolean(values.address || values.oib || values.year || values.vin);
  const draftKey = `draft:${mode}:${tenantId}`;
  const pendingSelectionRef = useRef<string | null>(null);
  const hasInput = selected !== null || JSON.stringify(values) !== JSON.stringify(initialValues);

  // Restore whatever was typed before the tab closed or the signal dropped.
  useEffect(() => {
    if (!open) return;
    const draft = readDraft<Draft>(draftKey);
    if (!draft) return;
    setValues({ ...initialValues, ...draft.values });
    pendingSelectionRef.current = draft.selectedVehicleId;
  }, [open, draftKey]);

  // Cleared only after a successful save, never on close.
  useEffect(() => {
    if (!open) return;
    if (!hasInput) clearDraft(draftKey);
    else writeDraft(draftKey, { values, selectedVehicleId: selected?.vehicle.id ?? null } satisfies Draft);
  }, [open, draftKey, values, selected, hasInput]);

  // Every vehicle on file, loaded once per opening — a workshop has
  // hundreds at most, and matching locally tolerates any plate spelling.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const [{ data: vehicles }, { data: clients }] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase.from('clients').select('*'),
      ]);
      if (cancelled) return;
      const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
      const list = (vehicles ?? []).flatMap((vehicle) => {
        const client = clientById.get(vehicle.client_id);
        return client ? [{ vehicle, client }] : [];
      });
      setKnown(list);
      if (pendingSelectionRef.current) {
        const restored = list.find((k) => k.vehicle.id === pendingSelectionRef.current);
        if (restored) setSelected(restored);
        pendingSelectionRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const suggestions = useMemo(() => {
    if (selected) return [];
    const query = values.registrationPlate.trim();
    const plateQuery = normalizePlate(query);
    if (plateQuery.length < 2) return [];
    const lower = query.toLowerCase();
    return known
      .filter(
        ({ vehicle, client }) =>
          normalizePlate(vehicle.registration_plate ?? '').includes(plateQuery) ||
          `${client.first_name} ${client.last_name}`.toLowerCase().includes(lower) ||
          client.phone_number.replace(/\D/g, '').includes(query.replace(/\D/g, '') || '—')
      )
      .slice(0, 5);
  }, [known, values.registrationPlate, selected]);

  const handleFinalText = useCallback((final: string) => {
    setValues((prev) => ({
      ...prev,
      description: prev.description ? `${prev.description} ${final}`.trim() : final.trim(),
    }));
  }, []);

  const { isSupported: speechSupported, isRecording, toggleRecording } = useSpeechToText({
    onFinalText: handleFinalText,
  });

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSymptom(code: SymptomCode) {
    setValues((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(code) ? prev.symptoms.filter((s) => s !== code) : [...prev.symptoms, code],
    }));
  }

  function handleScannedFields(fields: ExtractedFields) {
    const plate = fields.registrationPlate ?? '';
    const match = plate ? known.find((k) => normalizePlate(k.vehicle.registration_plate ?? '') === normalizePlate(plate)) : undefined;
    if (match) {
      setSelected(match);
      toast.success('Vozilo je već u bazi — preuzeti su postojeći podaci.');
      return;
    }
    // Never overwrite something the mechanic already typed by hand.
    setValues((prev) => ({
      ...prev,
      firstName: prev.firstName || fields.firstName || '',
      lastName: prev.lastName || fields.lastName || '',
      make: prev.make || fields.make || '',
      model: prev.model || fields.model || '',
      year: prev.year || (fields.year ? String(fields.year) : ''),
      vin: prev.vin || fields.vin || '',
      registrationPlate: prev.registrationPlate || plate,
    }));
  }

  async function removeStagedPhotos(photos: UploadedPhoto[]) {
    if (photos.length === 0) return;
    await createBrowserSupabaseClient()
      .storage.from('job-vault')
      .remove(photos.flatMap((p) => [p.path, thumbPath(p.path)]));
  }

  function reset() {
    setValues(initialValues);
    setErrors({});
    setRegistrationPhoto(null);
    setIntakePhotos([]);
    setShowExtra(false);
    setSelected(null);
  }

  function cancel() {
    // Staged uploads only become permanent when a job is created.
    removeStagedPhotos([...(registrationPhoto ? [registrationPhoto] : []), ...intakePhotos]);
    reset();
    onClose();
  }

  function applyFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
  }

  async function postJob(payload: unknown) {
    const response = await fetch('/api/jobs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error ?? 'Kreiranje naloga nije uspjelo.');
      return;
    }
    if (json.photoWarnings?.length > 0) {
      toast.error('Neke fotografije nisu spremljene — dodajte ih na nalogu.');
    }
    clearDraft(draftKey);
    reset();
    onClose();
    router.push(`/dashboard/jobs/${json.jobId}`);
  }

  async function submitJob() {
    const photos = [...(registrationPhoto ? [registrationPhoto] : []), ...intakePhotos].map(({ path, tag, takenAt, gpsLat, gpsLng }) => ({ path, tag, takenAt, gpsLat, gpsLng }));
    const jobFields = {
      symptoms: values.symptoms,
      description: values.description || undefined,
      isEmergency: values.isEmergency,
      photos,
    };

    const parsed = selected
      ? existingVehicleJobSchema.safeParse({ ...jobFields, vehicleId: selected.vehicle.id })
      : newJobSchema.safeParse({
          ...jobFields,
          firstName: values.firstName,
          lastName: values.lastName,
          countryCode: values.countryCode,
          phoneNumber: values.phoneNumber,
          registrationPlate: values.registrationPlate,
          make: values.make || undefined,
          model: values.model || undefined,
          year: values.year ? Number(values.year) : undefined,
          vin: values.vin || undefined,
          address: values.address || undefined,
          oib: values.oib || undefined,
        });

    if (!parsed.success) {
      applyFieldErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    await postJob(parsed.data);
  }

  async function submitClient() {
    if (selected) {
      toast('Vozilo je već u bazi.');
      cancel();
      return;
    }

    const parsed = newClientSchema.safeParse({
      firstName: values.firstName,
      lastName: values.lastName,
      countryCode: values.countryCode,
      phoneNumber: values.phoneNumber,
      registrationPlate: values.registrationPlate,
      make: values.make || undefined,
      model: values.model || undefined,
      year: values.year ? Number(values.year) : undefined,
      vin: values.vin || undefined,
      address: values.address || undefined,
      oib: values.oib || undefined,
    });
    if (!parsed.success) {
      applyFieldErrors(parsed.error.issues);
      return;
    }

    const d = parsed.data;
    const phoneNumber = `${d.countryCode}${d.phoneNumber}`;
    setErrors({});
    const supabase = createBrowserSupabaseClient();

    // Phone is unique per workshop — reuse an existing client rather than
    // failing, so this also works for "add a second car to this client".
    const { data: existingClient } = await supabase.from('clients').select('id').eq('phone_number', phoneNumber).maybeSingle();

    let clientId = existingClient?.id;
    if (!clientId) {
      const { data: created, error } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          first_name: d.firstName,
          last_name: d.lastName,
          phone_number: phoneNumber,
          address: d.address || null,
          oib: d.oib || null,
        })
        .select('id')
        .single();
      if (error || !created) {
        toast.error('Spremanje mušterije nije uspjelo.');
        return;
      }
      clientId = created.id;
    }

    const { error: vehicleError } = await supabase.from('vehicles').insert({
      tenant_id: tenantId,
      client_id: clientId,
      registration_plate: d.registrationPlate,
      make: d.make || null,
      model: d.model || null,
      year: d.year ?? null,
      vin: d.vin || null,
    });
    if (vehicleError) {
      toast.error(vehicleError.code === '23505' ? 'Vozilo s tom registracijom već postoji.' : 'Mušterija je spremljena, ali vozilo nije.');
      return;
    }

    // No job to attach the registration photo to.
    await removeStagedPhotos(registrationPhoto ? [registrationPhoto] : []);
    toast.success(existingClient ? 'Vozilo dodano postojećoj mušteriji.' : 'Mušterija i vozilo spremljeni.');
    clearDraft(draftKey);
    reset();
    onClose();
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (isJobMode) await submitJob();
      else await submitClient();
    } catch {
      toast.error('Spremanje nije uspjelo. Provjerite internetsku vezu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && cancel()}>
      <DrawerContent className="max-h-[95dvh]">
        <div className="flex items-center justify-between px-4 pt-3">
          <DrawerTitle className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</DrawerTitle>
          {hasInput && (
            <button
              type="button"
              onClick={() => {
                removeStagedPhotos([...(registrationPhoto ? [registrationPhoto] : []), ...intakePhotos]);
                clearDraft(draftKey);
                reset();
              }}
              className="press-effect min-h-[48px] rounded-lg px-3 text-sm font-semibold text-slate-500 dark:text-slate-300"
            >
              Očisti
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!selected && (
            <RegistrationScanner
              tenantId={tenantId}
              photo={registrationPhoto}
              onPhotoChange={setRegistrationPhoto}
              onFields={handleScannedFields}
            />
          )}

          {selected ? (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/10">
              <Car className="h-6 w-6 flex-shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{vehicleLabel(selected.vehicle)}</p>
                <p className="flex items-center gap-1 truncate text-xs text-slate-600 dark:text-slate-300">
                  <User className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
                  {selected.client.first_name} {selected.client.last_name}
                  <Phone className="ml-1.5 h-3 w-3 flex-shrink-0" strokeWidth={2} />
                  {selected.client.phone_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  update('registrationPlate', '');
                }}
                aria-label="Odaberi drugo vozilo"
                className="press-effect flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/60 dark:hover:bg-workshop-surface-hover"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Field label="Registracija" error={errors.registrationPlate}>
                  <input
                    value={values.registrationPlate}
                    onChange={(e) => update('registrationPlate', e.target.value.toUpperCase())}
                    className={cn(inputClass(!!errors.registrationPlate), 'text-center text-lg font-bold uppercase tracking-widest')}
                    autoComplete="off"
                  />
                </Field>
                {suggestions.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-workshop-border dark:bg-workshop-surface">
                    {suggestions.map((s) => (
                      <button
                        key={s.vehicle.id}
                        type="button"
                        onClick={() => setSelected(s)}
                        className="flex min-h-[52px] w-full items-center gap-3 border-b border-slate-100 px-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-workshop-border dark:hover:bg-workshop-surface-hover"
                      >
                        <Car className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {vehicleLabel(s.vehicle)}
                          </span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-300">
                            {s.client.first_name} {s.client.last_name}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Ime" error={errors.firstName}>
                  <input value={values.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputClass(!!errors.firstName)} />
                </Field>
                <Field label="Prezime" error={errors.lastName}>
                  <input value={values.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputClass(!!errors.lastName)} />
                </Field>
              </div>

              <Field label="Telefon" error={errors.phoneNumber}>
                <div className="flex gap-2">
                  <select
                    value={values.countryCode}
                    onChange={(e) => update('countryCode', e.target.value)}
                    className="w-24 flex-shrink-0 rounded-xl border border-slate-300 bg-white px-2 py-3 text-sm dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={values.phoneNumber}
                    onChange={(e) => update('phoneNumber', e.target.value.replace(/[^0-9]/g, ''))}
                    className={cn(inputClass(!!errors.phoneNumber), 'flex-1')}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Marka">
                  <input value={values.make} onChange={(e) => update('make', e.target.value)} className={inputClass(false)} />
                </Field>
                <Field label="Model">
                  <input value={values.model} onChange={(e) => update('model', e.target.value)} className={inputClass(false)} />
                </Field>
              </div>

              {extraOpen ? (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-workshop-surface-hover/50">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Godina" error={errors.year}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={values.year}
                        onChange={(e) => update('year', e.target.value)}
                        className={inputClass(!!errors.year)}
                      />
                    </Field>
                    <Field label="VIN" error={errors.vin}>
                      <input
                        maxLength={17}
                        value={values.vin}
                        onChange={(e) => update('vin', e.target.value.toUpperCase())}
                        className={inputClass(!!errors.vin)}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Adresa" error={errors.address}>
                      <input value={values.address} onChange={(e) => update('address', e.target.value)} className={inputClass(!!errors.address)} />
                    </Field>
                    <Field label="OIB" error={errors.oib}>
                      <input
                        inputMode="numeric"
                        maxLength={11}
                        value={values.oib}
                        onChange={(e) => update('oib', e.target.value.replace(/[^0-9]/g, ''))}
                        className={inputClass(!!errors.oib)}
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExtra(true)}
                  className="press-effect flex min-h-[48px] w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 dark:border-workshop-border dark:text-slate-300"
                >
                  Dodatni podaci
                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
            </>
          )}

          {isJobMode && (
            <>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Simptomi</p>
                <div className="flex flex-wrap gap-1.5">
                  {SYMPTOM_OPTIONS.map((option) => {
                    const checked = values.symptoms.includes(option.code);
                    return (
                      <button
                        key={option.code}
                        type="button"
                        onClick={() => toggleSymptom(option.code)}
                        aria-pressed={checked}
                        className={cn(
                          'press-effect min-h-[48px] rounded-full border-2 px-3 text-left text-xs font-semibold',
                          checked
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-electric-blue dark:bg-electric-blue/10 dark:text-electric-blue'
                            : 'border-slate-200 text-slate-600 dark:border-workshop-border dark:text-slate-300'
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="newJobDescription" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Opis kvara
                  </label>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={cn(
                        'press-effect flex min-h-[48px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
                        isRecording
                          ? 'bg-alarm-red text-white'
                          : 'bg-blue-50 text-blue-600 dark:bg-electric-blue/10 dark:text-electric-blue'
                      )}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" strokeWidth={2} /> : <Mic className="h-4 w-4" strokeWidth={2} />}
                      {isRecording ? 'Zaustavi' : 'Diktiraj'}
                    </button>
                  )}
                </div>
                <textarea
                  id="newJobDescription"
                  rows={3}
                  value={values.description}
                  onChange={(e) => update('description', e.target.value)}
                  className={inputClass(!!errors.description)}
                />
              </div>

              <PhotoUploadDropzone
                tenantId={tenantId}
                tag="INTAKE_CONDITION"
                label="Stanje vozila"
                maxFiles={4}
                photos={intakePhotos}
                onChange={setIntakePhotos}
              />

              <button
                type="button"
                role="switch"
                aria-checked={values.isEmergency}
                onClick={() => update('isEmergency', !values.isEmergency)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border-2 p-3 text-left',
                  values.isEmergency ? 'border-alarm-red bg-red-50 dark:bg-red-500/10' : 'border-slate-200 dark:border-workshop-border'
                )}
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hitni prijem</span>
                <span
                  className={cn(
                    'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
                    values.isEmergency ? 'bg-alarm-red' : 'bg-slate-300 dark:bg-workshop-border'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      values.isEmergency ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </span>
              </button>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="press-effect sticky bottom-0 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isJobMode ? (
              <Send className="h-5 w-5" strokeWidth={2} />
            ) : (
              <UserPlus className="h-5 w-5" strokeWidth={2} />
            )}
            {isSubmitting ? 'Spremanje…' : isJobMode ? 'Spremi i otvori radni nalog' : 'Spremi mušteriju'}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-xl border bg-white px-3 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:bg-workshop-surface-hover dark:text-slate-100',
    hasError ? 'border-red-400' : 'border-slate-300 focus:border-blue-500 dark:border-workshop-border'
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle className="h-3 w-3 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
