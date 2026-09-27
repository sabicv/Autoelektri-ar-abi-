'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Card from './Card';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  title: string;
  icon?: React.ReactNode;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function CollapsibleCard({ title, icon, summary, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[32px] w-full items-center gap-2 text-left"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 flex-shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
          strokeWidth={2}
        />
      </button>
      {!open && summary && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{summary}</div>}
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}
