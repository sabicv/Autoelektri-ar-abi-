'use client';

import { useState } from 'react';
import { Lock, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { SYMPTOM_OPTIONS, type SymptomCode } from '@/lib/validation/triage';
import { cn } from '@/lib/utils';
import type { Client, Vehicle } from '@/types/database';

interface ClientVehicleEditorProps {
  jobId: string;
  tenantId: string;
  client: Client;
  vehicle: Vehicle;
  symptoms: string[];
  isEmergency: boolean;
  locked: boolean;
  onSaved?: (data: { client: Client; vehicle: Vehicle; symptoms: string[]; isEmergency: boolean }) => void;
}

export default function ClientVehicleEditor({
  jobId,
  tenantId,
  client,
  vehicle,
  symptoms,
  isEmergency,
  locked,
  onSaved,
}: ClientVehicleEditorProps) {
  const [firstName, setFirstName] = useState(client.first_name);
  const [lastName, setLastName] = useState(client.last_name);
  const [phoneNumber, setPhoneNumber] = useState(client.phone_number);
  const [make, setMake] = useState(vehicle.make ?? '');
  const [model, setModel] = useState(vehicle.model ?? '');
  const [year, setYear] = useState(vehicle.year ? String(vehicle.year) : '');
  const [vin, setVin] = useState(vehicle.vin ?? '');
  const [registrationPlate, setRegistrationPlate] = useState(vehicle.registration_plate ?? '');
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomCode[]>(symptoms as SymptomCode[]);
  const [emergency, setEmergency] = useState(isEmergency);
  const [isSaving, setIsSaving] = useState(false);

  function toggleSymptom(code: SymptomCode) {
    if (locked) return;
    setSelectedSymptoms((prev) => (prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]));
  }

  async function handleSave() {
    setIsSaving(true);
    const supabase = createBrowserSupabaseClient();

    const [clientRes, vehicleRes, jobRes] = await Promise.all([
      supabase
        .from('clients')
        .update({ first_name: firstName, last_name: lastName, phone_number: phoneNumber })
        .eq('id', client.id)
        .select('*')
        .single(),
      supabase
        .from('vehicles')
        .update({
          make: make || null,
          model: model || null,
          year: year ? Number(year) : null,
          vin: vin || null,
          registration_plate: registrationPlate,
        })
        .eq('id', vehicle.id)
        .select('*')
        .single(),
      supabase
        .from('jobs')
        .update({ symptoms: selectedSymptoms, is_emergency: emergency })
        .eq('id', jobId),
    ]);

    setIsSaving(false);

    if (clientRes.error || vehicleRes.error || jobRes.error || !clientRes.data || !vehicleRes.data) {
      toast.error('Spremanje podataka nije uspjelo.');
      return;
    }

    await supabase.from('job_events').insert({
      tenant_id: tenantId,
      job_id: jobId,
      event_type: 'JOB_DETAILS_EDITED',
      actor: 'mechanic',
      message: 'Podaci o klijentu/vozilu ažurirani.',
      metadata: {},
    });

    toast.success('Podaci spremljeni.');
    onSaved?.({
      client: clientRes.data,
      vehicle: vehicleRes.data,
      symptoms: selectedSymptoms,
      isEmergency: emergency,
    });
  }

  const inputClass = (disabled: boolean) =>
    cn(
      'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100',
      disabled && 'cursor-not-allowed opacity-60'
    );

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <Lock className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
          Nalog je potvrđen i zaključan — podaci se više ne mogu mijenjati.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Ime</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={locked}
            className={inputClass(locked)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Prezime</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={locked}
            className={inputClass(locked)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Telefon</label>
        <input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          disabled={locked}
          className={inputClass(locked)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Registarska oznaka
        </label>
        <input
          value={registrationPlate}
          onChange={(e) => setRegistrationPlate(e.target.value.toUpperCase())}
          disabled={locked}
          className={cn(inputClass(locked), 'text-center text-lg font-bold uppercase tracking-widest')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Marka</label>
          <input value={make} onChange={(e) => setMake(e.target.value)} disabled={locked} className={inputClass(locked)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} disabled={locked} className={inputClass(locked)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Godina</label>
          <input
            type="number"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={locked}
            className={inputClass(locked)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">VIN</label>
          <input
            maxLength={17}
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            disabled={locked}
            className={inputClass(locked)}
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Simptomi</p>
        <div className="space-y-1.5">
          {SYMPTOM_OPTIONS.map((option) => {
            const checked = selectedSymptoms.includes(option.code);
            return (
              <label
                key={option.code}
                className={cn(
                  'flex min-h-[44px] items-center gap-2 rounded-xl border-2 px-3 text-sm',
                  locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                  checked
                    ? 'border-blue-600 bg-blue-50 dark:border-electric-blue dark:bg-electric-blue/10'
                    : 'border-slate-200 dark:border-workshop-border'
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggleSymptom(option.code)}
                />
                <span className="text-slate-800 dark:text-slate-200">{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={emergency}
        disabled={locked}
        onClick={() => !locked && setEmergency((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border-2 p-3 text-left disabled:cursor-not-allowed disabled:opacity-60',
          emergency ? 'border-alarm-red bg-red-50 dark:bg-red-500/10' : 'border-slate-200 dark:border-workshop-border'
        )}
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hitni prijem</span>
        <span
          className={cn(
            'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
            emergency ? 'bg-alarm-red' : 'bg-slate-300 dark:bg-workshop-border'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              emergency ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </span>
      </button>

      {!locked && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" strokeWidth={2} />}
          {isSaving ? 'Spremanje…' : 'Spremi podatke'}
        </button>
      )}
    </div>
  );
}
