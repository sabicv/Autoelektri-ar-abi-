'use client';

import { Drawer as VaulDrawer } from 'vaul';
import { cn } from '@/lib/utils';

const Drawer = VaulDrawer.Root;
const DrawerTrigger = VaulDrawer.Trigger;
const DrawerClose = VaulDrawer.Close;
const DrawerPortal = VaulDrawer.Portal;
const DrawerTitle = VaulDrawer.Title;
const DrawerDescription = VaulDrawer.Description;

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Content>) {
  return (
    <DrawerPortal>
      <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <VaulDrawer.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] outline-none dark:border-workshop-border dark:bg-workshop-surface',
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-slate-300 dark:bg-workshop-border" />
        {children}
      </VaulDrawer.Content>
    </DrawerPortal>
  );
}

export { Drawer, DrawerTrigger, DrawerClose, DrawerPortal, DrawerContent, DrawerTitle, DrawerDescription };
