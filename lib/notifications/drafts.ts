import { formatEuroHR } from '@/lib/format';

// Deterministic Croatian message templates. Intentionally not LLM-generated:
// these are structured notifications (price, deadline, defect) where a
// human-reviewed, predictable draft is safer than free-form generation —
// the mechanic still edits and approves every word before anything sends.

export function draftJobFinishedMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  totalAmount: number;
  freeParkingDays: number;
  dailyParkingFee: number;
}): string {
  return (
    `Pozdrav ${params.clientFirstName}, dijagnostika i radovi na vozilu ${params.vehicleLabel} su završeni. ` +
    `Ukupno za platiti: ${formatEuroHR(params.totalAmount)}. ` +
    `Vozilo možete preuzeti idućih ${params.freeParkingDays} dana besplatno, nakon čega se obračunava ležarina od ${formatEuroHR(params.dailyParkingFee)}/dan.`
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

export function draftParkingWarningMessage(params: {
  clientFirstName: string;
  vehicleLabel: string;
  daysParked: number;
  accruedFee: number;
  dailyParkingFee: number;
}): string {
  return (
    `Pozdrav ${params.clientFirstName}, vaše vozilo ${params.vehicleLabel} je spremno za preuzimanje već ${params.daysParked} ${params.daysParked === 1 ? 'dan' : 'dana'}. ` +
    `Trenutno obračunata ležarina iznosi ${formatEuroHR(params.accruedFee)} (${formatEuroHR(params.dailyParkingFee)}/dan). ` +
    `Molimo preuzmite vozilo što prije kako biste izbjegli daljnje troškove.`
  );
}
