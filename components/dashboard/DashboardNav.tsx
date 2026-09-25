'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ALargeSmall, Archive, BarChart3, Briefcase, LogOut, MoreVertical, Moon, Settings, Sun, Users } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard/jobs', label: 'Poslovi', icon: Briefcase },
  { href: '/dashboard/clients', label: 'Klijenti', icon: Users },
  { href: '/dashboard/vehicles', label: 'Vozila', icon: Archive },
  { href: '/dashboard/analytics', label: 'Poslovanje', icon: BarChart3 },
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
  const [moreOpen, setMoreOpen] = useState(false);

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
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tenantName}</span>

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Više opcija"
          className="press-effect flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-workshop-surface-hover"
        >
          <MoreVertical className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <nav className="grid grid-cols-5 border-t border-slate-100 dark:border-workshop-border">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'press-effect flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-center transition-colors',
                active
                  ? 'text-blue-700 dark:text-electric-blue'
                  : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-workshop-surface-hover'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span className="w-full truncate text-[11px] font-medium leading-none">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerTitle className="px-4 pt-4 text-base font-bold text-slate-900 dark:text-slate-100">
            Više opcija
          </DrawerTitle>
          <div className="space-y-1 p-4 pt-3">
            <button
              type="button"
              onClick={() => {
                cycleFontScale();
              }}
              className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
            >
              <ALargeSmall className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
              Veličina teksta: {FONT_SCALE_STEPS[fontScaleIndex]}%
            </button>

            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
            >
              {isDark ? <Sun className="h-5 w-5 flex-shrink-0" strokeWidth={2} /> : <Moon className="h-5 w-5 flex-shrink-0" strokeWidth={2} />}
              {isDark ? 'Prebaci na svijetlo' : 'Prebaci na tamno'}
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-workshop-border" />

            <button
              type="button"
              onClick={handleLogout}
              className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
              Odjava
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
