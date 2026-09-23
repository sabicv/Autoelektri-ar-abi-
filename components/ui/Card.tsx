import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverLift?: boolean;
}

export default function Card({ className, hoverLift, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-workshop-border dark:bg-workshop-surface',
        hoverLift && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift dark:hover:shadow-lift-dark',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
