'use client';

import { useEffect, useState } from 'react';
import { FileText, ImageOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { PHOTO_TAG_LABELS_HR } from '@/lib/format';
import Skeleton from '@/components/ui/Skeleton';
import PhotoLightbox, { type LightboxPhoto } from './PhotoLightbox';

function isPdfPath(path: string) {
  return path.toLowerCase().endsWith('.pdf');
}

interface JobPhotoVaultProps {
  jobId: string;
  // Off by default — the vehicle passport (VehicleHistoryTimeline) shows
  // this as an immutable historical record and should never allow
  // deletion there. Only the active job card (JobCard) enables it.
  allowDelete?: boolean;
}

export default function JobPhotoVault({ jobId, allowDelete = false }: JobPhotoVaultProps) {
  const [photos, setPhotos] = useState<LightboxPhoto[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data: rows, error } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error || !rows || rows.length === 0) {
        if (!cancelled) setPhotos([]);
        return;
      }

      const { data: signedUrls } = await supabase.storage
        .from('job-vault')
        .createSignedUrls(
          rows.map((r) => r.photo_url),
          3600
        );

      if (cancelled) return;

      const urlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

      setPhotos(
        rows.map((r) => ({
          id: r.id,
          path: r.photo_url,
          url: urlByPath.get(r.photo_url) ?? '',
          tag: r.tag,
          caption: r.caption,
          createdAt: r.created_at,
        }))
      );
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function handleDelete(photo: LightboxPhoto) {
    if (!window.confirm('Trajno obrisati ovu fotografiju iz arhiva?')) return;

    setDeletingId(photo.id);
    const supabase = createBrowserSupabaseClient();

    await supabase.storage.from('job-vault').remove([photo.path]);
    const { error } = await supabase.from('job_photos').delete().eq('id', photo.id);

    setDeletingId(null);

    if (error) {
      toast.error('Brisanje fotografije nije uspjelo.');
      return;
    }

    setPhotos((prev) => (prev ? prev.filter((p) => p.id !== photo.id) : prev));
    setLightboxIndex(null);
    toast.success('Fotografija obrisana.');
  }

  if (photos === null) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 py-8 text-slate-400 dark:border-workshop-border">
        <ImageOff className="h-6 w-6" strokeWidth={2} />
        <p className="text-sm">Nema fotografija ni dokumenata u arhivi.</p>
      </div>
    );
  }

  // The lightbox only knows how to render <img>, so it only ever sees the
  // image subset — a PDF opens directly in a new tab instead. Indexes into
  // this filtered list, not the full grid, so "next/prev" inside the
  // lightbox never lands on a document and tries to render it as an image.
  const imagePhotos = photos.filter((p) => !isPdfPath(p.path));

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo) => {
          const isDocument = isPdfPath(photo.path);

          return (
          <div
            key={photo.id}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-workshop-border dark:bg-workshop-surface-hover"
          >
            <button
              type="button"
              onClick={() =>
                isDocument
                  ? photo.url && window.open(photo.url, '_blank', 'noopener')
                  : setLightboxIndex(imagePhotos.findIndex((p) => p.id === photo.id))
              }
              className="press-effect block h-full w-full"
              aria-label={isDocument ? 'Otvori dokument' : 'Prikaži fotografiju'}
            >
              {isDocument ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-slate-400 dark:text-slate-500">
                  <FileText className="h-8 w-8" strokeWidth={1.5} />
                </div>
              ) : (
                photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={PHOTO_TAG_LABELS_HR[photo.tag]} className="h-full w-full object-cover" />
                )
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
                {PHOTO_TAG_LABELS_HR[photo.tag]}
              </span>
            </button>

            {allowDelete && (
              <button
                type="button"
                onClick={() => handleDelete(photo)}
                disabled={deletingId === photo.id}
                aria-label="Obriši fotografiju"
                className="press-effect absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox photos={imagePhotos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}
