import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Car, Search } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { vehicleLabel } from '@/lib/format';
import Card from '@/components/ui/Card';
import type { Client, Vehicle } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function VehiclesSearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const term = q?.trim() ?? '';

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let vehicles: Vehicle[] = [];
  let clientMap = new Map<string, Client>();

  if (term.length >= 2) {
    const [plateRes, vinRes] = await Promise.all([
      supabase.from('vehicles').select('*').ilike('registration_plate', `%${term}%`).limit(20),
      supabase.from('vehicles').select('*').ilike('vin', `%${term}%`).limit(20),
    ]);

    const seen = new Set<string>();
    vehicles = [...(plateRes.data ?? []), ...(vinRes.data ?? [])].filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });

    const clientIds = [...new Set(vehicles.map((v) => v.client_id))];
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds);
      clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Vozila — tehnički pasoš</h1>

      <form method="GET" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Registracija ili VIN..."
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
          />
        </div>
        <button
          type="submit"
          className="press-effect min-h-[52px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
        >
          Traži
        </button>
      </form>

      {term.length > 0 && term.length < 2 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Unesite barem 2 znaka za pretragu.</p>
      )}

      {term.length >= 2 && vehicles.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nema vozila koje odgovara pretrazi &quot;{term}&quot;.
        </p>
      )}

      {vehicles.length > 0 && (
        <div className="space-y-2">
          {vehicles.map((vehicle) => {
            const client = clientMap.get(vehicle.client_id);
            return (
              <Link key={vehicle.id} href={`/dashboard/vehicles/${vehicle.id}`}>
                <Card hoverLift className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-electric-blue/10">
                    <Car className="h-5 w-5 text-blue-600 dark:text-electric-blue" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                      {vehicleLabel(vehicle)}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {client ? `${client.first_name} ${client.last_name}` : 'Nepoznat klijent'}
                      {vehicle.vin ? ` · VIN: ${vehicle.vin}` : ''}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
