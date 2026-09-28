'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Car, History, Loader2, Pencil, Phone, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@/components/ui/Card';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  clientEditSchema,
  vehicleEditSchema,
  type ClientEditValues,
  type VehicleEditValues,
} from '@/lib/validation/clientEdit';
import { cn } from '@/lib/utils';
import type { Client, Vehicle } from '@/types/database';

const UNIQUE_VIOLATION = '23505';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100';

const outlineButton =
  'press-effect flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200';

const primaryButton =
  'press-effect flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark';

function Field({ label, className, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input {...props} className={cn(inputClass, className)} />
    </label>
  );
}

function EditActions({ saving, error, onCancel }: { saving: boolean; error: string | null; onCancel: () => void }) {
  return (
    <>
      {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className={outlineButton}>
          Odustani
        </button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Spremi
        </button>
      </div>
    </>
  );
}

function clientValues(client: Client): ClientEditValues {
  return {
    firstName: client.first_name,
    lastName: client.last_name,
    phoneNumber: client.phone_number,
    address: client.address ?? '',
    oib: client.oib ?? '',
    notes: client.notes ?? '',
  };
}

export function ClientDetailsCard({
  client: initialClient,
  canDelete,
  jobCount,
}: {
  client: Client;
  canDelete: boolean;
  jobCount: number;
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ClientEditValues>(() => clientValues(initialClient));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!deleteArmed) return;
    const timer = setTimeout(() => setDeleteArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [deleteArmed]);

  // Irreversible (vehicles, jobs, photos, messages all go), so a second
  // tap within a few seconds confirms it.
  async function deleteClient() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setDeleting(true);
    const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteArmed(false);
    if (!response.ok) {
      toast.error('Brisanje nije uspjelo.');
      return;
    }
    toast.success('Mušterija je obrisana.');
    router.replace('/dashboard/clients');
    router.refresh();
  }

  const set = (key: keyof ClientEditValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));

  function startEditing() {
    setValues(clientValues(client));
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = clientEditSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Provjerite unesene podatke.');
      return;
    }

    setSaving(true);
    setError(null);
    const { data, error: updateError } = await createBrowserSupabaseClient()
      .from('clients')
      .update({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone_number: parsed.data.phoneNumber,
        address: parsed.data.address || null,
        oib: parsed.data.oib || null,
        notes: parsed.data.notes || null,
      })
      .eq('id', client.id)
      .select('*')
      .single();
    setSaving(false);

    if (updateError || !data) {
      setError(
        updateError?.code === UNIQUE_VIOLATION
          ? 'Druga mušterija već ima taj broj telefona.'
          : 'Spremanje nije uspjelo. Pokušajte ponovno.'
      );
      return;
    }

    setClient(data);
    setEditing(false);
    toast.success('Podaci mušterije su spremljeni.');
    router.refresh();
  }

  if (editing) {
    return (
      <Card className="p-5">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ime" value={values.firstName} onChange={set('firstName')} autoComplete="off" />
            <Field label="Prezime" value={values.lastName} onChange={set('lastName')} autoComplete="off" />
          </div>
          <Field label="Telefon" type="tel" inputMode="tel" value={values.phoneNumber} onChange={set('phoneNumber')} />
          <Field label="Adresa" value={values.address} onChange={set('address')} autoComplete="off" />
          <Field
            label="OIB"
            inputMode="numeric"
            maxLength={11}
            value={values.oib}
            onChange={(e) => setValues((prev) => ({ ...prev, oib: e.target.value.replace(/[^0-9]/g, '') }))}
          />
          <Field label="Napomena" value={values.notes} onChange={set('notes')} autoComplete="off" />
          <EditActions saving={saving} error={error} onCancel={() => setEditing(false)} />
        </form>
        {canDelete && (
          <button
            type="button"
            onClick={deleteClient}
            disabled={deleting}
            className={cn(
              'press-effect mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold disabled:opacity-60',
              deleteArmed
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-red-300 text-red-700 dark:border-red-500/50 dark:text-red-400'
            )}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={2} />}
            {deleteArmed
              ? 'Dodirni ponovno za trajno brisanje'
              : `Obriši mušteriju${jobCount > 0 ? ` i ${jobCount} ${jobCount === 1 ? 'nalog' : 'naloga'}` : ''}`}
          </button>
        )}
      </Card>
    );
  }

  const details = [
    { label: 'Adresa', value: client.address },
    { label: 'OIB', value: client.oib },
    { label: 'Napomena', value: client.notes },
  ].filter((d) => d.value);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-workshop-surface-hover">
          <User className="h-7 w-7 text-slate-500 dark:text-slate-300" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {client.first_name} {client.last_name}
          </h1>
          <p className="text-sm tabular-nums text-slate-500 dark:text-slate-300">{client.phone_number}</p>
        </div>
      </div>

      {details.length > 0 && (
        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-workshop-border">
          {details.map((d) => (
            <div key={d.label} className="flex gap-3">
              <dt className="w-20 flex-shrink-0 text-slate-500 dark:text-slate-400">{d.label}</dt>
              <dd className="min-w-0 break-words text-slate-900 dark:text-slate-100">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={`tel:${client.phone_number}`} className={primaryButton}>
          <Phone className="h-4 w-4" strokeWidth={2} /> Nazovi
        </a>
        <button type="button" onClick={startEditing} className={outlineButton}>
          <Pencil className="h-4 w-4" strokeWidth={2} /> Uredi
        </button>
      </div>
    </Card>
  );
}

function vehicleValues(vehicle: Vehicle): VehicleEditValues {
  return {
    registrationPlate: vehicle.registration_plate ?? '',
    make: vehicle.make ?? '',
    model: vehicle.model ?? '',
    year: vehicle.year ? String(vehicle.year) : '',
    vin: vehicle.vin ?? '',
  };
}

export function VehicleCard({ vehicle: initialVehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<VehicleEditValues>(() => vehicleValues(initialVehicle));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof VehicleEditValues, upper = false) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: upper ? e.target.value.toUpperCase() : e.target.value }));

  function startEditing() {
    setValues(vehicleValues(vehicle));
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = vehicleEditSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Provjerite unesene podatke.');
      return;
    }

    setSaving(true);
    setError(null);
    const { data, error: updateError } = await createBrowserSupabaseClient()
      .from('vehicles')
      .update({
        registration_plate: parsed.data.registrationPlate,
        make: parsed.data.make || null,
        model: parsed.data.model || null,
        year: parsed.data.year ? Number(parsed.data.year) : null,
        vin: parsed.data.vin || null,
      })
      .eq('id', vehicle.id)
      .select('*')
      .single();
    setSaving(false);

    if (updateError || !data) {
      setError(
        updateError?.code === UNIQUE_VIOLATION
          ? 'Vozilo s tom registarskom oznakom već postoji.'
          : 'Spremanje nije uspjelo. Pokušajte ponovno.'
      );
      return;
    }

    setVehicle(data);
    setEditing(false);
    toast.success('Podaci vozila su spremljeni.');
    router.refresh();
  }

  if (editing) {
    return (
      <Card className="p-4">
        <form onSubmit={save} className="space-y-4">
          <Field
            label="Registarska oznaka"
            value={values.registrationPlate}
            onChange={set('registrationPlate', true)}
            autoComplete="off"
            className="text-center text-lg font-bold uppercase tracking-widest"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marka" value={values.make} onChange={set('make')} autoComplete="off" />
            <Field label="Model" value={values.model} onChange={set('model')} autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Godina" inputMode="numeric" maxLength={4} value={values.year} onChange={set('year')} />
            <Field label="VIN" maxLength={17} value={values.vin} onChange={set('vin', true)} autoComplete="off" />
          </div>
          <EditActions saving={saving} error={error} onCancel={() => setEditing(false)} />
        </form>
      </Card>
    );
  }

  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const specs = [vehicle.year ? String(vehicle.year) : null, vehicle.vin ? `VIN ${vehicle.vin}` : null].filter(Boolean);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-workshop-surface-hover">
          <Car className="h-5 w-5 text-slate-500 dark:text-slate-300" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{makeModel || 'Vozilo'}</p>
          {vehicle.registration_plate && (
            <p className="font-mono text-sm font-bold tracking-wider text-slate-700 dark:text-slate-200">
              {vehicle.registration_plate}
            </p>
          )}
          {specs.length > 0 && (
            <p className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-300">{specs.join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/dashboard/vehicles/${vehicle.id}`} className={outlineButton}>
          <History className="h-4 w-4" strokeWidth={2} /> Povijest
        </Link>
        <button type="button" onClick={startEditing} className={outlineButton}>
          <Pencil className="h-4 w-4" strokeWidth={2} /> Uredi
        </button>
      </div>
    </Card>
  );
}
