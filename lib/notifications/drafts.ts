import { formatEuroHR } from '@/lib/format';

// Deterministic Croatian message templates. Intentionally not LLM-generated:
// these are structured notifications (price, defect, status) where a
// human-reviewed, predictable draft is safer than free-form generation —
// the mechanic still edits and approves every word before anything sends.
//
// No parking-fee or penalty language anywhere here by design — client
// communication stays informative and professional, not fee-threatening.

export function draftJobFinishedMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  totalAmount: number;
}): string {
  return (
    `Pozdrav ${params.clientFirstName}, dijagnostika i radovi na vozilu ${params.vehicleLabel} su završeni. ` +
    `Ukupno za platiti: ${formatEuroHR(params.totalAmount)}. Vozilo vas čeka na preuzimanje, javite nam se za dogovor.`
  );
}

export function draftDiagnosticCompleteMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  faultSummary?: string;
}): string {
  const fault = params.faultSummary?.trim();
  return (
    `Pozdrav ${params.clientFirstName}, dijagnostika na vašem vozilu ${params.vehicleLabel} je završena, ` +
    `${fault ? `kvar je lociran: ${fault}.` : 'kvar je lociran.'} Možete nas kontaktirati za detalje.`
  );
}

export function draftUpsellMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  defectDescription: string;
  price: number;
}): string {
  return (
    `Pozdrav ${params.clientFirstName}, tijekom dijagnostike na vozilu ${params.vehicleLabel} pronašli smo dodatni kvar: ` +
    `${params.defectDescription}. Cijena popravka: ${formatEuroHR(params.price)}. ` +
    `Molimo potvrdite želite li da nastavimo sa zahvatom.`
  );
}
