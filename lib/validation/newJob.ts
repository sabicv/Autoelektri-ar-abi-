import { z } from 'zod';
import { SYMPTOM_OPTIONS, type SymptomCode } from './triage';

const SYMPTOM_CODES = SYMPTOM_OPTIONS.map((option) => option.code) as [SymptomCode, ...SymptomCode[]];
const currentYear = new Date().getFullYear();

// Same shape as triageFormSchema, minus tenantSlug/photos — a staff member
// creating a job manually is always scoped to their OWN tenant, resolved
// server-side from their session (never trusted from the client), and
// symptoms/description are free-form enough that staff aren't forced to
// tick a box before saving (unlike the public QR form).
export const newJobSchema = z.object({
  firstName: z.string().trim().min(2, 'Unesite ime (najmanje 2 znaka).').max(80),
  lastName: z.string().trim().min(2, 'Unesite prezime (najmanje 2 znaka).').max(80),
  countryCode: z.string().min(2).max(4),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,12}$/, 'Unesite ispravan broj telefona (samo brojevi, bez pozivnog).'),
  registrationPlate: z
    .string()
    .trim()
    .min(4, 'Unesite registarsku oznaku.')
    .max(15, 'Registarska oznaka je predugačka.')
    .transform((value) => value.toUpperCase()),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(80).optional(),
  year: z
    .number()
    .int()
    .min(1900, 'Unesite ispravnu godinu proizvodnje.')
    .max(currentYear + 1, 'Unesite ispravnu godinu proizvodnje.')
    .optional(),
  vin: z
    .string()
    .trim()
    .max(17, 'VIN ima najviše 17 znakova.')
    .optional()
    .transform((value) => (value ? value.toUpperCase() : value)),
  symptoms: z.array(z.enum(SYMPTOM_CODES)).default([]),
  description: z.string().trim().max(2000, 'Opis je predugačak.').optional(),
  isEmergency: z.boolean().default(false),
  address: z.string().trim().max(200, 'Adresa je predugačka.').optional(),
  oib: z
    .string()
    .trim()
    .regex(/^[0-9]{11}$/, 'OIB mora imati točno 11 znamenki.')
    .optional()
    .or(z.literal('')),
  photos: z
    .array(
      z.object({
        path: z.string().min(1),
        tag: z.enum(['INTAKE_CONDITION', 'REGISTRATION_CARD']),
      })
    )
    .max(8, 'Previše fotografija.')
    .default([]),
});

export type NewJobValues = z.infer<typeof newJobSchema>;
