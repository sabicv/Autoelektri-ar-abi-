import { z } from 'zod';

export const SYMPTOM_OPTIONS = [
  {
    code: 'PARASITIC_DRAIN',
    label: 'Akumulator se prazni preko noći / pražnjenje',
  },
  {
    code: 'DASHBOARD_LIGHTS',
    label: 'Svijetli lampica na armaturi (Check Engine, ABS, Airbag...)',
  },
  {
    code: 'NO_START_IGNITION',
    label: 'Auto ne pali / verglanje / problem s bravom',
  },
  {
    code: 'LIGHTING_WINDOWS_LOCKS',
    label: 'Svjetla, žmigavci, podizači stakala, centralno',
  },
  {
    code: 'AFTERMARKET_ACCESSORIES',
    label: 'Naknadno ugrađena oprema (Alarm, kuka, multimedija, kamera)',
  },
] as const;

export type SymptomCode = (typeof SYMPTOM_OPTIONS)[number]['code'];

const SYMPTOM_CODES = SYMPTOM_OPTIONS.map((option) => option.code) as [SymptomCode, ...SymptomCode[]];

export const COUNTRY_CODES = [
  { code: '+385', label: '🇭🇷 +385' },
  { code: '+386', label: '🇸🇮 +386' },
  { code: '+387', label: '🇧🇦 +387' },
  { code: '+381', label: '🇷🇸 +381' },
  { code: '+382', label: '🇲🇪 +382' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+43', label: '🇦🇹 +43' },
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+41', label: '🇨🇭 +41' },
] as const;

const PHOTO_TAG_SUBSET = z.enum(['INTAKE_CONDITION', 'REGISTRATION_CARD']);

const currentYear = new Date().getFullYear();

export const triageFormSchema = z.object({
  tenantSlug: z.string().min(1),
  firstName: z.string().trim().min(2, 'Upiši ime (barem 2 slova).').max(80),
  lastName: z.string().trim().min(2, 'Upiši prezime (barem 2 slova).').max(80),
  countryCode: z.string().min(2).max(4),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,12}$/, 'Upiši broj telefona, samo brojke i bez pozivnog.'),
  registrationPlate: z
    .string()
    .trim()
    .min(4, 'Upiši registraciju.')
    .max(15, 'Registarska oznaka je predugačka.')
    .transform((value) => value.toUpperCase()),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(80).optional(),
  year: z
    .number()
    .int()
    .min(1900, 'Provjeri godinu proizvodnje.')
    .max(currentYear + 1, 'Provjeri godinu proizvodnje.')
    .optional(),
  vin: z
    .string()
    .trim()
    .max(17, 'VIN ima najviše 17 znakova.')
    .optional()
    .transform((value) => (value ? value.toUpperCase() : value)),
  symptoms: z.array(z.enum(SYMPTOM_CODES)).min(1, 'Odaberi barem jedan simptom.'),
  description: z.string().trim().max(2000, 'Opis je predugačak.').optional(),
  isEmergency: z.boolean(),
  photos: z
    .array(
      z.object({
        path: z.string().min(1),
        tag: PHOTO_TAG_SUBSET,
      })
    )
    .max(12, 'Previše fotografija.'),
});

export type TriageFormValues = z.infer<typeof triageFormSchema>;
