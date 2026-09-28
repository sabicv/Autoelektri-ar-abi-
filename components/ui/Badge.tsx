import { cn } from '@/lib/utils';

export type BadgeVariant = 'collected' | 'progress' | 'alarm' | 'diagnostic' | 'neutral' | 'emergency';

interface BadgeProps {
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Colour is a signal, never decoration (see JOB_STATUS_BADGE_VARIANT):
// blue ("diagnostic") = being worked on, amber ("progress") = waiting on
// parts or payment, emerald ("collected") = ready/paid, neutral = new or
// closed, red = HITNO and help requests only.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  collected: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  progress: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  alarm: 'bg-red-100 text-alarm-red dark:bg-red-500/15 dark:text-red-400',
  diagnostic: 'bg-sky-100 text-sky-700 dark:bg-electric-blue/15 dark:text-electric-blue',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-workshop-surface-hover dark:text-slate-300',
  emergency: 'bg-alarm-red text-white',
};

export default function Badge({ variant = 'neutral', pulse, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
