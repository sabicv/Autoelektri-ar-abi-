'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { newMechanicSchema } from '@/lib/validation/staff';
import { cn } from '@/lib/utils';
import type { StaffRole } from '@/types/database';

export interface StaffMember {
  id: string;
  full_name: string | null;
  role: StaffRole;
  email: string | null;
}

interface StaffManagerProps {
  initialStaff: StaffMember[];
  currentUserId: string;
}

const emptyForm = { fullName: '', email: '', password: '' };

export default function StaffManager({ initialStaff, currentUserId }: StaffManagerProps) {
  const [staff, setStaff] = useState(initialStaff);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();

    const parsed = newMechanicSchema.safeParse(form);
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
    setIsAdding(true);
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? 'Dodavanje mehaničara nije uspjelo.');
        return;
      }
      setStaff((prev) => [...prev, json.staff as StaffMember]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success(`${parsed.data.fullName} dodan. Predajte mu e-mail i lozinku za prijavu.`);
    } catch {
      toast.error('Dodavanje nije uspjelo. Provjerite internetsku vezu.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(member: StaffMember) {
    if (!window.confirm(`Ukloniti ${member.full_name ?? 'djelatnika'}? Više se neće moći prijaviti.`)) return;

    setRemovingId(member.id);
    try {
      const response = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: member.id }),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? 'Uklanjanje nije uspjelo.');
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      toast.success('Djelatnik uklonjen.');
    } catch {
      toast.error('Uklanjanje nije uspjelo. Provjerite internetsku vezu.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-workshop-border dark:bg-workshop-surface">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Djelatnici</h2>

      <ul className="divide-y divide-slate-100 dark:divide-workshop-border">
        {staff.map((member) => (
          <li key={member.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {member.full_name ?? 'Bez imena'}
                {member.id === currentUserId && <span className="font-normal text-slate-400"> (vi)</span>}
              </p>
              {member.email && <p className="truncate text-xs text-slate-500 dark:text-slate-300">{member.email}</p>}
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                member.role === 'owner'
                  ? 'bg-blue-50 text-blue-700 dark:bg-electric-blue/10 dark:text-electric-blue'
                  : 'bg-slate-100 text-slate-600 dark:bg-workshop-surface-hover dark:text-slate-300'
              )}
            >
              {member.role === 'owner' ? 'Vlasnik' : 'Mehaničar'}
            </span>
            {member.role === 'mechanic' && (
              <button
                type="button"
                onClick={() => handleRemove(member)}
                disabled={removingId === member.id}
                aria-label="Ukloni djelatnika"
                className="press-effect flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"
              >
                {removingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            )}
          </li>
        ))}
      </ul>

      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-workshop-surface-hover">
          <Field label="Ime i prezime" error={errors.fullName}>
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className={inputClass(!!errors.fullName)}
              placeholder="Ivan Horvat"
            />
          </Field>
          <Field label="E-mail za prijavu" error={errors.email}>
            <input
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass(!!errors.email)}
              placeholder="ivan@radionica.hr"
            />
          </Field>
          <Field label="Početna lozinka" error={errors.password}>
            <input
              type="text"
              autoComplete="off"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={inputClass(!!errors.password)}
              placeholder="barem 8 znakova"
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErrors({});
              }}
              className="press-effect min-h-[48px] flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 dark:border-workshop-border dark:text-slate-300"
            >
              Odustani
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="press-effect flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
            >
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAdding ? 'Dodavanje…' : 'Dodaj'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="press-effect flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-600 dark:border-workshop-border dark:text-slate-300"
        >
          <UserPlus className="h-4 w-4" strokeWidth={2} />
          Dodaj mehaničara
        </button>
      )}
    </section>
  );
}

function inputClass(hasError: boolean) {
  return cn(
    'w-full rounded-xl border bg-white px-3 py-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:bg-workshop-dark dark:text-slate-100',
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
