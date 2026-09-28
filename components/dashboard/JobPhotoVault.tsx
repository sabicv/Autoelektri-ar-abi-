'use client';

import { useEffect, useState } from 'react';
import { FileText, ImageOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { PHOTO_TAG_LABELS_HR, isPdfPath } from '@/lib/format';
import { signWithThumbnails, thumbPath } from '@/lib/thumbnails';
import Skeleton from '@/components/ui/Skeleton';
import dynamic from 'next/dynamic';
import type { LightboxPhoto } from './PhotoLightbox';

const PhotoLightbox = dynamic(() => import('./PhotoLightbox'), { ssr: false });

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

      const signed = await signWithThumbnails(
        supabase.storage.from('job-vault'),
        rows.map((r) => r.photo_url)
      );

      if (cancelled) return;

      setPhotos(
        rows.map((r) => ({
          id: r.id,
          path: r.photo_url,
          url: signed.get(r.photo_url)?.url ?? '',
          thumbUrl: signed.get(r.photo_url)?.thumbUrl,
          tag: r.tag,
          caption: r.caption,
          createdAt: r.created_at,
          takenAt: r.taken_at,
          gpsLat: r.gps_lat,
          gpsLng: r.gps_lng,
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

    await supabase.storage.from('job-vault').remove([photo.path, thumbPath(photo.path)]);
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
        <p className="text-sm">Nema fotografija ni dokumenata.</p>
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
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-slate-400 dark:text-slate-400">
                  <FileText className="h-8 w-8" strokeWidth={1.5} />
                </div>
              ) : (
                photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumbUrl || photo.url}
                    alt={PHOTO_TAG_LABELS_HR[photo.tag]}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
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
                className="press-effect absolute right-0 top-0 flex h-12 w-12 items-start justify-end p-1 disabled:opacity-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </span>
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
