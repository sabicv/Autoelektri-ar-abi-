// Curated list of common OBD-II / CAN-bus fault codes for the diagnostic
// workbench's autocomplete. Not exhaustive — the input also accepts any
// free-typed code that isn't in this list (real vehicles throw codes we
// can't fully enumerate), this just speeds up the common cases.

export interface DtcCodeEntry {
  code: string;
  description: string;
}

export const COMMON_DTC_CODES: DtcCodeEntry[] = [
  { code: 'P0300', description: 'Slučajni/više cilindara – promašaj paljenja' },
  { code: 'P0301', description: 'Promašaj paljenja – cilindar 1' },
  { code: 'P0302', description: 'Promašaj paljenja – cilindar 2' },
  { code: 'P0303', description: 'Promašaj paljenja – cilindar 3' },
  { code: 'P0304', description: 'Promašaj paljenja – cilindar 4' },
  { code: 'P0130', description: 'Kvar kruga lambda sonde – banka 1, senzor 1' },
  { code: 'P0171', description: 'Sustav previše siromašan – banka 1' },
  { code: 'P0172', description: 'Sustav previše bogat – banka 1' },
  { code: 'P0420', description: 'Učinkovitost katalizatora ispod praga – banka 1' },
  { code: 'P0440', description: 'Kvar EVAP sustava' },
  { code: 'P0442', description: 'EVAP sustav – mali propust' },
  { code: 'P0455', description: 'EVAP sustav – veliki propust' },
  { code: 'P0500', description: 'Kvar senzora brzine vozila' },
  { code: 'P0505', description: 'Kvar sustava praznog hoda' },
  { code: 'P0562', description: 'Nizak napon sustava' },
  { code: 'P0563', description: 'Visok napon sustava' },
  { code: 'P0601', description: 'Greška interne memorije ECU-a' },
  { code: 'P0700', description: 'Zahtjev za dijagnostiku mjenjača (TCM)' },
  { code: 'U0100', description: 'Gubitak komunikacije s ECM/PCM modulom' },
  { code: 'U0101', description: 'Gubitak komunikacije s TCM modulom' },
  { code: 'U0121', description: 'Gubitak komunikacije s ABS modulom' },
  { code: 'U0140', description: 'Gubitak komunikacije s BCM modulom' },
  { code: 'U0155', description: 'Gubitak komunikacije s instrument klasterom' },
  { code: 'U0164', description: 'Gubitak komunikacije s HVAC modulom' },
  { code: 'U0184', description: 'Gubitak komunikacije s radio/infotainment modulom' },
  { code: 'U0300', description: 'Nekompatibilnost softvera unutar modula' },
  { code: 'B1000', description: 'Generalni kvar ECU-a karoserije' },
  { code: 'B1318', description: 'Nizak napon baterije' },
  { code: 'B2477', description: 'Kvar senzora airbaga' },
  { code: 'C0035', description: 'Kvar senzora brzine kotača – prednji lijevi' },
  { code: 'C0040', description: 'Kvar senzora brzine kotača – prednji desni' },
];

export function searchDtcCodes(query: string, limit = 8): DtcCodeEntry[] {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return COMMON_DTC_CODES.slice(0, limit);

  return COMMON_DTC_CODES.filter(
    (entry) =>
      entry.code.startsWith(normalized) ||
      entry.description.toUpperCase().includes(normalized)
  ).slice(0, limit);
}
