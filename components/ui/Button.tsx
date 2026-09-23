'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'success' | 'ghost' | 'outline';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

// Every size meets the 52px minimum touch target except `sm`, reserved for
// dense, non-primary actions (e.g. inline "regenerate" links) — never the
// only way to perform a primary workshop action.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-electric-blue dark:text-workshop-dark dark:hover:brightness-110',
  secondary:
    'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-50 dark:bg-workshop-surface dark:text-slate-100 dark:border-workshop-border dark:hover:bg-workshop-surface-hover',
  destructive: 'bg-alarm-red text-white hover:bg-red-700 active:bg-red-800',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover',
  outline:
    'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-electric-blue dark:text-electric-blue dark:hover:bg-workshop-surface-hover',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'min-h-[52px] px-6 text-base',
  sm: 'min-h-[44px] px-4 text-sm',
  lg: 'min-h-[60px] px-8 text-lg',
  icon: 'h-[52px] w-[52px] flex-shrink-0 px-0',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'press-effect inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
