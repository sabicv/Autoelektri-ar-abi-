'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { tenantSettingsSchema } from '@/lib/validation/tenant';
import type { Tenant } from '@/types/database';

interface TenantSettingsFormProps {
  tenant: Tenant;
}

interface FormValues {
  name: string;
  slug: string;
  phone: string;
  address: string;
  freeParkingDays: string;
  dailyParkingFee: string;
  emergencySurchargePercent: string;
}

export default function TenantSettingsForm({ tenant }: TenantSettingsFormProps) {
  const [values, setValues] = useState<FormValues>({
    name: tenant.name,
    slug: tenant.slug,
    phone: tenant.phone ?? '',
    address: tenant.address ?? '',
    freeParkingDays: String(tenant.free_parking_days),
    dailyParkingFee: String(tenant.daily_parking_fee),
    emergencySurchargePercent: String(tenant.emergency_surcharge_percent),
  });
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoUpload(file: File) {
    setSaveError(null);
    setIsUploadingLogo(true);

    const supabase = createBrowserSupabaseClient();
    const extension = file.name.split('.').pop() || 'png';
    const path = `${tenant.id}/logo_${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('tenant-branding')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      setIsUploadingLogo(false);
      setSaveError('Prijenos logotipa nije uspio. Pokušajte ponovno.');
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('tenant-branding').getPublicUrl(path);
    setLogoUrl(publicUrlData.publicUrl);
    setIsUploadingLogo(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setSavedAt(null);

    const payload = {
      name: values.name,
      slug: values.slug,
      phone: values.phone || undefined,
      address: values.address || undefined,
      logoUrl: logoUrl || undefined,
      freeParkingDays: Number(values.freeParkingDays),
      dailyParkingFee: Number(values.dailyParkingFee.replace(',', '.')),
      emergencySurchargePercent: Number(values.emergencySurchargePercent.replace(',', '.')),
    };

    const parsed = tenantSettingsSchema.safeParse(payload);
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
    setIsSaving(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from('tenants')
      .update({
        name: parsed.data.name,
        slug: parsed.data.slug,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        logo_url: parsed.data.logoUrl || null,
        free_parking_days: parsed.data.freeParkingDays,
        daily_parking_fee: parsed.data.dailyParkingFee,
        emergency_surcharge_percent: parsed.data.emergencySurchargePercent,
      })
      .eq('id', tenant.id);

    setIsSaving(false);

    if (error) {
      setSaveError(
        error.code === '23505'
          ? 'Ova skraćena poveznica je već zauzeta — odaberite drugu.'
          : 'Spremanje nije uspjelo. Pokušajte ponovno.'
      );
      return;
    }

    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Profil radionice</h2>

        <div className="flex items-center gap-4">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt="Logotip"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400 dark:bg-workshop-surface-hover dark:text-slate-500">
              Logo
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingLogo}
            className="press-effect flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-workshop-border dark:text-slate-200"
          >
            {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploadingLogo ? 'Prijenos…' : 'Promijeni logotip'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        <Field label="Naziv radionice" htmlFor="name" error={errors.name}>
          <input
            id="name"
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            className={inputClass(!!errors.name)}
          />
        </Field>

        <Field
          label="Skraćena poveznica (slug)"
          htmlFor="slug"
          error={errors.slug}
          hint="Koristi se u javnom linku za prijavu kvara: app.com/t/[slug]"
        >
          <input
            id="slug"
            value={values.slug}
            onChange={(e) => update('slug', e.target.value.toLowerCase())}
            className={inputClass(!!errors.slug)}
          />
        </Field>

        <Field label="Telefon" htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass(!!errors.phone)}
          />
        </Field>

        <Field label="Adresa" htmlFor="address" error={errors.address}>
          <input
            id="address"
            value={values.address}
            onChange={(e) => update('address', e.target.value)}
            className={inputClass(!!errors.address)}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pravila parkiranja i naplate</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Besplatno parkiranje (dana)" htmlFor="freeParkingDays" error={errors.freeParkingDays}>
            <input
              id="freeParkingDays"
              type="number"
              min={0}
              value={values.freeParkingDays}
              onChange={(e) => update('freeParkingDays', e.target.value)}
              className={inputClass(!!errors.freeParkingDays)}
            />
          </Field>

          <Field label="Ležarina (€/dan)" htmlFor="dailyParkingFee" error={errors.dailyParkingFee}>
            <input
              id="dailyParkingFee"
              type="text"
              inputMode="decimal"
              value={values.dailyParkingFee}
              onChange={(e) => update('dailyParkingFee', e.target.value.replace(/[^0-9,.-]/g, ''))}
              className={inputClass(!!errors.dailyParkingFee)}
            />
          </Field>
        </div>

        <Field
          label="Hitni doplatak (%)"
          htmlFor="emergencySurchargePercent"
          error={errors.emergencySurchargePercent}
          hint="Primjenjuje se na nove naloge kada klijent odabere hitni prijem."
        >
          <input
            id="emergencySurchargePercent"
            type="text"
            inputMode="decimal"
            value={values.emergencySurchargePercent}
            onChange={(e) => update('emergencySurchargePercent', e.target.value.replace(/[^0-9,.-]/g, ''))}
            className={inputClass(!!errors.emergencySurchargePercent)}
          />
        </Field>
      </section>

      {saveError && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {saveError}
        </p>
      )}
      {savedAt && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Postavke su spremljene.
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition-colors active:bg-blue-700 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {isSaving ? 'Spremanje…' : 'Spremi postavke'}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:bg-workshop-surface-hover dark:text-slate-100 ${
    hasError ? 'border-red-400' : 'border-slate-300 focus:border-blue-500 dark:border-workshop-border'
  }`;
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
