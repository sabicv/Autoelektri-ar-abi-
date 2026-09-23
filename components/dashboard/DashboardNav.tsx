'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Briefcase, LogOut, Moon, Settings, Sun } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard/jobs', label: 'Poslovi', icon: Briefcase },
  { href: '/dashboard/analytics', label: 'Analitika', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Postavke', icon: Settings },
];

export default function DashboardNav({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('workshop-theme', next ? 'dark' : 'light');
    } catch {
      // Private browsing / storage blocked — theme just won't persist.
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-workshop-border dark:bg-workshop-dark/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tenantName}</span>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'press-effect flex min-h-[52px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-electric-blue/15 dark:text-electric-blue'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Uključi svijetli način rada' : 'Uključi tamni radionički način rada'}
            className="press-effect flex min-h-[52px] min-w-[52px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover"
          >
            {isDark ? <Sun className="h-5 w-5" strokeWidth={2} /> : <Moon className="h-5 w-5" strokeWidth={2} />}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="press-effect flex min-h-[52px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} />
            <span className="hidden sm:inline">Odjava</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
