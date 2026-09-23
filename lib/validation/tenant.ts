import { z } from 'zod';

export const tenantSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Unesite naziv radionice.').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Skraćena poveznica mora imati barem 3 znaka.')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Dozvoljena su samo mala slova, brojevi i crtice.'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  logoUrl: z.string().url().optional().or(z.literal('')),
  freeParkingDays: z.number().int().min(0, 'Ne može biti negativno.').max(30, 'Najviše 30 dana.'),
  dailyParkingFee: z.number().min(0, 'Ne može biti negativno.').max(1000, 'Provjerite iznos.'),
  emergencySurchargePercent: z.number().min(0, 'Ne može biti negativno.').max(200, 'Provjerite postotak.'),
});

export type TenantSettingsValues = z.infer<typeof tenantSettingsSchema>;
