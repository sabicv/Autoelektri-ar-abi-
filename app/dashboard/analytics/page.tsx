import { redirect } from 'next/navigation';
import { AlertTriangle, Car, Clock, Euro, Wrench } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatEuroHR, vehicleLabel } from '@/lib/format';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { Client, Job, Vehicle } from '@/types/database';

export const dynamic = 'force-dynamic';

function computeStats(jobs: Job[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const jobsCompletedThisMonth = jobs.filter(
    (j) => j.status === 'COLLECTED' && j.collected_at && new Date(j.collected_at) >= monthStart
  ).length;

  const totalLaborRevenue = jobs.reduce((sum, j) => sum + j.total_labor_cost, 0);
  const totalPartsRevenue = jobs.reduce((sum, j) => sum + j.total_parts_cost, 0);
  const totalParkingRevenue = jobs.reduce((sum, j) => sum + j.accrued_parking_fees, 0);
  const totalRevenue = totalLaborRevenue + totalPartsRevenue + totalParkingRevenue;

  const totalDiagnosticHours = jobs.reduce((sum, j) => sum + j.diagnostic_hours, 0);
  const totalRepairHours = jobs.reduce((sum, j) => sum + j.repair_hours, 0);

  const collectedJobs = jobs.filter((j) => j.status === 'COLLECTED' && j.collected_at);
  const avgTurnaroundDays =
    collectedJobs.length > 0
      ? collectedJobs.reduce(
          (sum, j) => sum + (new Date(j.collected_at as string).getTime() - new Date(j.created_at).getTime()) / 86400000,
          0
        ) / collectedJobs.length
      : null;

  const occupiedSpots = jobs.filter((j) => j.status !== 'COLLECTED').length;

  const flaggedParkingJobs = jobs
    .filter((j) => j.accrued_parking_fees > 0)
    .sort((a, b) => b.accrued_parking_fees - a.accrued_parking_fees);

  return {
    jobsCompletedThisMonth,
    totalLaborRevenue,
    totalPartsRevenue,
    totalParkingRevenue,
    totalRevenue,
    totalDiagnosticHours,
    totalRepairHours,
    avgTurnaroundDays,
    occupiedSpots,
    flaggedParkingJobs,
  };
}

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS scopes every query below to this user's own tenant automatically —
  // no manual tenant_id filtering needed.
  const [{ data: jobs }, { data: clients }, { data: vehicles }] = await Promise.all([
    supabase.from('jobs').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('vehicles').select('*'),
  ]);

  const jobList = jobs ?? [];
  const clientMap = new Map<string, Client>((clients ?? []).map((c) => [c.id, c]));
  const vehicleMap = new Map<string, Vehicle>((vehicles ?? []).map((v) => [v.id, v]));

  const stats = computeStats(jobList);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Analitika poslovanja</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Wrench}
          label="Završeno ovaj mjesec"
          value={String(stats.jobsCompletedThisMonth)}
          accent="text-blue-600 dark:text-electric-blue"
        />
        <StatCard
          icon={Clock}
          label="Prosječno vrijeme obrade"
          value={stats.avgTurnaroundDays !== null ? `${stats.avgTurnaroundDays.toFixed(1)} dana` : '—'}
          accent="text-blue-600 dark:text-electric-blue"
        />
        <StatCard
          icon={Car}
          label="Zauzeta parkirna mjesta"
          value={String(stats.occupiedSpots)}
          accent="text-blue-600 dark:text-electric-blue"
        />
        <StatCard
          icon={Euro}
          label="Ukupan prihod"
          value={formatEuroHR(stats.totalRevenue)}
          accent="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">Prihod po kategoriji (ukupno)</h2>
        <div className="space-y-2">
          <RevenueRow label="Rad (dijagnostika i popravak)" amount={stats.totalLaborRevenue} total={stats.totalRevenue} />
          <RevenueRow label="Dijelovi" amount={stats.totalPartsRevenue} total={stats.totalRevenue} />
          <RevenueRow label="Ležarina" amount={stats.totalParkingRevenue} total={stats.totalRevenue} />
        </div>
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Ukupno sati dijagnostike: {stats.totalDiagnosticHours.toFixed(1)}h · Ukupno sati popravka:{' '}
          {stats.totalRepairHours.toFixed(1)}h. Rad se u sustavu ne bilježi zasebno po satu dijagnostike naspram
          popravka u eurima, samo kao ukupan trošak rada po nalogu.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <AlertTriangle className="h-5 w-5 text-alarm-red" strokeWidth={2} /> Vozila s ležarinom — potreban pregled
        </h2>

        {stats.flaggedParkingJobs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nema vozila s obračunatom ležarinom.</p>
        ) : (
          <ul className="space-y-2">
            {stats.flaggedParkingJobs.map((job) => {
              const client = clientMap.get(job.client_id);
              const vehicle = vehicleMap.get(job.vehicle_id);
              return (
                <li
                  key={job.id}
                  className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-500/30 dark:bg-red-500/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {client ? `${client.first_name} ${client.last_name}` : 'Nepoznat klijent'}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {vehicle ? vehicleLabel(vehicle) : 'Vozilo'}
                    </p>
                  </div>
                  <Badge variant="emergency">{formatEuroHR(job.accrued_parking_fees)}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <Icon className={`h-5 w-5 ${accent}`} strokeWidth={2} />
      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </Card>
  );
}

function RevenueRow({ label, amount, total }: { label: string; amount: number; total: number }) {
  const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-700 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatEuroHR(amount)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-workshop-surface-hover">
        <div className="h-full rounded-full bg-blue-500 dark:bg-electric-blue" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
