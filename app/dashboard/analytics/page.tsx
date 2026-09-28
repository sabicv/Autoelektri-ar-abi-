import Link from 'next/link';
import { CheckCircle2, Clock, Euro, Inbox, Wallet } from 'lucide-react';
import { requireOwner } from '@/lib/session';
import { formatEuroHR } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import { cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import InvoicesOverview, { type InvoiceFilter } from '@/components/dashboard/InvoicesOverview';
import type { Job } from '@/types/database';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { id: 'danas', label: 'Danas' },
  { id: '7-dana', label: 'Zadnjih 7 dana' },
  { id: 'mjesec', label: 'Protekli mjesec' },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

// Vercel runs in UTC; "today" must mean today in Croatia.
function periodStart(period: PeriodId): Date {
  const now = new Date();
  if (period === '7-dana') return new Date(now.getTime() - 7 * 86400000);
  if (period === 'mjesec') return new Date(now.getTime() - 30 * 86400000);

  const zagrebNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Zagreb' }));
  const offsetMs = zagrebNow.getTime() - now.getTime();
  const zagrebMidnight = new Date(zagrebNow);
  zagrebMidnight.setHours(0, 0, 0, 0);
  return new Date(zagrebMidnight.getTime() - offsetMs);
}

function inPeriod(value: string | null, from: Date) {
  return value !== null && new Date(value) >= from;
}

function computeStats(jobs: Job[], from: Date) {
  const finished = jobs.filter((j) => inPeriod(j.finished_at, from));
  const paid = jobs.filter((j) => j.payment_status === 'PAID' && inPeriod(j.paid_at, from));

  const labor = finished.reduce((sum, j) => sum + j.total_labor_cost, 0);
  const parts = finished.reduce((sum, j) => sum + j.total_parts_cost, 0);

  const avgHours =
    finished.length > 0
      ? finished.reduce(
          (sum, j) => sum + (new Date(j.finished_at as string).getTime() - new Date(j.created_at).getTime()) / 3600000,
          0
        ) / finished.length
      : null;

  return {
    newJobs: jobs.filter((j) => inPeriod(j.created_at, from)).length,
    finishedJobs: finished.length,
    turnover: finished.reduce((sum, j) => sum + jobTotal(j), 0),
    collected: paid.reduce((sum, j) => sum + jobTotal(j), 0),
    labor,
    parts,
    avgHours,
  };
}

function formatDuration(hours: number | null) {
  if (hours === null) return '—';
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} dana`;
}

interface PageProps {
  searchParams: Promise<{ pay?: string; period?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const { supabase } = await requireOwner();
  const params = await searchParams;
  const filter: InvoiceFilter = params.pay === 'paid' || params.pay === 'all' ? params.pay : 'unpaid';
  const period: PeriodId = PERIODS.some((p) => p.id === params.period) ? (params.period as PeriodId) : 'danas';
  const from = periodStart(period);

  // Anything touched in the window: created, finished or paid in it.
  const iso = from.toISOString();
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .or(`created_at.gte.${iso},finished_at.gte.${iso},paid_at.gte.${iso}`);
  const stats = computeStats(jobs ?? [], from);
  const splitTotal = stats.labor + stats.parts;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poslovanje</h1>

      <nav className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-workshop-surface">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/analytics?period=${p.id}${filter !== 'unpaid' ? `&pay=${filter}` : ''}`}
            className={cn(
              'press-effect flex min-h-[48px] items-center justify-center rounded-lg px-1 text-center text-sm font-semibold leading-tight',
              period === p.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-workshop-dark dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-300'
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Wallet} label="Naplaćeno" value={formatEuroHR(stats.collected)} accent="text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={Euro} label="Promet (završeni nalozi)" value={formatEuroHR(stats.turnover)} accent="text-blue-600 dark:text-electric-blue" />
        <StatCard icon={Inbox} label="Novi nalozi" value={String(stats.newJobs)} accent="text-blue-600 dark:text-electric-blue" />
        <StatCard icon={CheckCircle2} label="Završeni nalozi" value={String(stats.finishedJobs)} accent="text-blue-600 dark:text-electric-blue" />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            <Clock className="h-4 w-4" strokeWidth={2} /> Prosječno trajanje naloga
          </span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{formatDuration(stats.avgHours)}</span>
        </div>
        <RevenueRow label="Rad" amount={stats.labor} total={splitTotal} />
        <RevenueRow label="Dijelovi" amount={stats.parts} total={splitTotal} />
      </Card>

      <InvoicesOverview supabase={supabase} filter={filter} period={period} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Wallet;
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
