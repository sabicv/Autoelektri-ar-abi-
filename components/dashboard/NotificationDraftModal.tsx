'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Pencil, Send, X } from 'lucide-react';
import { draftDiagnosticCompleteMessage, draftJobFinishedMessage, draftUpsellMessage } from '@/lib/notifications/drafts';
import { cn } from '@/lib/utils';
import PhotoUploadDropzone, { type UploadedPhoto } from '@/components/triage/PhotoUploadDropzone';

export type NotificationType = 'JOB_FINISHED' | 'DIAGNOSTIC_COMPLETE' | 'UPSELL_REQUEST' | 'CUSTOM';

interface NotificationDraftModalProps {
  open: boolean;
  onClose: () => void;
  type: NotificationType;
  tenantId: string;
  job: {
    id: string;
    clientFirstName: string;
    vehicleLabel: string;
    totalAmount?: number;
  };
  onSent?: () => void;
}

const TITLES: Record<NotificationType, string> = {
  JOB_FINISHED: 'Obavijest: posao završen',
  DIAGNOSTIC_COMPLETE: 'Obavijest: dijagnostika završena',
  UPSELL_REQUEST: 'Zahtjev za dodatni zahvat',
  CUSTOM: 'Poruka klijentu',
};

function buildInitialDraft(type: NotificationType, job: NotificationDraftModalProps['job']): string {
  switch (type) {
    case 'JOB_FINISHED':
      return draftJobFinishedMessage({
        clientFirstName: job.clientFirstName,
        vehicleLabel: job.vehicleLabel,
        totalAmount: job.totalAmount ?? 0,
      });
    case 'DIAGNOSTIC_COMPLETE':
      return draftDiagnosticCompleteMessage({
        clientFirstName: job.clientFirstName,
        vehicleLabel: job.vehicleLabel,
      });
    case 'UPSELL_REQUEST':
      return '';
    case 'CUSTOM':
      return `Pozdrav ${job.clientFirstName}, `;
  }
}

export default function NotificationDraftModal({
  open,
  onClose,
  type,
  tenantId,
  job,
  onSent,
}: NotificationDraftModalProps) {
  const [message, setMessage] = useState(() => buildInitialDraft(type, job));
  const [isEditing, setIsEditing] = useState(type === 'CUSTOM');
  const [defectDescription, setDefectDescription] = useState('');
  const [price, setPrice] = useState('');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [faultSummary, setFaultSummary] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNumber = useMemo(() => Number(price.replace(',', '.')), [price]);

  if (!open) return null;

  function regenerateUpsellDraft() {
    setMessage(
      draftUpsellMessage({
        clientFirstName: job.clientFirstName,
        vehicleLabel: job.vehicleLabel,
        defectDescription: defectDescription || '(opišite kvar)',
        price: Number.isFinite(priceNumber) ? priceNumber : 0,
      })
    );
    setIsEditing(false);
  }

  function regenerateDiagnosticDraft() {
    setMessage(
      draftDiagnosticCompleteMessage({
        clientFirstName: job.clientFirstName,
        vehicleLabel: job.vehicleLabel,
        faultSummary,
      })
    );
    setIsEditing(false);
  }

  async function handleSend() {
    setError(null);

    if (type === 'UPSELL_REQUEST') {
      if (!defectDescription.trim()) {
        setError('Unesite opis kvara.');
        return;
      }
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        setError('Unesite ispravnu cijenu.');
        return;
      }
      if (photos.length === 0) {
        setError('Dodajte fotografiju kvara kao dokaz.');
        return;
      }
    }

    if (!message.trim()) {
      setError('Poruka ne smije biti prazna.');
      return;
    }

    setIsSending(true);
    try {
      const payload =
        type === 'UPSELL_REQUEST'
          ? {
              type,
              jobId: job.id,
              message,
              defectDescription,
              price: priceNumber,
              photoPath: photos[0].path,
            }
          : type === 'DIAGNOSTIC_COMPLETE'
            ? { type, jobId: job.id, message, faultSummary: faultSummary || undefined }
            : { type, jobId: job.id, message };

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        setError(json.error ?? 'Slanje nije uspjelo. Pokušajte ponovno.');
        return;
      }

      onSent?.();
      onClose();
    } catch {
      setError('Slanje nije uspjelo. Provjerite internetsku vezu.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-workshop-surface sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-workshop-border">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{TITLES[type]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="press-effect flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-workshop-surface-hover"
            aria-label="Zatvori"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-workshop-surface-hover dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{job.clientFirstName}</span> —{' '}
            {job.vehicleLabel}
          </div>

          {type === 'UPSELL_REQUEST' && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-workshop-border">
              <div>
                <label
                  htmlFor="defectDescription"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Opis kvara
                </label>
                <textarea
                  id="defectDescription"
                  rows={2}
                  value={defectDescription}
                  onChange={(e) => setDefectDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
                  placeholder="Npr. pronađen prekid na instalaciji alternatora"
                />
              </div>

              <div>
                <label htmlFor="price" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Cijena popravka (€)
                </label>
                <input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9,.-]/g, ''))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
                  placeholder="120,00"
                />
              </div>

              <PhotoUploadDropzone
                tenantId={tenantId}
                tag="WIRING_DEFECT"
                label="Fotografija kvara"
                hint="Obavezno — šalje se kao dokaz uz zahtjev."
                maxFiles={1}
                photos={photos}
                onChange={setPhotos}
              />

              <button
                type="button"
                onClick={regenerateUpsellDraft}
                className="press-effect min-h-[44px] w-full rounded-xl border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 dark:border-electric-blue/30 dark:bg-electric-blue/10 dark:text-electric-blue"
              >
                Generiraj prijedlog poruke
              </button>
            </div>
          )}

          {type === 'DIAGNOSTIC_COMPLETE' && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-workshop-border">
              <div>
                <label
                  htmlFor="faultSummary"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Kratki nalaz (opcionalno)
                </label>
                <input
                  id="faultSummary"
                  value={faultSummary}
                  onChange={(e) => setFaultSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
                  placeholder="Npr. prekid na instalaciji alternatora"
                />
              </div>

              <button
                type="button"
                onClick={regenerateDiagnosticDraft}
                className="press-effect min-h-[44px] w-full rounded-xl border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 dark:border-electric-blue/30 dark:bg-electric-blue/10 dark:text-electric-blue"
              >
                Generiraj prijedlog poruke
              </button>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Poruka za WhatsApp</span>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-electric-blue"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} /> UREDI PORUKU
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                autoFocus
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
              />
            ) : (
              <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-200">
                {message || <span className="text-slate-400">Poruka će se prikazati ovdje.</span>}
              </div>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={2} /> {error}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-200 px-5 py-4 dark:border-workshop-border">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className={cn(
              'press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60'
            )}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" strokeWidth={2} />}
            {isSending ? 'Slanje…' : 'POŠALJI NA WHATSAPP'}
          </button>

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="press-effect min-h-[52px] w-full rounded-xl border-2 border-slate-300 text-sm font-semibold text-slate-700 dark:border-workshop-border dark:text-slate-200"
            >
              UREDI PORUKU
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
