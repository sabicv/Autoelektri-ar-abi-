'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { PHOTO_TAG_LABELS_HR } from '@/lib/format';
import Skeleton from '@/components/ui/Skeleton';
import PhotoLightbox, { type LightboxPhoto } from './PhotoLightbox';

interface JobPhotoVaultProps {
  jobId: string;
}

export default function JobPhotoVault({ jobId }: JobPhotoVaultProps) {
  const [photos, setPhotos] = useState<LightboxPhoto[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
        <p className="text-sm">Nema fotografija u arhivi.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="press-effect relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-workshop-border dark:bg-workshop-surface-hover"
          >
            {photo.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={PHOTO_TAG_LABELS_HR[photo.tag]} className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
              {PHOTO_TAG_LABELS_HR[photo.tag]}
            </span>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox photos={photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}
