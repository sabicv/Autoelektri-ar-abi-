'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PHOTO_TAG_LABELS_HR } from '@/lib/format';
import type { PhotoTag } from '@/types/database';

export interface LightboxPhoto {
  id: string;
  path: string;
  url: string;
  tag: PhotoTag;
  caption: string | null;
  createdAt: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  onClose: () => void;
}

// Real touch-driven pinch-zoom + pan + double-tap, implemented directly
// against pointer/touch events rather than pulling in a zoom library for
// what's fundamentally ~50 lines of gesture math.
export default function PhotoLightbox({ photos, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchStateRef = useRef<{ startDistance: number; startScale: number } | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const lastTapRef = useRef(0);
  const isPinchingRef = useRef(false);

  const photo = photos[index];

  function resetZoom() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }

  function goTo(nextIndex: number) {
    resetZoom();
    setIndex((nextIndex + photos.length) % photos.length);
  }

  function handleTouchStart(event: React.TouchEvent) {
    if (event.touches.length === 2) {
      isPinchingRef.current = true;
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStateRef.current = { startDistance: distance, startScale: scale };
    } else if (event.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setScale((s) => (s > 1 ? 1 : 2.5));
        setTranslate({ x: 0, y: 0 });
      }
      lastTapRef.current = now;
      dragStateRef.current = {
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        originX: translate.x,
        originY: translate.y,
      };
    }
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (event.touches.length === 2 && pinchStateRef.current) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = (pinchStateRef.current.startScale * distance) / pinchStateRef.current.startDistance;
      setScale(Math.min(4, Math.max(1, next)));
    } else if (event.touches.length === 1 && dragStateRef.current && scale > 1) {
      const dx = event.touches[0].clientX - dragStateRef.current.startX;
      const dy = event.touches[0].clientY - dragStateRef.current.startY;
      setTranslate({ x: dragStateRef.current.originX + dx, y: dragStateRef.current.originY + dy });
    }
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (event.touches.length === 0) {
      pinchStateRef.current = null;
      dragStateRef.current = null;
      isPinchingRef.current = false;
      if (scale < 1.05) resetZoom();
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col bg-black"
      >
        <div className="flex items-center justify-between px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{PHOTO_TAG_LABELS_HR[photo.tag]}</p>
            <p className="text-xs text-white/60">
              {new Date(photo.createdAt).toLocaleString('hr-HR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="press-effect flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Zatvori"
          >
            <X className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>

        <div
          className="relative flex-1 touch-none select-none overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? PHOTO_TAG_LABELS_HR[photo.tag]}
            className="h-full w-full object-contain"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isPinchingRef.current ? 'none' : 'transform 150ms ease-out',
            }}
            draggable={false}
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                className="press-effect absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
                aria-label="Prethodna fotografija"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                className="press-effect absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
                aria-label="Sljedeća fotografija"
              >
                <ChevronRight className="h-6 w-6" strokeWidth={2} />
              </button>
            </>
          )}
        </div>

        {photo.caption && <p className="px-4 py-3 text-center text-sm text-white/80">{photo.caption}</p>}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
