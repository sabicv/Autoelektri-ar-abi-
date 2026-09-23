'use client';

import { useState } from 'react';
import { AlertCircle, KeyRound, Loader2, RefreshCw, Send, X } from 'lucide-react';

interface SmartLockboxModalProps {
  open: boolean;
  onClose: () => void;
  job: {
    id: string;
    clientFirstName: string;
  };
  onSent?: () => void;
}

// Cryptographically random 4-digit PIN (Math.random() is not suitable for
// anything resembling access control, even a low-stakes physical lockbox).
function generateSecurePin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 10000).toString().padStart(4, '0');
}

function buildLockboxMessage(clientFirstName: string, pin: string): string {
  return `Pozdrav ${clientFirstName}! Vaši ključevi nalaze se u sefu na ulazu. Vaš PIN za preuzimanje je: ${pin}. Hvala na povjerenju!`;
}

export default function SmartLockboxModal({ open, onClose, job, onSent }: SmartLockboxModalProps) {
  const [pin, setPin] = useState(() => generateSecurePin());
  const [message, setMessage] = useState(() => buildLockboxMessage(job.clientFirstName, pin));
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function regeneratePin() {
    const newPin = generateSecurePin();
    setPin(newPin);
    setMessage(buildLockboxMessage(job.clientFirstName, newPin));
  }

  async function handleSend() {
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CUSTOM', jobId: job.id, message }),
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
      <div className="w-full max-w-sm space-y-5 rounded-t-2xl bg-white p-5 shadow-xl dark:bg-workshop-surface sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pametni sef za ključeve</h2>
          <button
            type="button"
            onClick={onClose}
            className="press-effect flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-workshop-surface-hover"
            aria-label="Zatvori"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 py-6 dark:border-electric-blue/40 dark:bg-electric-blue/10">
          <KeyRound className="h-6 w-6 text-blue-600 dark:text-electric-blue" strokeWidth={2} />
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-electric-blue">
            PIN za preuzimanje
          </p>
          <p className="text-4xl font-black tracking-[0.3em] text-blue-700 dark:text-electric-blue">{pin}</p>
          <button
            type="button"
            onClick={regeneratePin}
            className="press-effect mt-1 flex min-h-[44px] items-center gap-1.5 px-2 text-xs font-semibold text-blue-600 dark:text-electric-blue"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} /> Generiraj novi PIN
          </button>
        </div>

        <div>
          <label htmlFor="lockboxMessage" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Poruka klijentu
          </label>
          <textarea
            id="lockboxMessage"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface-hover dark:text-slate-100"
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={2} /> {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" strokeWidth={2} />}
          {isSending ? 'Slanje…' : 'POŠALJI PIN NA WHATSAPP'}
        </button>
      </div>
    </div>
  );
}
