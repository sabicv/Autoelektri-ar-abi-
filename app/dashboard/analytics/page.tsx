import Link from 'next/link';
import { CheckCircle2, ChevronRight, Clock, Euro, Inbox, Wallet, X } from 'lucide-react';
import { requireOwner } from '@/lib/session';
import { formatEuroHR } from '@/lib/format';
import { jobTotal } from '@/lib/finance';
import { cn } from '@/lib/utils';
import Card from '@/components/ui/Card';
import InvoicesOverview, { type InvoiceFilter } from '@/components/dashboard/InvoicesOverview';
import { JobList, loadJobOwners } from '@/components/dashboard/archive/ArchiveJobsTab';
import { EmptyState } from '@/components/dashboard/archive/shared';
import type { Job } from '@/types/database';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { id: 'danas', label: 'Danas' },
  { id: '7-dana', label: 'Zadnjih 7 dana' },
  { id: 'mjesec', label: 'Protekli mjesec' },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

// Every figure opens the jobs it was counted from.
const VIEWS = {
  novi: 'Novi nalozi',
  zavrseni: 'Završeni nalozi',
  uplate: 'Primljene uplate',
} as const;

type ViewId = keyof typeof VIEWS;

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
  const lists: Record<ViewId, Job[]> = {
    novi: jobs.filter((j) => inPeriod(j.created_at, from)),
    zavrseni: jobs.filter((j) => inPeriod(j.finished_at, from)),
    uplate: jobs.filter((j) => j.payment_status === 'PAID' && inPeriod(j.paid_at, from)),
  };
  const finished = lists.zavrseni;

  const avgHours =
    finished.length > 0
      ? finished.reduce(
          (sum, j) => sum + (new Date(j.finished_at as string).getTime() - new Date(j.created_at).getTime()) / 3600000,
          0
        ) / finished.length
      : null;

  return {
    lists,
    turnover: finished.reduce((sum, j) => sum + jobTotal(j), 0),
    received: lists.uplate.reduce((sum, j) => sum + jobTotal(j), 0),
    labor: finished.reduce((sum, j) => sum + j.total_labor_cost, 0),
    parts: finished.reduce((sum, j) => sum + j.total_parts_cost, 0),
    avgHours,
  };
}

function formatDuration(hours: number | null) {
  if (hours === null) return '—';
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} dana`;
}

interface PageProps {
  searchParams: Promise<{ pay?: string; period?: string; prikaz?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const { supabase } = await requireOwner();
  const params = await searchParams;
  const filter: InvoiceFilter = params.pay === 'paid' || params.pay === 'all' ? params.pay : 'unpaid';
  const period: PeriodId = PERIODS.some((p) => p.id === params.period) ? (params.period as PeriodId) : 'danas';
  const view: ViewId | null = params.prikaz && params.prikaz in VIEWS ? (params.prikaz as ViewId) : null;
  const from = periodStart(period);

  // Anything touched in the window: created, finished or paid in it.
  const iso = from.toISOString();
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .or(`created_at.gte.${iso},finished_at.gte.${iso},paid_at.gte.${iso}`)
    .order('created_at', { ascending: false });
  const stats = computeStats(jobs ?? [], from);
  const splitTotal = stats.labor + stats.parts;

  const payQuery = filter !== 'unpaid' ? `&pay=${filter}` : '';
  const base = `/dashboard/analytics?period=${period}${payQuery}`;
  // Tapping the open figure again closes its list.
  const viewHref = (id: ViewId) => (view === id ? base : `${base}&prikaz=${id}#popis`);

  const viewJobs = view ? stats.lists[view] : [];
  const owners = view ? await loadJobOwners(supabase, viewJobs) : null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Poslovanje</h1>

      <nav className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-workshop-surface">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/analytics?period=${p.id}${payQuery}${view ? `&prikaz=${view}` : ''}`}
            replace
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
        <StatCard
          href={viewHref('uplate')}
          active={view === 'uplate'}
          icon={Wallet}
          label="Primljene uplate"
          value={formatEuroHR(stats.received)}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          href={viewHref('zavrseni')}
          active={false}
          icon={Euro}
          label="Promet (završeni nalozi)"
          value={formatEuroHR(stats.turnover)}
          accent="text-blue-600 dark:text-electric-blue"
        />
        <StatCard
          href={viewHref('novi')}
          active={view === 'novi'}
          icon={Inbox}
          label="Novi nalozi"
          value={String(stats.lists.novi.length)}
          accent="text-blue-600 dark:text-electric-blue"
        />
        <StatCard
          href={viewHref('zavrseni')}
          active={view === 'zavrseni'}
          icon={CheckCircle2}
          label="Završeni nalozi"
          value={String(stats.lists.zavrseni.length)}
          accent="text-blue-600 dark:text-electric-blue"
        />
      </div>

      {view && owners && (
        <section id="popis" className="scroll-mt-32 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {VIEWS[view]} · {PERIODS.find((p) => p.id === period)?.label.toLowerCase()} ({viewJobs.length})
            </h2>
            <Link
              href={base}
              replace
              aria-label="Zatvori popis"
              className="press-effect flex h-12 w-12 items-center justify-center rounded-lg text-slate-400"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
          {viewJobs.length === 0 ? (
            <EmptyState>Nema naloga u ovom razdoblju.</EmptyState>
          ) : (
            <JobList
              jobs={viewJobs}
              vehicles={owners.vehicles}
              clients={owners.clients}
              from={`poslovanje:${period}:${view}`}
            />
          )}
        </section>
      )}

      {/* Duration and the labour/parts split are computed from the finished jobs. */}
      <Link href={viewHref('zavrseni')} replace className="block">
        <Card hoverLift className="space-y-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
              <Clock className="h-4 w-4" strokeWidth={2} /> Prosječno trajanje naloga
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{formatDuration(stats.avgHours)}</span>
          </div>
          <RevenueRow label="Rad" amount={stats.labor} total={splitTotal} />
          <RevenueRow label="Dijelovi" amount={stats.parts} total={splitTotal} />
        </Card>
      </Link>

      <InvoicesOverview supabase={supabase} filter={filter} period={period} />
    </div>
  );
}

function StatCard({
  href,
  active,
  icon: Icon,
  label,
  value,
  accent,
}: {
  href: string;
  active: boolean;
  icon: typeof Wallet;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Link href={href} replace className="block">
      <Card
        hoverLift
        className={cn('press-effect h-full p-4', active && 'ring-2 ring-blue-500 dark:ring-electric-blue')}
      >
        <div className="flex items-start justify-between">
          <Icon className={`h-5 w-5 ${accent}`} strokeWidth={2} />
          <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600" strokeWidth={2} />
        </div>
        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300">{label}</p>
      </Card>
    </Link>
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
