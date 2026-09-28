'use client';

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/compressImage';
import { cn } from '@/lib/utils';
import type { UploadedPhoto } from '@/components/triage/PhotoUploadDropzone';

export interface ExtractedFields {
  firstName: string | null;
  lastName: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  registrationPlate: string | null;
}

type ScanState = 'idle' | 'working' | 'read' | 'failed';

interface RegistrationScannerProps {
  tenantId: string;
  photo: UploadedPhoto | null;
  onPhotoChange: (photo: UploadedPhoto | null) => void;
  onFields: (fields: ExtractedFields) => void;
}

function sanitizeFileName(fileName: string) {
  return fileName.normalize('NFKD').replace(/[^\w.-]+/g, '_').toLowerCase();
}

// Photograph (phone) or drop/pick (laptop) the registration card; the AI
// read fills the form, the photo itself is kept for the job's vault.
export default function RegistrationScanner({ tenantId, photo, onPhotoChange, onFields }: RegistrationScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>(photo ? 'read' : 'idle');
  const [isDragging, setIsDragging] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function discard(current: UploadedPhoto | null) {
    if (!current) return;
    URL.revokeObjectURL(current.previewUrl);
    await createBrowserSupabaseClient().storage.from('job-vault').remove([current.path]);
  }

  async function handleFile(original: File | undefined) {
    if (!original || !original.type.startsWith('image/')) return;

    await discard(photo);
    onPhotoChange(null);
    setFailure(null);
    setState('working');
    const file = await compressImage(original);

    const supabase = createBrowserSupabaseClient();
    const path = `${tenantId}/temp_${Date.now()}_${sanitizeFileName(file.name || 'prometna.jpg')}`;
    const { error: uploadError } = await supabase.storage
      .from('job-vault')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setState('failed');
      setFailure('Slika se nije uspjela poslati. Provjerite vezu i pokušajte ponovno.');
      return;
    }

    const uploaded: UploadedPhoto = {
      path,
      tag: 'REGISTRATION_CARD',
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
    };
    onPhotoChange(uploaded);

    try {
      const response = await fetch('/api/vision/registration-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath: path }),
      });
      const json = await response.json();
      if (!response.ok || !json.fields) throw new Error(json.error);

      const fields = json.fields as ExtractedFields;
      if (!fields.registrationPlate && !fields.lastName && !fields.make) throw new Error('empty');

      onFields(fields);
      setState('read');
    } catch {
      setState('failed');
      setFailure('Prometna nije pročitana — slikajte ponovno ili upišite ručno.');
    }
  }

  async function clear() {
    await discard(photo);
    onPhotoChange(null);
    setFailure(null);
    setState('idle');
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(event) => {
        handleFile(event.target.files?.[0]);
        event.target.value = '';
      }}
    />
  );

  if (state === 'idle') {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'press-effect flex min-h-[128px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-base font-semibold transition-colors',
            isDragging
              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-electric-blue dark:bg-electric-blue/10 dark:text-electric-blue'
              : 'border-blue-300 bg-blue-50/50 text-blue-700 dark:border-electric-blue/40 dark:bg-electric-blue/5 dark:text-electric-blue'
          )}
        >
          <Camera className="h-8 w-8" strokeWidth={2} />
          Slikaj prometnu dozvolu
        </button>
        {fileInput}
      </>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3',
        state === 'failed'
          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
          : 'border-slate-200 bg-white dark:border-workshop-border dark:bg-workshop-surface'
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.previewUrl} alt="Prometna dozvola" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-slate-100 dark:bg-workshop-surface-hover" />
      )}

      <div className="min-w-0 flex-1 text-sm">
        {state === 'working' && (
          <p className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-electric-blue">
            <Loader2 className="h-4 w-4 animate-spin" /> Čitam prometnu…
          </p>
        )}
        {state === 'read' && (
          <p className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Prometna pročitana
          </p>
        )}
        {state === 'failed' && (
          <p className="flex items-start gap-1.5 font-medium text-amber-800 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} /> {failure}
          </p>
        )}
      </div>

      {state !== 'working' && (
        <div className="flex flex-shrink-0 gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Slikaj ponovno"
            className="press-effect flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-workshop-surface-hover"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={clear}
            aria-label="Ukloni"
            className="press-effect flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-workshop-surface-hover"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}
      {fileInput}
    </div>
  );
}
