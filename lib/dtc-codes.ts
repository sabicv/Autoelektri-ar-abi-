import type { SymptomCode } from '@/lib/validation/triage';

// Local fault-code reference for the diagnostic workbench, tuned for an
// auto-electrician working on European cars (VAG, BMW, Mercedes, PSA, Ford)
// with Autel / KESS3 / Autotuner. Not exhaustive: any free-typed code is
// still accepted, this only saves typing and explains the common ones.
// A `brand` marks a manufacturer-specific meaning of the code.

// CAN / komunikacija, imobilizator i ključ, punjenje i start, motor i
// senzori, ispuh (EGR, DPF, AdBlue), ECU i programiranje, ABS i airbag,
// karoserija i komfor.
export type DtcCategory = 'CAN' | 'IMMO' | 'NAPAJANJE' | 'MOTOR' | 'ISPUH' | 'ECU' | 'SIGURNOST' | 'KAROSERIJA';
export type DtcBrand = 'VAG' | 'BMW' | 'Mercedes' | 'PSA' | 'Ford';

export interface DtcCodeEntry {
  code: string;
  description: string;
  category: DtcCategory;
  brand?: DtcBrand;
  keywords?: string[];
}

const IMMO_WORDS = ['imobilizator', 'immo', 'ključ', 'transponder', 'ne pali', 'kontakt brava', 'sinkronizacija'];
const CHARGING_WORDS = ['akumulator', 'baterija', 'alternator', 'punjenje', 'regulator', 'prazni se'];
const STARTER_WORDS = ['anlaser', 'elektropokretač', 'starter', 'ne pali', 'verglanje'];
const GLOW_WORDS = ['žarnice', 'grijači', 'predgrijavanje', 'hladni start', 'dizel'];
const MAF_WORDS = ['maf', 'protokomjer', 'zrak', 'nema snage'];
const TURBO_WORDS = ['turbo', 'tlak punjenja', 'nema snage', 'sigurnosni način', 'limp'];
const MISFIRE_WORDS = ['preskakanje', 'trese', 'bobina', 'svjećica'];
const EGR_WORDS = ['egr', 'recirkulacija'];
const DPF_WORDS = ['dpf', 'fap', 'filtar čestica', 'regeneracija'];
const ADBLUE_WORDS = ['adblue', 'scr', 'nox'];
const ECU_WORDS = ['ecu', 'kess', 'autotuner', 'remap', 'čip', 'flash', 'programiranje'];
const WHEEL_SPEED_WORDS = ['abs', 'esp', 'senzor kotača', 'davač'];

export const DTC_CODES: DtcCodeEntry[] = [
  // CAN / komunikacija
  { code: 'U0001', description: 'CAN sabirnica (high speed) – kvar komunikacije', category: 'CAN', keywords: ['can bus', 'sabirnica', 'mreža'] },
  { code: 'U0073', description: 'Komunikacijska sabirnica A isključena (bus off)', category: 'CAN', keywords: ['can bus', 'sabirnica'] },
  { code: 'U0100', description: 'Gubitak komunikacije s ECM/PCM', category: 'CAN', keywords: ['motor', 'ecu', 'ne pali'] },
  { code: 'U0101', description: 'Gubitak komunikacije s TCM (mjenjač)', category: 'CAN', keywords: ['mjenjač', 'automatik'] },
  { code: 'U0121', description: 'Gubitak komunikacije s ABS-om', category: 'CAN', keywords: ['abs', 'esp', 'kočnice'] },
  { code: 'U0140', description: 'Gubitak komunikacije s BCM (modul karoserije)', category: 'CAN', keywords: ['bcm', 'svjetla', 'centralno', 'komfor'] },
  { code: 'U0151', description: 'Gubitak komunikacije s modulom airbaga', category: 'CAN', keywords: ['airbag', 'zračni jastuk', 'srs'] },
  { code: 'U0155', description: 'Gubitak komunikacije s instrument pločom', category: 'CAN', keywords: ['armatura', 'instrumenti', 'kilometar sat'] },
  { code: 'U0164', description: 'Gubitak komunikacije s modulom klime (HVAC)', category: 'CAN', keywords: ['klima', 'grijanje'] },
  { code: 'U0184', description: 'Gubitak komunikacije s radiom / multimedijom', category: 'CAN', keywords: ['radio', 'multimedija', 'navigacija'] },
  { code: 'U0401', description: 'Nevaljani podaci od ECM/PCM', category: 'CAN', keywords: ['motor', 'ecu'] },
  { code: 'U0415', description: 'Nevaljani podaci od ABS modula', category: 'CAN', keywords: ['abs', 'esp'] },

  // Imobilizator i ključ
  { code: 'B1041', description: 'Greška transpondera / sinkronizacije ključa', category: 'IMMO', keywords: IMMO_WORDS },
  { code: 'B3005', description: 'Greška transpondera / sinkronizacije ključa', category: 'IMMO', keywords: IMMO_WORDS },
  { code: 'P0513', description: 'Neispravan ključ imobilizatora', category: 'IMMO', keywords: IMMO_WORDS },
  { code: 'P0633', description: 'Ključ imobilizatora nije programiran u ECU', category: 'IMMO', keywords: [...IMMO_WORDS, 'zamjena ecu'] },
  { code: 'P1570', description: 'ECU motora blokiran imobilizatorom', category: 'IMMO', brand: 'VAG', keywords: IMMO_WORDS },
  { code: 'B1600', description: 'PATS – signal transpondera ključa nije primljen', category: 'IMMO', brand: 'Ford', keywords: IMMO_WORDS },
  { code: 'B1601', description: 'PATS – pogrešan kod transpondera ključa', category: 'IMMO', brand: 'Ford', keywords: IMMO_WORDS },

  // Punjenje i start
  { code: 'P0560', description: 'Napon sustava – kvar', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P0562', description: 'Nizak napon sustava', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P0563', description: 'Visok napon sustava', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P0620', description: 'Krug upravljanja alternatora', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P0621', description: 'Krug lampice alternatora (L)', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P0622', description: 'Krug upravljanja poljem alternatora (F)', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P2502', description: 'Napon punjenja izvan granica', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P2503', description: 'Nizak napon punjenja', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P2504', description: 'Visok napon punjenja', category: 'NAPAJANJE', keywords: CHARGING_WORDS },
  { code: 'P0615', description: 'Krug releja anlasera', category: 'NAPAJANJE', keywords: STARTER_WORDS },
  { code: 'P0616', description: 'Krug releja anlasera – nizak signal', category: 'NAPAJANJE', keywords: STARTER_WORDS },
  { code: 'B1318', description: 'Nizak napon akumulatora', category: 'NAPAJANJE', brand: 'Ford', keywords: CHARGING_WORDS },

  // Motor i senzori
  { code: 'P0016', description: 'Korelacija radilice i bregaste (banka 1, senzor A)', category: 'MOTOR', keywords: ['lanac', 'razvod', 'radilica', 'bregasta'] },
  { code: 'P0087', description: 'Prenizak tlak goriva u railu', category: 'MOTOR', keywords: ['common rail', 'pumpa goriva', 'ne pali', 'gasi se'] },
  { code: 'P0088', description: 'Previsok tlak goriva u railu', category: 'MOTOR', keywords: ['common rail', 'regulator tlaka'] },
  { code: 'P0100', description: 'MAF senzor protoka zraka – kvar kruga', category: 'MOTOR', keywords: MAF_WORDS },
  { code: 'P0101', description: 'MAF senzor protoka zraka – signal izvan raspona', category: 'MOTOR', keywords: MAF_WORDS },
  { code: 'P0102', description: 'MAF senzor protoka zraka – nizak signal', category: 'MOTOR', keywords: MAF_WORDS },
  { code: 'P0106', description: 'MAP senzor tlaka usisa – signal izvan raspona', category: 'MOTOR', keywords: ['map', 'tlak usisa'] },
  { code: 'P0115', description: 'Senzor temperature rashladne tekućine – kvar kruga', category: 'MOTOR', keywords: ['temperatura', 'rashladna', 'ventilator'] },
  { code: 'P0190', description: 'Senzor tlaka goriva u railu – kvar kruga', category: 'MOTOR', keywords: ['common rail', 'tlak goriva'] },
  { code: 'P0201', description: 'Brizgaljka cilindra 1 – kvar kruga', category: 'MOTOR', keywords: ['injektor', 'dizna', 'brizgaljka'] },
  { code: 'P0234', description: 'Previsok pritisak punjenja turbopunjača', category: 'MOTOR', keywords: TURBO_WORDS },
  { code: 'P0299', description: 'Prenizak pritisak punjenja turbopunjača', category: 'MOTOR', keywords: TURBO_WORDS },
  { code: 'P0300', description: 'Nasumični / višestruki promašaj paljenja', category: 'MOTOR', keywords: MISFIRE_WORDS },
  { code: 'P0301', description: 'Promašaj paljenja – cilindar 1', category: 'MOTOR', keywords: MISFIRE_WORDS },
  { code: 'P0302', description: 'Promašaj paljenja – cilindar 2', category: 'MOTOR', keywords: MISFIRE_WORDS },
  { code: 'P0303', description: 'Promašaj paljenja – cilindar 3', category: 'MOTOR', keywords: MISFIRE_WORDS },
  { code: 'P0304', description: 'Promašaj paljenja – cilindar 4', category: 'MOTOR', keywords: MISFIRE_WORDS },
  { code: 'P0335', description: 'Senzor položaja radilice – kvar kruga', category: 'MOTOR', keywords: ['radilica', 'ckp', 'davač', 'ne pali', 'gasi se'] },
  { code: 'P0340', description: 'Senzor položaja bregaste osovine – kvar kruga', category: 'MOTOR', keywords: ['bregasta', 'cmp', 'davač', 'ne pali'] },
  { code: 'P0380', description: 'Grijači (žarnice) – kvar kruga A', category: 'MOTOR', keywords: GLOW_WORDS },
  { code: 'P0670', description: 'Modul žarnica – kvar kruga upravljanja', category: 'MOTOR', keywords: [...GLOW_WORDS, 'relej žarnica'] },
  { code: 'P0671', description: 'Žarnica cilindra 1 – kvar kruga', category: 'MOTOR', keywords: GLOW_WORDS },
  { code: 'P0672', description: 'Žarnica cilindra 2 – kvar kruga', category: 'MOTOR', keywords: GLOW_WORDS },
  { code: 'P0673', description: 'Žarnica cilindra 3 – kvar kruga', category: 'MOTOR', keywords: GLOW_WORDS },
  { code: 'P0674', description: 'Žarnica cilindra 4 – kvar kruga', category: 'MOTOR', keywords: GLOW_WORDS },
  { code: 'P0500', description: 'Senzor brzine vozila – kvar', category: 'MOTOR', keywords: ['brzina', 'kilometar sat', 'vss'] },
  { code: 'P0505', description: 'Regulacija praznog hoda – kvar', category: 'MOTOR', keywords: ['prazni hod', 'leptir', 'gasi se'] },
  { code: 'P0627', description: 'Pumpa goriva – krug upravljanja otvoren', category: 'MOTOR', keywords: ['pumpa goriva', 'ne pali'] },
  { code: 'P0700', description: 'Kvar mjenjača – zatražena dijagnostika TCM-a', category: 'MOTOR', keywords: ['mjenjač', 'automatik'] },
  { code: 'P0715', description: 'Senzor brzine ulaznog vratila mjenjača', category: 'MOTOR', keywords: ['mjenjač', 'automatik'] },
  { code: 'P2015', description: 'Greška usisne grane / klapni', category: 'MOTOR', brand: 'VAG', keywords: ['usisna grana', 'klapne', 'vrtložne klapne', 'tdi'] },

  // Ispuh, EGR, DPF
  { code: 'P0130', description: 'Lambda sonda (banka 1, senzor 1) – kvar kruga', category: 'ISPUH', keywords: ['lambda', 'sonda'] },
  { code: 'P0135', description: 'Grijač lambda sonde (banka 1, senzor 1) – kvar kruga', category: 'ISPUH', keywords: ['lambda', 'sonda', 'grijač'] },
  { code: 'P0171', description: 'Smjesa presiromašna – banka 1', category: 'ISPUH', keywords: ['smjesa', 'lambda', 'usis zraka'] },
  { code: 'P0172', description: 'Smjesa prebogata – banka 1', category: 'ISPUH', keywords: ['smjesa', 'lambda'] },
  { code: 'P0400', description: 'Protok EGR-a – kvar', category: 'ISPUH', keywords: EGR_WORDS },
  { code: 'P0401', description: 'Protok EGR ventila nedovoljan', category: 'ISPUH', keywords: EGR_WORDS },
  { code: 'P0402', description: 'Protok EGR-a prevelik', category: 'ISPUH', keywords: EGR_WORDS },
  { code: 'P0403', description: 'EGR ventil – kvar kruga upravljanja', category: 'ISPUH', keywords: EGR_WORDS },
  { code: 'P0420', description: 'Učinkovitost katalizatora ispod praga – banka 1', category: 'ISPUH', keywords: ['katalizator', 'lambda'] },
  { code: 'P0440', description: 'EVAP sustav – kvar', category: 'ISPUH', keywords: ['evap', 'isparavanje goriva'] },
  { code: 'P2002', description: 'Učinkovitost DPF filtra ispod praga', category: 'ISPUH', keywords: DPF_WORDS },
  { code: 'P2452', description: 'Senzor tlaka DPF-a – kvar kruga', category: 'ISPUH', keywords: [...DPF_WORDS, 'senzor tlaka'] },
  { code: 'P2453', description: 'Senzor tlaka DPF-a – signal izvan raspona', category: 'ISPUH', keywords: [...DPF_WORDS, 'senzor tlaka'] },
  { code: 'P2463', description: 'DPF zapušen čađom', category: 'ISPUH', keywords: [...DPF_WORDS, 'čađa', 'nema snage'] },
  { code: 'P242F', description: 'DPF zapušen pepelom', category: 'ISPUH', keywords: [...DPF_WORDS, 'pepeo'] },
  { code: 'P20EE', description: 'SCR katalizator – učinkovitost ispod praga', category: 'ISPUH', keywords: ADBLUE_WORDS },
  { code: 'P203F', description: 'Razina AdBlue tekućine preniska', category: 'ISPUH', keywords: ADBLUE_WORDS },
  { code: 'P2BAC', description: 'NOx prekoračenje – EGR isključen', category: 'ISPUH', keywords: [...ADBLUE_WORDS, ...EGR_WORDS] },

  // ECU i programiranje (nakon KESS3 / Autotuner / zamjene modula)
  { code: 'P0601', description: 'Greška kontrolnog zbroja memorije ECU-a', category: 'ECU', keywords: [...ECU_WORDS, 'checksum'] },
  { code: 'P0602', description: 'Greška programiranja ECU-a', category: 'ECU', keywords: ECU_WORDS },
  { code: 'P0603', description: 'Greška trajne memorije (KAM) ECU-a', category: 'ECU', keywords: ECU_WORDS },
  { code: 'P0604', description: 'Greška RAM memorije ECU-a', category: 'ECU', keywords: ECU_WORDS },
  { code: 'P0605', description: 'Greška ROM memorije ECU-a', category: 'ECU', keywords: ECU_WORDS },
  { code: 'P0606', description: 'Kvar procesora ECU-a', category: 'ECU', keywords: ECU_WORDS },
  { code: 'P0610', description: 'Greška opcija vozila u ECU-u (kodiranje)', category: 'ECU', keywords: [...ECU_WORDS, 'kodiranje'] },
  { code: 'P0630', description: 'VIN nije programiran ili se ne podudara (ECU)', category: 'ECU', keywords: [...ECU_WORDS, 'vin', 'zamjena ecu'] },
  { code: 'U0300', description: 'Nekompatibilan softver modula', category: 'ECU', keywords: [...ECU_WORDS, 'softver', 'kodiranje', 'zamjena modula'] },
  { code: 'P1000', description: 'OBD provjere nisu dovršene (nakon brisanja grešaka)', category: 'ECU', brand: 'Ford', keywords: ['obd', 'brisanje grešaka'] },

  // ABS i airbag
  { code: 'C0035', description: 'Senzor brzine kotača – prednji lijevi', category: 'SIGURNOST', keywords: WHEEL_SPEED_WORDS },
  { code: 'C0040', description: 'Senzor brzine kotača – prednji desni', category: 'SIGURNOST', keywords: WHEEL_SPEED_WORDS },
  { code: 'B0001', description: 'Airbag vozača – krug aktivacije (stupanj 1)', category: 'SIGURNOST', keywords: ['airbag', 'zračni jastuk', 'srs', 'spiralni kabel', 'volan'] },

  // Karoserija i komfor
  { code: '4203', description: 'Greška grijača / modul grijača', category: 'KAROSERIJA', brand: 'BMW', keywords: ['grijanje', 'grijač', 'modul grijača'] },
];

// Folds case and Croatian diacritics so "kljuc" finds "ključ".
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Words, not one string: "kljuc" must not hit "isključena". The category
// id (CAN, IMMO) is searchable, but not a broad label like "Ispuh, EGR,
// DPF", or "dpf" would return every exhaust code.
const SEARCH_WORDS = new Map(
  DTC_CODES.map((entry) => [
    entry,
    fold([entry.code, entry.description, entry.category, entry.brand ?? '', ...(entry.keywords ?? [])].join(' '))
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  ])
);

const BY_CODE = new Map(DTC_CODES.map((entry) => [entry.code, entry]));

export function findDtcCode(code: string): DtcCodeEntry | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

// Codes first (exact, then prefix, then "0299" → P0299), then any entry
// where every typed word starts a word of its description, category,
// brand or keywords.
export function searchDtcCodes(query: string, limit = 8): DtcCodeEntry[] {
  const compact = query.trim().toUpperCase().replace(/\s+/g, '');
  if (!compact) return [];
  const words = fold(query).split(/[^a-z0-9]+/).filter(Boolean);
  const startsWithDigit = /^[0-9]/.test(compact);

  const scored: { entry: DtcCodeEntry; score: number }[] = [];
  for (const entry of DTC_CODES) {
    const entryWords = SEARCH_WORDS.get(entry)!;
    let score = 0;
    if (entry.code === compact) score = 4;
    else if (entry.code.startsWith(compact)) score = 3;
    else if (startsWithDigit && entry.code.slice(1).startsWith(compact)) score = 2;
    else if (compact.length >= 2 && words.every((word) => entryWords.some((w) => w.startsWith(word)))) score = 1;
    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

// What an auto-electrician checks first for each intake symptom.
const SYMPTOM_SUGGESTIONS: Record<SymptomCode, string[]> = {
  PARASITIC_DRAIN: ['P0562', 'P0620', 'P2502', 'U0140', 'U0001', 'B1318'],
  DASHBOARD_LIGHTS: ['U0100', 'U0121', 'U0401', 'P0299', 'P0401', 'P0101', 'C0035', 'B0001'],
  NO_START_IGNITION: ['B1041', 'B3005', 'P0335', 'P0340', 'P0615', 'P0562', 'P1570', 'P0087'],
  LIGHTING_WINDOWS_LOCKS: ['U0140', 'U0001', 'U0073', 'U0155', 'P0562'],
  AFTERMARKET_ACCESSORIES: ['U0184', 'U0140', 'U0001', 'U0073', 'P0562'],
};

// Without symptoms, the codes this workshop sees most.
const DEFAULT_SUGGESTIONS = ['U0100', 'U0121', 'P0562', 'P0620', 'B1041', 'P0299', 'P0401', 'P2015'];

export function suggestDtcForSymptoms(symptoms: string[], exclude: string[] = [], limit = 6): DtcCodeEntry[] {
  const fromSymptoms = symptoms.flatMap((s) => SYMPTOM_SUGGESTIONS[s as SymptomCode] ?? []);
  const codes = fromSymptoms.length > 0 ? fromSymptoms : DEFAULT_SUGGESTIONS;
  const seen = new Set(exclude);
  const result: DtcCodeEntry[] = [];
  for (const code of codes) {
    const entry = BY_CODE.get(code);
    if (!entry || seen.has(code)) continue;
    seen.add(code);
    result.push(entry);
    if (result.length === limit) break;
  }
  return result;
}
