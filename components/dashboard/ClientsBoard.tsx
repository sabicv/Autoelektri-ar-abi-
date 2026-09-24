'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Phone, Plus, Search, User, Users } from 'lucide-react';
import Card from '@/components/ui/Card';
import NewJobModal from './NewJobModal';
import { vehicleLabel } from '@/lib/format';
import type { Client, Vehicle } from '@/types/database';

interface ClientsBoardProps {
  clients: Client[];
  vehicles: Vehicle[];
  tenantId: string;
}

export default function ClientsBoard({ clients, vehicles, tenantId }: ClientsBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newClientOpen, setNewClientOpen] = useState(false);

  const vehiclesByClient = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const vehicle of vehicles) {
      const list = map.get(vehicle.client_id) ?? [];
      list.push(vehicle);
      map.set(vehicle.client_id, list);
    }
    return map;
  }, [vehicles]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => {
      const clientVehicles = vehiclesByClient.get(client.id) ?? [];
      const haystack = [
        `${client.first_name} ${client.last_name}`,
        client.phone_number,
        client.oib ?? '',
        ...clientVehicles.map((v) => vehicleLabel(v)),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [clients, searchQuery, vehiclesByClient]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setNewClientOpen(true)}
        className="press-effect flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white dark:bg-electric-blue dark:text-workshop-dark"
      >
        <Plus className="h-5 w-5" strokeWidth={2} /> Dodaj klijenta
      </button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Traži ime, telefon, OIB ili vozilo..."
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-workshop-border dark:bg-workshop-surface dark:text-slate-100"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-16 text-slate-400 dark:border-workshop-border">
          <Users className="h-8 w-8" strokeWidth={2} />
          <p className="text-sm">Nema klijenata koji odgovaraju pretrazi.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredClients.map((client) => {
            const clientVehicles = vehiclesByClient.get(client.id) ?? [];
            const firstVehicle = clientVehicles[0];

            return (
              <Link key={client.id} href={firstVehicle ? `/dashboard/vehicles/${firstVehicle.id}` : '/dashboard/vehicles'}>
                <Card hoverLift className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-electric-blue/10">
                    <User className="h-5 w-5 text-blue-600 dark:text-electric-blue" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                      {client.first_name} {client.last_name}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      <Phone className="h-3 w-3 flex-shrink-0" strokeWidth={2} /> {client.phone_number}
                    </p>
                    {clientVehicles.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                        {clientVehicles.map((v) => vehicleLabel(v)).join(', ')}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <NewJobModal
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        tenantId={tenantId}
        title="Novi klijent i vozilo"
      />
    </div>
  );
}
