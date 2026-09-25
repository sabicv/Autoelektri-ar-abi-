import type { JobStatus, PhotoTag } from '@/types/database';

export function formatEuroHR(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

// Simplified, repair-workflow-only labels. PARASITIC_DRAIN_TESTING and
// AWAITING_MODULE_REMAP intentionally share one label — the mechanic picks
// a single "Test pražnjenja / moduli" step from the status drawer
// (see SELECTABLE_JOB_STATUSES in JobCard.tsx); AWAITING_MODULE_REMAP stays
// in the enum only so older records keep a valid, correctly-labeled status.
export const JOB_STATUS_LABELS_HR: Record<JobStatus, string> = {
  PENDING_TRIAGE: 'Novi prijem',
  IN_DIAGNOSTIC: 'U dijagnostici',
  PARASITIC_DRAIN_TESTING: 'Test pražnjenja / moduli',
  AWAITING_MODULE_REMAP: 'Test pražnjenja / moduli',
  IN_REPAIR: 'Rad u tijeku',
  FINISHED_AWAITING_PICKUP: 'Gotovo / spremno',
  COLLECTED: 'Preuzeto',
};

export const PHOTO_TAG_LABELS_HR: Record<PhotoTag, string> = {
  INTAKE_CONDITION: 'Stanje pri prijemu',
  REGISTRATION_CARD: 'Prometna dozvola',
  DTC_DIAGNOSTIC_SCREEN: 'Dijagnostički zaslon',
  WIRING_DEFECT: 'Kvar na instalaciji',
  NEW_PARTS: 'Novi dijelovi',
  PARTS_INVOICE: 'Račun za dijelove',
  DOCUMENT: 'Dokument',
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

// Ground truth for "can this render as <img>?" — independent of tag choice,
// since a DOCUMENT/PARTS_INVOICE-tagged file could still be a photo of a
// paper receipt, not necessarily a PDF.
export function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf');
}
