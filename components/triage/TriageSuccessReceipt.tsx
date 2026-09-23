'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { CheckCircle2, Clock, MessageCircle, Phone, ShieldCheck } from 'lucide-react';

interface TriageSuccessReceiptProps {
  jobReference: string;
  registrationPlate: string;
  isEmergency: boolean;
  tenant: {
    name: string;
    phone: string | null;
    freeParkingDays: number;
    dailyParkingFee: number;
  };
}

function formatEuro(value: number) {
  return Number.isInteger(value) ? `${value}€` : `${value.toFixed(2)}€`;
}

export default function TriageSuccessReceipt({
  jobReference,
  registrationPlate,
  isEmergency,
  tenant,
}: TriageSuccessReceiptProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(jobReference, {
      width: 240,
      margin: 1,
      color: { dark: '#1d4ed8', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // Non-critical — the text reference code below still works.
      });
    return () => {
      cancelled = true;
    };
  }, [jobReference]);

  const waitLabel = isEmergency
    ? 'Hitni prijem — javljamo vam se u najkraćem mogućem roku, danas.'
    : 'Uobičajeno vrijeme čekanja: 1–2 radna dana. Javit ćemo vam se čim mehaničar pregleda vozilo.';

  const whatsappNumber = tenant.phone ? tenant.phone.replace(/[^0-9]/g, '') : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
      >
        <CheckCircle2 className="h-9 w-9 text-emerald-600" strokeWidth={2} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h1 className="text-2xl font-bold text-slate-900">Prijava zaprimljena!</h1>
        <p className="mt-1 text-sm text-slate-500">
          {tenant.name} je zaprimio vaš zahtjev. Sačuvajte šifru prijave ispod.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Šifra prijave</p>
        <p className="mt-1 text-3xl font-black tracking-widest text-blue-700">{jobReference}</p>

        <div className="mx-auto mt-4 flex h-[152px] w-[152px] items-center justify-center rounded-xl bg-white p-2 shadow-sm">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR kod za šifru prijave ${jobReference}`} className="h-full w-full" />
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
          )}
        </div>

        <p className="mt-3 text-sm font-medium text-slate-600">
          Registracija: <span className="font-bold text-slate-900">{registrationPlate}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left"
      >
        <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={2} />
        <p className="text-sm text-slate-700">{waitLabel}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left"
      >
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={2} />
        <p className="text-sm text-slate-700">
          Besplatno parkiranje {tenant.freeParkingDays} dana nakon završetka radova, nakon čega se
          obračunava ležarina od {formatEuro(tenant.dailyParkingFee)}/dan.
        </p>
      </motion.div>

      {tenant.phone && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid w-full grid-cols-2 gap-3"
        >
          <a
            href={`tel:${tenant.phone}`}
            className="press-effect flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-800"
          >
            <Phone className="h-4 w-4" strokeWidth={2} /> Nazovi
          </a>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Pozdrav! Moja šifra prijave je ${jobReference}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press-effect flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} /> WhatsApp
            </a>
          )}
        </motion.div>
      )}
    </main>
  );
}
