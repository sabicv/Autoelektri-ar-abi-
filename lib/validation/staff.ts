import { z } from 'zod';

export const newMechanicSchema = z.object({
  fullName: z.string().trim().min(2, 'Unesite ime i prezime.').max(120),
  email: z.string().trim().toLowerCase().email('Unesite ispravnu e-mail adresu.'),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(72),
});

export const removeStaffSchema = z.object({
  profileId: z.string().uuid(),
});

export type NewMechanicValues = z.infer<typeof newMechanicSchema>;
