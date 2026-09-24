'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ALargeSmall, BarChart3, Briefcase, Car, LogOut, Moon, Settings, Sun, Users } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard/jobs', label: 'Poslovi', icon: Briefcase },
  { href: '/dashboard/clients', label: 'Klijenti', icon: Users },
  { href: '/dashboard/vehicles', label: 'Vozila', icon: Car },
  { href: '/dashboard/analytics', label: 'Analitika', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Postavke', icon: Settings },
];

// Scales the root <html> font-size, which every rem-based Tailwind size
// (text, spacing, icons) is relative to — the same effect as a browser
// zoom, but controlled in-app and persisted per mechanic.
const FONT_SCALE_STEPS = [100, 112, 125, 137];

export default function DashboardNav({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [fontScaleIndex, setFontScaleIndex] = useState(0);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    try {
      const stored = parseInt(localStorage.getItem('workshop-font-scale-index') ?? '0', 10);
      if (!Number.isNaN(stored) && stored >= 0 && stored < FONT_SCALE_STEPS.length) {
        setFontScaleIndex(stored);
      }
    } catch {
      // Private browsing / storage blocked — falls back to 100%.
    }
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

  function cycleFontScale() {
    const next = (fontScaleIndex + 1) % FONT_SCALE_STEPS.length;
    setFontScaleIndex(next);
    document.documentElement.style.fontSize = `${FONT_SCALE_STEPS[next]}%`;
    try {
      localStorage.setItem('workshop-font-scale-index', String(next));
    } catch {
      // Private browsing / storage blocked — size just won't persist.
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="print:hidden sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-workshop-border dark:bg-workshop-dark/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tenantName}</span>

        <nav className="flex items-center gap-0.5 overflow-x-auto">
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
            onClick={cycleFontScale}
            aria-label={`Veličina teksta: ${FONT_SCALE_STEPS[fontScaleIndex]}%. Dodirnite za promjenu.`}
            className="press-effect flex min-h-[52px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover"
          >
            <ALargeSmall className="h-5 w-5" strokeWidth={2} />
            <span className="hidden sm:inline">{FONT_SCALE_STEPS[fontScaleIndex]}%</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Uključi svijetli način rada' : 'Uključi tamni radionički način rada'}
            className="press-effect flex min-h-[52px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover"
          >
            {isDark ? <Sun className="h-5 w-5" strokeWidth={2} /> : <Moon className="h-5 w-5" strokeWidth={2} />}
            <span className="hidden sm:inline">{isDark ? 'Svijetlo' : 'Tamno'}</span>
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
