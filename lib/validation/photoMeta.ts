import { z } from 'zod';

// EXIF-derived fields that travel with a staged photo until it's attached.
export const photoMetaFields = {
  takenAt: z.string().datetime().nullable().optional(),
  gpsLat: z.number().min(-90).max(90).nullable().optional(),
  gpsLng: z.number().min(-180).max(180).nullable().optional(),
};

export function photoMetaColumns(photo: { takenAt?: string | null; gpsLat?: number | null; gpsLng?: number | null }) {
  return {
    taken_at: photo.takenAt ?? null,
    gps_lat: photo.gpsLat ?? null,
    gps_lng: photo.gpsLng ?? null,
  };
}
