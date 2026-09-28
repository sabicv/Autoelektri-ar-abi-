'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ALargeSmall,
  Archive,
  BarChart3,
  Bell,
  BellRing,
  Briefcase,
  LogOut,
  MoreVertical,
  Moon,
  Settings,
  Smartphone,
  Sun,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { announceAuthChange } from '@/lib/authSync';
import { enablePush, isPushEnabled, pushSupported } from '@/lib/pushClient';
import { canPromptInstall, INSTALL_READY_EVENT, isIOS, isStandalone, promptInstall, syncThemeColor } from '@/lib/pwa';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer';
import TenantLogo from '@/components/ui/TenantLogo';
import { cn } from '@/lib/utils';
import type { StaffRole } from '@/types/database';

const LINKS = [
  { href: '/dashboard/jobs', label: 'Poslovi', icon: Briefcase, ownerOnly: false },
  { href: '/dashboard/clients', label: 'Mušterije', icon: Users, ownerOnly: false },
  { href: '/dashboard/archive', label: 'Arhiva', icon: Archive, ownerOnly: true },
  { href: '/dashboard/analytics', label: 'Poslovanje', icon: BarChart3, ownerOnly: true },
];

// Literal class names so Tailwind's scanner keeps them.
const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

// Scales the root <html> font-size, which every rem-based Tailwind size
// (text, spacing, icons) is relative to — the same effect as a browser
// zoom, but controlled in-app and persisted per mechanic.
const FONT_SCALE_STEPS = [100, 112, 125, 137];

export default function DashboardNav({
  tenantName,
  logoUrl,
  role,
}: {
  tenantName: string;
  logoUrl: string | null;
  role: StaffRole;
}) {
  const links = LINKS.filter((link) => role === 'owner' || !link.ownerOnly);
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [fontScaleIndex, setFontScaleIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pushState, setPushState] = useState<'unsupported' | 'off' | 'on' | 'working'>('unsupported');
  // 'installed' hides the item; 'prompt' = Chrome's own install dialog;
  // 'ios' / 'manual' = say where the browser keeps "Add to home screen".
  const [installState, setInstallState] = useState<'installed' | 'prompt' | 'ios' | 'manual'>('installed');
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    isPushEnabled().then((enabled) => setPushState(enabled ? 'on' : 'off'));
  }, []);

  useEffect(() => {
    const update = () =>
      setInstallState(isStandalone() ? 'installed' : canPromptInstall() ? 'prompt' : isIOS() ? 'ios' : 'manual');
    update();
    window.addEventListener(INSTALL_READY_EVENT, update);
    window.addEventListener('appinstalled', update);
    return () => {
      window.removeEventListener(INSTALL_READY_EVENT, update);
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  async function handleInstall() {
    if (installState !== 'prompt') {
      setInstallHelpOpen((open) => !open);
      return;
    }
    const accepted = await promptInstall();
    setInstallState(canPromptInstall() ? 'prompt' : isIOS() ? 'ios' : 'manual');
    if (accepted) {
      setMoreOpen(false);
      toast.success('Aplikacija je instalirana — otvori je ikonom na početnom zaslonu.');
    }
  }

  async function handleEnablePush() {
    setPushState('working');
    const result = await enablePush();
    if (result === 'enabled') {
      setPushState('on');
      toast.success('Obavijesti su uključene.');
    } else {
      setPushState('off');
      toast.error(
        result === 'denied'
          ? 'Obavijesti su blokirane u pregledniku. Dozvoli ih preko ikone lokota pored adrese.'
          : 'Uključivanje obavijesti nije uspjelo.'
      );
    }
  }

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
    syncThemeColor();
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
    announceAuthChange();
    router.push('/login');
    router.refresh();
  }

  return (
    // Top padding: installed on an iPhone the app runs under the status bar.
    <header className="print:hidden sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-workshop-border dark:bg-workshop-dark/95">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <Link href="/dashboard/jobs" className="flex min-w-0 items-center gap-2.5">
          <TenantLogo name={tenantName} logoUrl={logoUrl} />
          <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tenantName}</span>
        </Link>

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Više opcija"
          className="press-effect flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-workshop-surface-hover"
        >
          <MoreVertical className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <nav className={cn('grid border-t border-slate-100 dark:border-workshop-border', GRID_COLS[links.length])}>
        {links.map((link) => {
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
                  : 'text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-workshop-surface-hover'
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
            {role === 'owner' && (
              <>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMoreOpen(false)}
                  className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
                >
                  <Settings className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                  Postavke radionice i djelatnici
                </Link>
                <div className="my-1 border-t border-slate-100 dark:border-workshop-border" />
              </>
            )}

            {installState !== 'installed' && (
              <>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
                >
                  <Smartphone className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                  Instaliraj aplikaciju na mobitel
                </button>
                {installHelpOpen && (
                  <p className="mx-3 mb-2 rounded-xl bg-blue-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-electric-blue/10 dark:text-slate-200">
                    {installState === 'ios' ? (
                      <>
                        U Safariju dodirni <strong>Dijeli</strong> (kvadrat sa strelicom prema gore), zatim{' '}
                        <strong>Dodaj na početni zaslon</strong>.
                      </>
                    ) : (
                      <>
                        U izborniku preglednika (<strong>⋮</strong> gore desno) odaberi <strong>Instaliraj aplikaciju</strong>{' '}
                        ili <strong>Dodaj na početni zaslon</strong>.
                      </>
                    )}
                  </p>
                )}
              </>
            )}

            {pushState !== 'unsupported' && (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushState === 'on' || pushState === 'working'}
                className="press-effect flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-100 dark:text-slate-200 dark:hover:bg-workshop-surface-hover"
              >
                {pushState === 'on' ? (
                  <BellRing className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
                ) : (
                  <Bell className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                )}
                {pushState === 'on' ? 'Obavijesti na mobitel: uključene' : 'Uključi obavijesti na mobitel'}
              </button>
            )}

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
