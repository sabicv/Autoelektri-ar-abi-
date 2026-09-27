import { Car } from 'lucide-react';
import { vehicleLabel } from '@/lib/format';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { ArchiveRow, EmptyState } from './shared';

export async function ArchiveVehiclesTab({ supabase }: { supabase: ServerSupabaseClient }) {
  const [{ data: vehicles }, { data: clients }] = await Promise.all([
    supabase.from('vehicles').select('*').order('registration_plate').limit(500),
    supabase.from('clients').select('id, first_name, last_name'),
  ]);

  if (!vehicles || vehicles.length === 0) return <EmptyState>Još nema vozila.</EmptyState>;

  const clientNames = new Map((clients ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`]));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {vehicles.length} vozila — otvorite vozilo za kompletnu povijest popravaka, dijagnostike i fotografija.
      </p>
      {vehicles.map((vehicle) => (
        <ArchiveRow
          key={vehicle.id}
          href={`/dashboard/vehicles/${vehicle.id}`}
          icon={<Car className="h-5 w-5" strokeWidth={2} />}
          title={vehicleLabel(vehicle)}
          subtitle={[clientNames.get(vehicle.client_id), vehicle.vin ? `VIN: ${vehicle.vin}` : null]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
    </div>
  );
}
