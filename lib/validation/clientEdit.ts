import { z } from 'zod';

const currentYear = new Date().getFullYear();
const optionalText = (max: number, message: string) => z.string().trim().max(max, message);

// Editing records that already exist: looser than intake (a company can
// sit in "Ime" with an empty "Prezime"), but phone, OIB, plate and VIN
// keep their shapes because search and matching depend on them.
export const clientEditSchema = z.object({
  firstName: z.string().trim().min(1, 'Unesite ime.').max(80),
  lastName: optionalText(80, 'Prezime je predugačko.'),
  phoneNumber: z
    .string()
    .transform((value) => value.replace(/[\s\-/()]/g, ''))
    .pipe(z.string().regex(/^\+?[0-9]{6,15}$/, 'Unesite ispravan broj telefona.')),
  address: optionalText(200, 'Adresa je predugačka.'),
  oib: z
    .string()
    .trim()
    .regex(/^([0-9]{11})?$/, 'OIB mora imati točno 11 znamenki.'),
  notes: optionalText(1000, 'Napomena je predugačka.'),
});

export type ClientEditValues = z.input<typeof clientEditSchema>;

export const vehicleEditSchema = z.object({
  registrationPlate: z
    .string()
    .trim()
    .min(2, 'Unesite registarsku oznaku.')
    .max(15, 'Registarska oznaka je predugačka.')
    .transform((value) => value.toUpperCase()),
  make: optionalText(60, 'Marka je predugačka.'),
  model: optionalText(80, 'Model je predugačak.'),
  year: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (/^[0-9]{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= currentYear + 1),
      'Unesite ispravnu godinu proizvodnje.'
    ),
  vin: z
    .string()
    .trim()
    .max(17, 'VIN ima najviše 17 znakova.')
    .transform((value) => value.toUpperCase()),
});

export type VehicleEditValues = z.input<typeof vehicleEditSchema>;
