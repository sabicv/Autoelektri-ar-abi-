import { TriangleAlert } from 'lucide-react';

export default function TenantNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <TriangleAlert className="h-9 w-9 text-amber-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Radionica nije pronađena</h1>
      <p className="text-sm text-slate-500">
        Provjerite je li QR kod ili poveznica ispravna. Ako ste sigurni da je link točan, obratite se
        radionici izravno.
      </p>
    </main>
  );
}
