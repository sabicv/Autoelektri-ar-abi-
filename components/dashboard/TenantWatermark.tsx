'use client';

import { useEffect, useState } from 'react';

// The workshop's logo as a faint mark fixed behind the dashboard: content
// scrolls over it, cards cover it, so it only shows in the gaps. A logo
// usually sits on its own background (a dark square here), which would
// print as a grey box, so that is keyed out first: pixels close to the
// corner colour become transparent, leaving just the drawing. A logo that
// is already transparent keeps its own alpha.

const MAX_SIDE = 640;

function extractMark(image: HTMLImageElement): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('no canvas');
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const px = pixels.data;
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((i) => i * 4);
  const bg = [0, 1, 2, 3].map((c) => corners.reduce((sum, i) => sum + px[i + c], 0) / corners.length);

  if (bg[3] >= 128) {
    for (let i = 0; i < px.length; i += 4) {
      const distance = Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2]));
      px[i + 3] = Math.round(px[i + 3] * Math.min(1, Math.max(0, (distance - 24) / 72)));
    }
    context.putImageData(pixels, 0, 0);
  }
  return canvas.toDataURL('image/png');
}

export default function TenantWatermark({ logoUrl }: { logoUrl: string | null }) {
  const [mark, setMark] = useState<string | null>(null);

  useEffect(() => {
    setMark(null);
    if (!logoUrl) return;
    let cancelled = false;
    const image = new Image();
    // The branding bucket is public with CORS open, so the canvas stays readable.
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const url = extractMark(image);
        if (!cancelled) setMark(url);
      } catch {
        // Unreadable image: simply no watermark.
      }
    };
    image.src = logoUrl;
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  if (!mark) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mark}
        alt=""
        className="absolute -bottom-[4vh] -right-[10vw] w-[80vw] max-w-[520px] opacity-[0.1] dark:opacity-[0.1]"
      />
    </div>
  );
}
