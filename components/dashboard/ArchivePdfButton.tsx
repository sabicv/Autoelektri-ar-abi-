'use client';

import { useState } from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { archiveWorkOrder } from '@/lib/archiveWorkOrder';

export default function ArchivePdfButton({ jobId }: { jobId: string }) {
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    const ok = await archiveWorkOrder(jobId);
    setIsSaving(false);
    if (ok) toast.success('PDF je spremljen u arhivu naloga.');
    else toast.error('Spremanje PDF-a nije uspjelo.');
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={isSaving}
      className="press-effect print:hidden flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-electric-blue dark:text-workshop-dark"
    >
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" strokeWidth={2} />}
      Spremi u arhivu
    </button>
  );
}
