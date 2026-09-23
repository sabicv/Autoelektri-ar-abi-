import type { JobStatus, PhotoTag } from '@/types/database';

export function formatEuroHR(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export const JOB_STATUS_LABELS_HR: Record<JobStatus, string> = {
  PENDING_TRIAGE: 'čeka pregled',
  IN_DIAGNOSTIC: 'u dijagnostici',
  PARASITIC_DRAIN_TESTING: 'testiranje parazitskog pražnjenja',
  AWAITING_MODULE_REMAP: 'čeka reprogramiranje modula',
  IN_REPAIR: 'u popravku',
  FINISHED_AWAITING_PICKUP: 'završeno, čeka preuzimanje',
  COLLECTED: 'preuzeto',
};

export const PHOTO_TAG_LABELS_HR: Record<PhotoTag, string> = {
  INTAKE_CONDITION: 'Stanje pri prijemu',
  REGISTRATION_CARD: 'Prometna dozvola',
  DTC_DIAGNOSTIC_SCREEN: 'Dijagnostički zaslon',
  WIRING_DEFECT: 'Kvar na instalaciji',
  NEW_PARTS: 'Novi dijelovi',
  PARTS_INVOICE: 'Račun za dijelove',
};

interface VehicleLike {
  make: string | null;
  model: string | null;
  registration_plate: string | null;
}

export function vehicleLabel(vehicle: VehicleLike): string {
  const parts = [vehicle.make, vehicle.model].filter(Boolean);
  const base = parts.length > 0 ? parts.join(' ') : 'vozilo';
  return vehicle.registration_plate ? `${base} (${vehicle.registration_plate})` : base;
}

export function daysSince(dateString: string | null): number {
  if (!dateString) return 0;
  const diffMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
