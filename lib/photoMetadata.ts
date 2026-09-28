'use client';

export interface PhotoMetadata {
  takenAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
}

function validDate(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  // Camera clocks left at their factory default (1970, 2000…) aren't a real capture time.
  if (value.getFullYear() < 2005 || value.getTime() > Date.now() + 86400000) return null;
  return value.toISOString();
}

// Must run on the ORIGINAL file — re-encoding for upload strips EXIF.
// Capture time falls back to the file's own timestamp (for a photo just
// taken with the camera that is the capture time). GPS is only present if
// the phone's camera stores location and the browser passes it through.
export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  const fallback = file.lastModified ? validDate(new Date(file.lastModified)) : null;
  if (!file.type.startsWith('image/')) return { takenAt: fallback, gpsLat: null, gpsLng: null };

  try {
    const exifr = (await import('exifr')).default;
    const [tags, gps] = await Promise.all([
      exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
      exifr.gps(file).catch(() => null),
    ]);
    const lat = typeof gps?.latitude === 'number' && Number.isFinite(gps.latitude) ? gps.latitude : null;
    const lng = typeof gps?.longitude === 'number' && Number.isFinite(gps.longitude) ? gps.longitude : null;
    return {
      takenAt: validDate(tags?.DateTimeOriginal) ?? validDate(tags?.CreateDate) ?? fallback,
      gpsLat: lat,
      gpsLng: lng,
    };
  } catch {
    return { takenAt: fallback, gpsLat: null, gpsLng: null };
  }
}
