import type { JobStatus } from '@/types/database';
import type { SymptomCode } from '@/lib/validation/triage';

// =====================================================================
// Curated demo dataset for /api/demo/reset — realistic job history for
// Autoelektroservis Šabić, used to demo the app to prospective customers.
// Every row this produces is tagged is_demo = true so a reset can never
// touch real client/job data (see the route handler).
// =====================================================================

export interface DemoStatusTrailEntry {
  status: JobStatus;
  daysAgo: number;
}

export interface DemoJobSeed {
  status: JobStatus;
  isEmergency?: boolean;
  daysAgoCreated: number;
  daysAgoFinished?: number;
  daysAgoCollected?: number;
  confirmedDaysAgo?: number;
  symptoms: SymptomCode[];
  diagnosticNotes?: string;
  workSummary?: string;
  diagnosticHours?: number;
  repairHours?: number;
  totalPartsCost?: number;
  totalLaborCost?: number;
  dtcCodes?: string[];
  batteryDrainMa?: number;
  moduleNotes?: string;
  statusTrail?: DemoStatusTrailEntry[];
}

export interface DemoVehicleSeed {
  make: string;
  model: string;
  year: number;
  registrationPlate: string;
  vin?: string;
  jobs: DemoJobSeed[];
}

export interface DemoClientSeed {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address?: string;
  oib?: string;
  vehicles: DemoVehicleSeed[];
}

export const DEMO_CLIENTS: DemoClientSeed[] = [
  {
    firstName: 'Ivan',
    lastName: 'Perić',
    phoneNumber: '+385981234567',
    address: 'Brnaze 12, Sinj',
    oib: '11122233344',
    vehicles: [
      {
        make: 'BMW',
        model: '320d F30',
        year: 2016,
        registrationPlate: 'ST-1234-AB',
        vin: 'WBA8E9105GK123456',
        jobs: [
          {
            status: 'COLLECTED',
            daysAgoCreated: 52,
            daysAgoFinished: 50,
            daysAgoCollected: 48,
            confirmedDaysAgo: 48,
            symptoms: ['DASHBOARD_LIGHTS', 'NO_START_IGNITION'],
            diagnosticNotes:
              'Povremeni gubitak napajanja, upaljene sve kontrolne lampice pri paljenju. Provjera CAS modula i akumulatora.',
            dtcCodes: ['P0562', 'B1318'],
            batteryDrainMa: 185,
            moduleNotes:
              'Parazitska potrošnja iznad dopuštene preko CAS modula uslijed istrošenog akumulatora. Nakon zamjene potrošnja u mirovanju pala na 18mA.',
            workSummary:
              'Zamijenjen akumulator (AGM 90Ah), izvršena BMW registracija baterije (IBS kodiranje) putem Autel IM608, brisanje pohranjenih grešaka, test parazitske potrošnje unutar norme.',
            diagnosticHours: 1.5,
            repairHours: 1,
            totalPartsCost: 210,
            totalLaborCost: 90,
            statusTrail: [
              { status: 'IN_DIAGNOSTIC', daysAgo: 51 },
              { status: 'IN_REPAIR', daysAgo: 50.5 },
              { status: 'FINISHED_AWAITING_PICKUP', daysAgo: 50 },
              { status: 'COLLECTED', daysAgo: 48 },
            ],
          },
        ],
      },
    ],
  },
  {
    firstName: 'Ana',
    lastName: 'Marić',
    phoneNumber: '+385912345678',
    address: 'Dalmatinska 5, Sinj',
    oib: '22233344455',
    vehicles: [
      {
        make: 'Volkswagen',
        model: 'Golf 7',
        year: 2017,
        registrationPlate: 'ST-5678-CD',
        vin: 'WVWZZZAUZHW123456',
        jobs: [
          {
            status: 'COLLECTED',
            daysAgoCreated: 210,
            daysAgoFinished: 208,
            daysAgoCollected: 206,
            confirmedDaysAgo: 206,
            symptoms: ['LIGHTING_WINDOWS_LOCKS'],
            diagnosticNotes: 'Prednji lijevi podizač stakla ne reagira na dugme.',
            workSummary: 'Zamijenjen motorić podizača stakla, testirano ispravno.',
            diagnosticHours: 0.5,
            repairHours: 1,
            totalPartsCost: 65,
            totalLaborCost: 35,
            statusTrail: [
              { status: 'IN_REPAIR', daysAgo: 209 },
              { status: 'FINISHED_AWAITING_PICKUP', daysAgo: 208 },
              { status: 'COLLECTED', daysAgo: 206 },
            ],
          },
          {
            status: 'FINISHED_AWAITING_PICKUP',
            daysAgoCreated: 9,
            daysAgoFinished: 1,
            symptoms: ['DASHBOARD_LIGHTS'],
            diagnosticNotes: 'Svijetli lampica airbag sustava, sumnja na konektor ispod suvozačkog sjedala.',
            dtcCodes: ['B2477'],
            moduleNotes:
              'Oksidacija na konektoru airbag senzora pod sjedalom, popravljeno i testirano — greška se ne vraća nakon brisanja.',
            workSummary: 'Popravljeno ožičenje airbag sustava, greška izbrisana, test OK. Čeka se preuzimanje.',
            diagnosticHours: 0.5,
            repairHours: 0.5,
            totalPartsCost: 25,
            totalLaborCost: 55,
            statusTrail: [
              { status: 'IN_DIAGNOSTIC', daysAgo: 8 },
              { status: 'IN_REPAIR', daysAgo: 3 },
              { status: 'FINISHED_AWAITING_PICKUP', daysAgo: 1 },
            ],
          },
        ],
      },
    ],
  },
  {
    firstName: 'Josip',
    lastName: 'Grubišić',
    phoneNumber: '+385957654321',
    address: 'Trilj bb, Trilj',
    oib: '33344455566',
    vehicles: [
      {
        make: 'Mercedes-Benz',
        model: 'Sprinter 316 CDI',
        year: 2015,
        registrationPlate: 'ST-9012-EF',
        vin: 'WDB9066331R123456',
        jobs: [
          {
            status: 'IN_REPAIR',
            daysAgoCreated: 4,
            symptoms: ['NO_START_IGNITION'],
            diagnosticNotes:
              'Vozilo se ne pokreće, kontakt-brava reagira ali motor ne pokreće starter. Sumnja na imobilizator.',
            dtcCodes: ['U0100'],
            moduleNotes:
              'ECU ne prima potvrdu od imobilizatora — izgubljena komunikacija nakon zamjene akumulatora. U tijeku: kodiranje rezervnog ključa i provjera EIS modula (Xhorse).',
            diagnosticHours: 2,
            totalLaborCost: 80,
            statusTrail: [
              { status: 'IN_DIAGNOSTIC', daysAgo: 3.5 },
              { status: 'IN_REPAIR', daysAgo: 1 },
            ],
          },
        ],
      },
    ],
  },
  {
    firstName: 'Marko',
    lastName: 'Botić',
    phoneNumber: '+385981239876',
    address: 'Bajagić 22, Sinj',
    oib: '44455566677',
    vehicles: [
      {
        make: 'Ford',
        model: 'Focus Mk3',
        year: 2014,
        registrationPlate: 'ST-3456-GH',
        vin: 'WF0FXXWPMFEA12345',
        jobs: [
          {
            status: 'PARASITIC_DRAIN_TESTING',
            daysAgoCreated: 7,
            symptoms: ['DASHBOARD_LIGHTS'],
            diagnosticNotes: 'Lampica EPS (elektro-servo upravljač) stalno svijetli, volan povremeno otežano okreće.',
            dtcCodes: ['C1517'],
            moduleNotes:
              'EPS modul javlja internu grešku senzora momenta, potrebna zamjena/reprogramiranje modula. Čeka se zamjenski modul za kodiranje.',
            diagnosticHours: 1,
            totalLaborCost: 45,
            statusTrail: [{ status: 'IN_DIAGNOSTIC', daysAgo: 6.5 }],
          },
        ],
      },
    ],
  },
  {
    firstName: 'Petra',
    lastName: 'Vuković',
    phoneNumber: '+385992223344',
    address: 'Glavice 8, Sinj',
    oib: '55566677788',
    vehicles: [
      {
        make: 'Škoda',
        model: 'Octavia III',
        year: 2019,
        registrationPlate: 'ST-7890-IJ',
        vin: 'TMBJJ7NE0K0123456',
        jobs: [
          {
            status: 'PARASITIC_DRAIN_TESTING',
            daysAgoCreated: 2,
            symptoms: ['PARASITIC_DRAIN'],
            diagnosticNotes: 'Akumulator prazan svako jutro, vozilo mirovalo preko noći.',
            batteryDrainMa: 420,
            moduleNotes:
              'Test parazitske potrošnje u tijeku — trenutno 420mA u mirovanju (granica cca 30–50mA). Vađenje osigurača redom, sumnja na modul osvjetljenja prtljažnika.',
            diagnosticHours: 1.5,
            statusTrail: [{ status: 'IN_DIAGNOSTIC', daysAgo: 1.5 }],
          },
        ],
      },
    ],
  },
  {
    firstName: 'Stipe',
    lastName: 'Jelavić',
    phoneNumber: '+385951112233',
    address: 'Han bb, Sinj',
    oib: '66677788899',
    vehicles: [
      {
        make: 'Peugeot',
        model: '308',
        year: 2013,
        registrationPlate: 'ST-2345-KL',
        vin: 'VF3LCBHZKFS123456',
        jobs: [
          {
            status: 'IN_DIAGNOSTIC',
            daysAgoCreated: 1,
            symptoms: ['DASHBOARD_LIGHTS', 'LIGHTING_WINDOWS_LOCKS'],
            diagnosticNotes:
              'Nakon zamjene akumulatora u drugom servisu, upaljeno više kontrolnih lampica i ne rade svi prozori.',
            dtcCodes: ['U0140'],
            diagnosticHours: 0.5,
            totalLaborCost: 25,
          },
        ],
      },
    ],
  },
  {
    firstName: 'Nikolina',
    lastName: 'Barešić',
    phoneNumber: '+385993334455',
    address: 'Otok bb, Sinj',
    oib: '77788899900',
    vehicles: [
      {
        make: 'Audi',
        model: 'A4 B9',
        year: 2020,
        registrationPlate: 'ST-6789-MN',
        vin: 'WAUZZZ8W1LA123456',
        jobs: [
          {
            status: 'PENDING_TRIAGE',
            isEmergency: true,
            daysAgoCreated: 0,
            symptoms: ['NO_START_IGNITION'],
            diagnosticNotes: 'Auto se ne pokreće od jutros, klijent žuri na put — traži hitan prijem.',
          },
        ],
      },
    ],
  },
];
