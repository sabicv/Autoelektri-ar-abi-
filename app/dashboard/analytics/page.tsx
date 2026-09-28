import { Car, Clock, Euro, Wrench } from 'lucide-react';
import { requireOwner } from '@/lib/session';
import { formatEuroHR } from '@/lib/format';
import Card from '@/components/ui/Card';
import InvoicesOverview, { type InvoiceFilter } from '@/components/dashboard/InvoicesOverview';
import type { Job } from '@/types/database';

export const dynamic = 'force-dynamic';

function computeStats(jobs: Job[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const jobsCompletedThisMonth = jobs.filter(
    (j) => j.status === 'COLLECTED' && j.collected_at && new Date(j.collected_at) >= monthStart
  ).length;

  const totalLaborRevenue = jobs.reduce((sum, j) => sum + j.total_labor_cost, 0);
  const totalPartsRevenue = jobs.reduce((sum, j) => sum + j.total_parts_cost, 0);
  const totalRevenue = totalLaborRevenue + totalPartsRevenue;

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

  const vehiclesInWorkshop = jobs.filter((j) => j.status !== 'COLLECTED').length;

  return {
    jobsCompletedThisMonth,
    totalLaborRevenue,
    totalPartsRevenue,
    totalRevenue,
    totalDiagnosticHours,
    totalRepairHours,
    avgTurnaroundDays,
    vehiclesInWorkshop,
  };
}

interface PageProps {
  searchParams: Promise<{ pay?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const { supabase } = await requireOwner();
  const { pay } = await searchParams;
  const filter: InvoiceFilter = pay === 'paid' || pay === 'all' ? pay : 'unpaid';

  // RLS scopes this to the user's own tenant.
  const { data: jobs } = await supabase.from('jobs').select('*');
  const stats = computeStats(jobs ?? []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poslovanje</h1>

      <InvoicesOverview supabase={supabase} filter={filter} />

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pregled</h2>
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
            label="Vozila u radionici"
            value={String(stats.vehiclesInWorkshop)}
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
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">Prihod po vrsti (ukupno)</h3>
          <div className="space-y-2">
            <RevenueRow label="Rad" amount={stats.totalLaborRevenue} total={stats.totalRevenue} />
            <RevenueRow label="Dijelovi" amount={stats.totalPartsRevenue} total={stats.totalRevenue} />
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-400">
            Sati dijagnostike: {stats.totalDiagnosticHours.toFixed(1)} h · sati popravka: {stats.totalRepairHours.toFixed(1)} h
          </p>
        </Card>
      </section>
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
      <p className="text-xs font-medium text-slate-500 dark:text-slate-300">{label}</p>
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
