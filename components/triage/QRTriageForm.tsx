'use client';

import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  BatteryWarning,
  Car,
  Camera as CameraIcon,
  CheckCircle2,
  KeyRound,
  Lightbulb,
  Loader2,
  type LucideIcon,
  Puzzle,
  Send,
  Siren,
  User,
  Wrench,
} from 'lucide-react';
import { COUNTRY_CODES, SYMPTOM_OPTIONS, type SymptomCode, triageFormSchema } from '@/lib/validation/triage';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/types/database';
import PhotoUploadDropzone, { type UploadedPhoto } from './PhotoUploadDropzone';
import TriageSuccessReceipt from './TriageSuccessReceipt';

const SYMPTOM_ICONS: Record<SymptomCode, LucideIcon> = {
  PARASITIC_DRAIN: BatteryWarning,
  DASHBOARD_LIGHTS: AlertTriangle,
  NO_START_IGNITION: KeyRound,
  LIGHTING_WINDOWS_LOCKS: Lightbulb,
  AFTERMARKET_ACCESSORIES: Puzzle,
};

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
};

interface SubmissionResult {
  jobId: string;
  jobReference: string;
  registrationPlate: string;
  photoWarnings: string[];
}

interface QRTriageFormProps {
  tenant: Tenant;
}

export default function QRTriageForm({ tenant }: QRTriageFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [intakePhotos, setIntakePhotos] = useState<UploadedPhoto[]>([]);
  const [registrationPhotos, setRegistrationPhotos] = useState<UploadedPhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSymptom(code: SymptomCode) {
    setValues((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(code)
        ? prev.symptoms.filter((s) => s !== code)
        : [...prev.symptoms, code],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const payload = {
      tenantSlug: tenant.slug,
      firstName: values.firstName,
      lastName: values.lastName,
      countryCode: values.countryCode,
      phoneNumber: values.phoneNumber,
      registrationPlate: values.registrationPlate,
      make: values.make || undefined,
      model: values.model || undefined,
      year: values.year ? Number(values.year) : undefined,
      vin: values.vin || undefined,
      symptoms: values.symptoms,
      description: values.description || undefined,
      isEmergency: values.isEmergency,
      photos: [...intakePhotos, ...registrationPhotos].map(({ path, tag }) => ({ path, tag })),
    };

    const parsed = triageFormSchema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/triage/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const json = await response.json();

      if (!response.ok) {
        setSubmitError(json.error ?? 'Došlo je do greške. Pokušajte ponovno.');
        return;
      }

      setResult(json as SubmissionResult);
    } catch {
      setSubmitError('Nije moguće poslati prijavu. Provjerite internetsku vezu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <TriageSuccessReceipt
        jobReference={result.jobReference}
        registrationPlate={result.registrationPlate}
        isEmergency={values.isEmergency}
        tenant={{
          name: tenant.name,
          phone: tenant.phone,
          freeParkingDays: tenant.free_parking_days,
          dailyParkingFee: tenant.daily_parking_fee,
        }}
      />
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="mx-auto max-w-lg space-y-4 px-4 pb-32 pt-6">
      {/* Customer info */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <User className="h-5 w-5 text-blue-600" /> Vaši podaci
        </h2>

        <Field label="Ime" htmlFor="firstName" error={errors.firstName}>
          <input
            id="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            aria-invalid={!!errors.firstName}
            className={inputClass(!!errors.firstName)}
            placeholder="Ivan"
          />
        </Field>

        <Field label="Prezime" htmlFor="lastName" error={errors.lastName}>
          <input
            id="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            aria-invalid={!!errors.lastName}
            className={inputClass(!!errors.lastName)}
            placeholder="Horvat"
          />
        </Field>

        <Field label="Broj telefona" htmlFor="phoneNumber" error={errors.phoneNumber}>
          <div className="flex gap-2">
            <select
              id="countryCode"
              value={values.countryCode}
              onChange={(e) => update('countryCode', e.target.value)}
              className="w-24 flex-shrink-0 rounded-xl border border-slate-300 bg-white px-2 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              id="phoneNumber"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={values.phoneNumber}
              onChange={(e) => update('phoneNumber', e.target.value.replace(/[^0-9]/g, ''))}
              aria-invalid={!!errors.phoneNumber}
              className={inputClass(!!errors.phoneNumber, 'flex-1')}
              placeholder="912345678"
            />
          </div>
        </Field>
      </section>

      {/* Vehicle info */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Car className="h-5 w-5 text-blue-600" /> Podaci o vozilu
        </h2>

        <Field label="Registarska oznaka" htmlFor="registrationPlate" error={errors.registrationPlate}>
          <input
            id="registrationPlate"
            autoCapitalize="characters"
            autoComplete="off"
            value={values.registrationPlate}
            onChange={(e) => update('registrationPlate', e.target.value.toUpperCase())}
            aria-invalid={!!errors.registrationPlate}
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-4 text-center text-2xl font-bold uppercase tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100',
              errors.registrationPlate ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'
            )}
            placeholder="ZG-1234-AA"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Marka" htmlFor="make">
            <input
              id="make"
              value={values.make}
              onChange={(e) => update('make', e.target.value)}
              className={inputClass(false)}
              placeholder="Volkswagen"
            />
          </Field>
          <Field label="Model" htmlFor="model">
            <input
              id="model"
              value={values.model}
              onChange={(e) => update('model', e.target.value)}
              className={inputClass(false)}
              placeholder="Golf 7"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Godina (opcionalno)" htmlFor="year" error={errors.year}>
            <input
              id="year"
              type="number"
              inputMode="numeric"
              min={1900}
              max={currentYear + 1}
              value={values.year}
              onChange={(e) => update('year', e.target.value)}
              aria-invalid={!!errors.year}
              className={inputClass(!!errors.year)}
              placeholder="2015"
            />
          </Field>
          <Field label="VIN (opcionalno)" htmlFor="vin" error={errors.vin}>
            <input
              id="vin"
              maxLength={17}
              autoCapitalize="characters"
              value={values.vin}
              onChange={(e) => update('vin', e.target.value.toUpperCase())}
              aria-invalid={!!errors.vin}
              className={inputClass(!!errors.vin)}
              placeholder="17 znakova"
            />
          </Field>
        </div>
      </section>

      {/* Photos */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <CameraIcon className="h-5 w-5 text-blue-600" /> Fotografije
        </h2>

        <PhotoUploadDropzone
          tenantId={tenant.id}
          tag="INTAKE_CONDITION"
          label="Stanje vozila"
          hint="Slikajte vozilo s vanjske strane (sve 4 strane ako je moguće)."
          maxFiles={4}
          photos={intakePhotos}
          onChange={setIntakePhotos}
        />

        <PhotoUploadDropzone
          tenantId={tenant.id}
          tag="REGISTRATION_CARD"
          label="Prometna dozvola"
          hint="Slikajte prometnu dozvolu radi lakše identifikacije vozila."
          maxFiles={2}
          photos={registrationPhotos}
          onChange={setRegistrationPhotos}
        />
      </section>

      {/* Symptoms */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Wrench className="h-5 w-5 text-blue-600" /> Opišite kvar
        </h2>

        {errors.symptoms && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {errors.symptoms}
          </p>
        )}

        <div className="space-y-2" role="group" aria-label="Simptomi kvara">
          {SYMPTOM_OPTIONS.map((option) => {
            const Icon = SYMPTOM_ICONS[option.code];
            const checked = values.symptoms.includes(option.code);
            return (
              <motion.label
                key={option.code}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors',
                  checked ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleSymptom(option.code)}
                />
                <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', checked ? 'text-blue-600' : 'text-slate-400')} />
                <span className="flex-1 text-sm font-medium text-slate-800">{option.label}</span>
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  <AnimatePresence>
                    {checked && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <CheckCircle2 className="h-5 w-5 text-blue-600" strokeWidth={2} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </motion.label>
            );
          })}
        </div>

        <Field label="Detaljniji opis (opcionalno)" htmlFor="description" error={errors.description}>
          <textarea
            id="description"
            rows={4}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            aria-invalid={!!errors.description}
            className={inputClass(!!errors.description)}
            placeholder="Npr. lampica se pali povremeno, primijetio sam problem prije 3 dana..."
          />
        </Field>
      </section>

      {/* Emergency toggle */}
      <section>
        <button
          type="button"
          role="switch"
          aria-checked={values.isEmergency}
          onClick={() => update('isEmergency', !values.isEmergency)}
          className={cn(
            'press-effect flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left shadow-sm transition-colors',
            values.isEmergency ? 'border-alarm-red bg-red-50' : 'border-slate-200 bg-white'
          )}
        >
          <span className="flex items-start gap-3">
            <Siren
              className={cn('mt-0.5 h-5 w-5 flex-shrink-0', values.isEmergency ? 'text-alarm-red' : 'text-slate-400')}
              strokeWidth={2}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Hitni prijem istog dana</span>
              <span className="block text-xs text-slate-500">
                +{tenant.emergency_surcharge_percent % 1 === 0 ? tenant.emergency_surcharge_percent : tenant.emergency_surcharge_percent.toFixed(1)}% na cijenu dijagnostike
              </span>
            </span>
          </span>
          <span
            className={cn(
              'relative h-7 w-12 flex-shrink-0 rounded-full transition-colors',
              values.isEmergency ? 'bg-alarm-red' : 'bg-slate-300'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                values.isEmergency ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {values.isEmergency && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
                <p className="font-semibold">Pregled troška hitnog prijema</p>
                <p className="mt-1 text-red-700">
                  Uobičajena cijena dijagnostike uvećava se za{' '}
                  <strong>{tenant.emergency_surcharge_percent % 1 === 0 ? tenant.emergency_surcharge_percent : tenant.emergency_surcharge_percent.toFixed(1)}%</strong> zbog
                  prioritetne obrade. Konačan iznos potvrđuje mehaničar nakon pregleda vozila.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          {submitError && (
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" strokeWidth={2} />}
            {isSubmitting ? 'Slanje…' : 'Pošalji prijavu'}
          </button>
        </div>
      </div>
    </form>
  );
}

function inputClass(hasError: boolean, extra?: string) {
  return cn(
    'w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100',
    hasError ? 'border-red-400' : 'border-slate-300 focus:border-blue-500',
    extra
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
