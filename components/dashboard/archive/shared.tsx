import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export function ArchiveRow({
  href,
  icon,
  title,
  subtitle,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card hoverLift className="flex items-center gap-3 p-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-electric-blue/10 dark:text-electric-blue">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {meta && <div className="flex flex-shrink-0 flex-col items-end gap-1">{meta}</div>}
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" strokeWidth={2} />
      </Card>
    </Link>
  );
}

export function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'press-effect whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold',
        active
          ? 'bg-blue-600 text-white dark:bg-electric-blue dark:text-workshop-dark'
          : 'bg-slate-100 text-slate-600 dark:bg-workshop-surface-hover dark:text-slate-300'
      )}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400 dark:border-workshop-border">
      {children}
    </p>
  );
}
