'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import PhotoUploadDropzone, { type UploadedPhoto } from '@/components/triage/PhotoUploadDropzone';
import { COUNTRY_CODES, SYMPTOM_OPTIONS, type SymptomCode } from '@/lib/validation/triage';
import { newJobSchema } from '@/lib/validation/newJob';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { cn } from '@/lib/utils';

interface NewJobModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
}

interface ExtractedFields {
  firstName: string | null;
  lastName: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  registrationPlate: string | null;
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

export default function NewJobModal({ open, onClose, tenantId }: NewJobModalProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationPhotos, setRegistrationPhotos] = useState<UploadedPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  function resetAndClose() {
    setValues(initialValues);
    setErrors({});
    setRegistrationPhotos([]);
    onClose();
  }

  async function analyzeRegistrationCard(photo: UploadedPhoto) {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/vision/registration-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath: photo.path }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? 'AI čitanje dokumenta nije uspjelo. Upišite podatke ručno.');
        return;
      }

      const fields = json.fields as ExtractedFields;

      // Only fill fields the mechanic hasn't already typed — never
      // silently overwrite something they've already entered by hand.
      setValues((prev) => ({
        ...prev,
        firstName: prev.firstName || fields.firstName || '',
        lastName: prev.lastName || fields.lastName || '',
        make: prev.make || fields.make || '',
        model: prev.model || fields.model || '',
        year: prev.year || (fields.year ? String(fields.year) : ''),
        vin: prev.vin || fields.vin || '',
        registrationPlate: prev.registrationPlate || fields.registrationPlate || '',
      }));

      toast.success('Podaci pročitani s prometne — provjerite prije spremanja.');
    } catch {
      toast.error('AI čitanje dokumenta nije uspjelo. Upišite podatke ručno.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
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
    };

    const parsed = newJobSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? 'Kreiranje naloga nije uspjelo.');
        return;
      }

      toast.success(`Nalog kreiran: ${json.jobReference}`);
      resetAndClose();
      router.refresh();
    } catch {
      toast.error('Kreiranje naloga nije uspjelo. Provjerite internetsku vezu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DrawerContent className="max-h-[95dvh]">
        <DrawerTitle className="px-4 pt-4 text-base font-bold text-slate-900 dark:text-slate-100">
          Novi nalog
        </DrawerTitle>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-3 dark:border-electric-blue/30 dark:bg-electric-blue/5">
            <PhotoUploadDropzone
              tenantId={tenantId}
              tag="REGISTRATION_CARD"
              label="Slikaj prometnu (AI popuni podatke)"
              hint="Fotografirajte prometnu dozvolu — ime, marka, model, VIN i registracija će se pokušati automatski pročitati."
              maxFiles={1}
              photos={registrationPhotos}
              onChange={(next) => {
                const isNewPhoto = next.length > registrationPhotos.length;
                setRegistrationPhotos(next);
                if (isNewPhoto) {
                  analyzeRegistrationCard(next[next.length - 1]);
                }
              }}
            />
            {isAnalyzing && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-electric-blue">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" strokeWidth={2} /> AI čita dokument…
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ime" error={errors.firstName}>
              <input
                value={values.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                className={inputClass(!!errors.firstName)}
                placeholder="Ivan"
              />
            </Field>
            <Field label="Prezime" error={errors.lastName}>
              <input
                value={values.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                className={inputClass(!!errors.lastName)}
                placeholder="Horvat"
              />
            </Field>
          </div>

          <Field label="Broj telefona" error={errors.phoneNumber}>
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
                placeholder="912345678"
              />
            </div>
          </Field>

          <Field label="Registarska oznaka" error={errors.registrationPlate}>
            <input
              value={values.registrationPlate}
              onChange={(e) => update('registrationPlate', e.target.value.toUpperCase())}
              className={cn(inputClass(!!errors.registrationPlate), 'text-center text-lg font-bold uppercase tracking-widest')}
              placeholder="ZG-1234-AA"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marka">
              <input
                value={values.make}
                onChange={(e) => update('make', e.target.value)}
                className={inputClass(false)}
                placeholder="Volkswagen"
              />
            </Field>
            <Field label="Model">
              <input
                value={values.model}
                onChange={(e) => update('model', e.target.value)}
                className={inputClass(false)}
                placeholder="Golf 7"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Godina" error={errors.year}>
              <input
                type="number"
                inputMode="numeric"
                value={values.year}
                onChange={(e) => update('year', e.target.value)}
                className={inputClass(!!errors.year)}
                placeholder="2015"
              />
            </Field>
            <Field label="VIN" error={errors.vin}>
              <input
                maxLength={17}
                value={values.vin}
                onChange={(e) => update('vin', e.target.value.toUpperCase())}
                className={inputClass(!!errors.vin)}
                placeholder="opcionalno"
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Simptomi (opcionalno)</p>
            <div className="space-y-1.5">
              {SYMPTOM_OPTIONS.map((option) => {
                const checked = values.symptoms.includes(option.code);
                return (
                  <label
                    key={option.code}
                    className={cn(
                      'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm',
                      checked
                        ? 'border-blue-600 bg-blue-50 dark:border-electric-blue dark:bg-electric-blue/10'
                        : 'border-slate-200 dark:border-workshop-border'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleSymptom(option.code)}
                    />
                    <span className="text-slate-800 dark:text-slate-200">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="newJobDescription" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Opis kvara (opcionalno)
              </label>
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={cn(
                    'press-effect flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
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
              placeholder="Opišite kvar ili diktirajte mikrofonom..."
            />
          </div>

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

          <button
            type="submit"
            disabled={isSubmitting}
            className="press-effect sticky bottom-0 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" strokeWidth={2} />}
            {isSubmitting ? 'Kreiranje…' : 'Kreiraj nalog'}
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
