import Link from 'next/link';
import { LogIn, QrCode, Wrench } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white">
        <Wrench className="h-8 w-8" strokeWidth={2} />
      </div>

      <h1 className="mt-4 text-2xl font-bold text-slate-900">Auto Električar</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Digitalna platforma za auto-električarske radionice — prijava kvara bez čekanja, trajni foto
        arhiv i automatizirane obavijesti klijentima.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/login"
          className="press-effect flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <LogIn className="h-5 w-5" strokeWidth={2} /> Prijava za radionice
        </Link>
      </div>

      <div className="mt-10 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-xs text-slate-500">
        <QrCode className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={2} />
        <p>
          Ako ste klijent radionice, prijavu kvara obavljate putem QR koda ili poveznice koju vam je
          dala vaša radionica (oblika <code className="text-slate-700">/t/naziv-radionice</code>), ne
          preko ove stranice.
        </p>
      </div>
    </main>
  );
}
