'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';
import { PHOTO_TAG_LABELS_HR } from '@/lib/format';
import type { LightboxPhoto } from '../PhotoLightbox';

const PhotoLightbox = dynamic(() => import('../PhotoLightbox'), { ssr: false });

export interface DocumentItem extends LightboxPhoto {
  isPdf: boolean;
}

// Thumbnails in the grid; a tap opens the full photo over the whole screen
// (swipe through the rest), a PDF opens in a new tab.
export default function DocumentGrid({ items }: { items: DocumentItem[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images = items.filter((i) => !i.isPdf && i.url);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              item.isPdf
                ? item.url && window.open(item.url, '_blank', 'noopener')
                : setLightboxIndex(images.findIndex((i) => i.id === item.id))
            }
            aria-label={item.isPdf ? 'Otvori dokument' : 'Prikaži fotografiju'}
            className="press-effect relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-workshop-border dark:bg-workshop-surface-hover"
          >
            {item.isPdf || !item.url ? (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-slate-400">
                <FileText className="h-8 w-8" strokeWidth={1.5} />
                {item.caption && <span className="line-clamp-2 text-center text-[10px] leading-tight">{item.caption}</span>}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbUrl || item.url}
                alt={PHOTO_TAG_LABELS_HR[item.tag]}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-left text-[10px] font-semibold text-white">
              {new Date(item.takenAt ?? item.createdAt).toLocaleDateString('hr-HR')} · {PHOTO_TAG_LABELS_HR[item.tag]}
            </span>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && lightboxIndex >= 0 && (
        <PhotoLightbox photos={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}
