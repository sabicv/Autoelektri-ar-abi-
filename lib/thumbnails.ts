import { isPdfPath } from '@/lib/format';

// Every photo gets a small JPEG preview stored next to it as
// "<path>.thumb.jpg" (made in the browser at upload, lib/compressImage.ts),
// so grids and timelines load ~20 KB tiles instead of 500 KB photos. The
// sibling path needs no schema change and passes the same storage policies.
// Photos from before this have none; callers fall back to the full image.

export function thumbPath(path: string) {
  return `${path}.thumb.jpg`;
}

export interface SignedMedia {
  url: string;
  thumbUrl: string;
}

interface SignableBucket {
  createSignedUrls(
    paths: string[],
    expiresIn: number
  ): Promise<{ data: { path: string | null; signedUrl: string | null; error: string | null }[] | null }>;
}

// One request for photos and their thumbnails; a missing thumbnail simply
// comes back as an error for that entry and the full URL stands in.
export async function signWithThumbnails(bucket: SignableBucket, paths: string[], expiresIn = 3600) {
  const result = new Map<string, SignedMedia>();
  if (paths.length === 0) return result;

  const thumbs = paths.filter((p) => !isPdfPath(p)).map(thumbPath);
  const { data } = await bucket.createSignedUrls([...paths, ...thumbs], expiresIn);
  const signed = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl);
  }

  for (const path of paths) {
    const url = signed.get(path) ?? '';
    result.set(path, { url, thumbUrl: signed.get(thumbPath(path)) ?? url });
  }
  return result;
}
