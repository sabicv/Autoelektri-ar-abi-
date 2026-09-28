import { formatEuroHR, vocativeHR } from '@/lib/format';

// Deterministic Croatian message drafts. Intentionally not LLM-generated:
// these carry prices and defects, so a predictable draft is safer — the
// mechanic still edits and approves every word before anything sends.
//
// Tone: standard Croatian, warm and direct, "ti" form — like a trusted
// local workshop, not a corporation. No slang, no dialect, no fee threats.

export function draftJobFinishedMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  totalAmount: number;
}): string {
  return (
    `Bok ${vocativeHR(params.clientFirstName)}, radovi na tvom vozilu ${params.vehicleLabel} su gotovi i auto te čeka. ` +
    `Ukupno: ${formatEuroHR(params.totalAmount)}. Javi kad ti odgovara doći po njega.`
  );
}

export function draftDiagnosticCompleteMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  faultSummary?: string;
}): string {
  const fault = params.faultSummary?.trim();
  return (
    `Bok ${vocativeHR(params.clientFirstName)}, dijagnostika na tvom vozilu ${params.vehicleLabel} je gotova. ` +
    `${fault ? `Pronašli smo: ${fault}.` : 'Pronašli smo što je problem.'} Javi se pa ti objasnimo što dalje.`
  );
}

export function draftUpsellMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  defectDescription: string;
  price: number;
}): string {
  return (
    `Bok ${vocativeHR(params.clientFirstName)}, dok smo radili na tvom vozilu ${params.vehicleLabel}, našli smo još jedan kvar: ` +
    `${params.defectDescription}. Popravak bi koštao ${formatEuroHR(params.price)}. Da ga odmah riješimo?`
  );
}
