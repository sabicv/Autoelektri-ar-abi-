'use client';

import { useRef, useState } from 'react';
import { Camera, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { PHOTO_TAG_LABELS_HR } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PhotoTag } from '@/types/database';

interface JobPhotoUploaderProps {
  jobId: string;
  tenantId: string;
  onUploaded?: () => void;
}

const SELECTABLE_TAGS: PhotoTag[] = [
  'WIRING_DEFECT',
  'DTC_DIAGNOSTIC_SCREEN',
  'NEW_PARTS',
  'PARTS_INVOICE',
  'INTAKE_CONDITION',
  'REGISTRATION_CARD',
  'DOCUMENT',
];

// These two are as likely to be a scanned/exported PDF (a diagnostic tool's
// scan report, a supplier's invoice) as a photo — everything else stays
// camera-first since it's always a photo of the vehicle/car itself.
const DOCUMENT_LIKE_TAGS: PhotoTag[] = ['DOCUMENT', 'PARTS_INVOICE'];

function sanitizeFileName(fileName: string) {
  return fileName.normalize('NFKD').replace(/[^\w.-]+/g, '_').toLowerCase();
}

export default function JobPhotoUploader({ jobId, tenantId, onUploaded }: JobPhotoUploaderProps) {
  const [tag, setTag] = useState<PhotoTag>('WIRING_DEFECT');
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDocumentLike = DOCUMENT_LIKE_TAGS.includes(tag);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);

    const supabase = createBrowserSupabaseClient();

    for (const file of Array.from(fileList)) {
      // Staff already has full RLS access to their own tenant's job-vault
      // folder, so this uploads straight to the final path — no temp
      // staging + move step needed (that dance exists only for the public,
      // anonymous triage flow).
      const path = `${tenantId}/${jobId}/${tag}_${Date.now()}_${sanitizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage.from('job-vault').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        toast.error(`Prijenos "${file.name}" nije uspio.`);
        continue;
      }

      const { error: insertError } = await supabase.from('job_photos').insert({
        job_id: jobId,
        tenant_id: tenantId,
        photo_url: path,
        tag,
      });

      if (insertError) {
        toast.error('Datoteka je prenesena, ali nije zabilježena u arhivu.');
        continue;
      }
    }

    setIsUploading(false);
    toast.success(isDocumentLike ? 'Dokument dodan u arhiv.' : 'Fotografija dodana u arhiv.');
    onUploaded?.();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SELECTABLE_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t)}
            className={cn(
              'press-effect rounded-full px-2.5 py-1 text-xs font-semibold',
              tag === t
                ? 'bg-blue-600 text-white dark:bg-electric-blue dark:text-workshop-dark'
                : 'bg-slate-100 text-slate-600 dark:bg-workshop-surface-hover dark:text-slate-300'
            )}
          >
            {PHOTO_TAG_LABELS_HR[t]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="press-effect flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 disabled:opacity-60 dark:border-workshop-border dark:text-slate-400"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isDocumentLike ? (
          <FileText className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Camera className="h-4 w-4" strokeWidth={2} />
        )}
        {isUploading
          ? 'Prijenos…'
          : `${isDocumentLike ? 'Dodaj dokument' : 'Dodaj fotografiju'} (${PHOTO_TAG_LABELS_HR[tag]})`}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={isDocumentLike ? 'image/*,application/pdf' : 'image/*'}
        capture={isDocumentLike ? undefined : 'environment'}
        multiple
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
