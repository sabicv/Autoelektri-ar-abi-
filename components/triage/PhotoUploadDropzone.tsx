'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Camera, CheckCircle2, Loader2, X, ZoomIn } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { PhotoTag } from '@/types/database';

export interface UploadedPhoto {
  path: string;
  tag: PhotoTag;
  previewUrl: string;
  fileName: string;
}

interface PendingUpload {
  id: string;
  previewUrl: string;
  fileName: string;
  status: 'uploading' | 'error';
}

interface PhotoUploadDropzoneProps {
  tenantId: string;
  tag: PhotoTag;
  label: string;
  hint?: string;
  maxFiles?: number;
  maxFileSizeMb?: number;
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .toLowerCase();
}

export default function PhotoUploadDropzone({
  tenantId,
  tag,
  label,
  hint,
  maxFiles = 4,
  maxFileSizeMb = 20,
  photos,
  onChange,
}: PhotoUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<UploadedPhoto | null>(null);
  const supabase = createBrowserSupabaseClient();

  const remainingSlots = Math.max(maxFiles - photos.length - pending.length, 0);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setGlobalError(null);

    const files = Array.from(fileList).slice(0, remainingSlots);

    for (const file of files) {
      if (file.size > maxFileSizeMb * 1024 * 1024) {
        setGlobalError(`Fotografija "${file.name}" je prevelika (max ${maxFileSizeMb}MB).`);
        continue;
      }

      const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      const path = `${tenantId}/temp_${Date.now()}_${sanitizeFileName(file.name)}`;

      setPending((prev) => [...prev, { id: localId, previewUrl, fileName: file.name, status: 'uploading' }]);

      const { error } = await supabase.storage.from('job-vault').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (error) {
        setPending((prev) => prev.map((p) => (p.id === localId ? { ...p, status: 'error' as const } : p)));
        continue;
      }

      setPending((prev) => prev.filter((p) => p.id !== localId));
      onChange([...photos, { path, tag, previewUrl, fileName: file.name }]);
    }
  }

  async function removePhoto(photo: UploadedPhoto) {
    onChange(photos.filter((p) => p.path !== photo.path));
    URL.revokeObjectURL(photo.previewUrl);
    await supabase.storage.from('job-vault').remove([photo.path]);
  }

  function dismissPending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-slate-800">{label}</p>
      {hint && <p className="mb-3 text-xs text-slate-500">{hint}</p>}

      <div className="grid grid-cols-3 gap-2">
        <AnimatePresence initial={false}>
          {photos.map((photo) => (
            <motion.div
              key={photo.path}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <button
                type="button"
                onClick={() => setPreviewPhoto(photo)}
                className="press-effect block h-full w-full"
                aria-label="Prikaži fotografiju"
              >
                {/* Local blob preview — the actual file already lives in Storage. */}
                <img src={photo.previewUrl} alt={photo.fileName} className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-active:bg-black/20 group-active:opacity-100">
                  <ZoomIn className="h-5 w-5 text-white" strokeWidth={2} />
                </span>
              </button>
              <div className="pointer-events-none absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5 text-white">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo)}
                className="press-effect absolute left-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Ukloni fotografiju"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </motion.div>
          ))}

          {pending.map((p) => (
            <motion.button
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              type="button"
              onClick={() => (p.status === 'error' ? dismissPending(p.id) : undefined)}
              className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <img src={p.previewUrl} alt={p.fileName} className="h-full w-full object-cover opacity-40" />
              <div className="absolute inset-0 flex items-center justify-center">
                {p.status === 'uploading' ? (
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" strokeWidth={2} />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-500" strokeWidth={2} />
                )}
              </div>
              {p.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-slate-200/80">
                  <motion.div
                    className="h-full w-1/3 bg-blue-500"
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </motion.button>
          ))}
        </AnimatePresence>

        {remainingSlots > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="press-effect flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-400 hover:border-blue-400 hover:text-blue-500"
          >
            <Camera className="h-6 w-6" strokeWidth={2} />
            <span className="text-[11px] font-medium">Dodaj</span>
          </button>
        )}
      </div>

      {globalError && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} /> {globalError}
        </p>
      )}
      {pending.some((p) => p.status === 'error') && (
        <p className="mt-2 text-xs text-red-600">
          Prijenos nije uspio za jednu ili više fotografija. Dodirnite je da je uklonite i pokušate ponovno.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={maxFiles > 1}
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <AnimatePresence>
        {previewPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
            onClick={() => setPreviewPhoto(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="press-effect absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Zatvori"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={previewPhoto.previewUrl}
              alt={previewPhoto.fileName}
              className="max-h-full max-w-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
