import { cn } from '@/lib/utils';

// The workshop's mark wherever the app shows whose it is. The logo is
// uploaded under Postavke → "Promijeni logotip" (public tenant-branding
// bucket, saved as tenants.logo_url); until then the initials stand in,
// so the header never has an empty hole.

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  lg: 'h-16 w-16 text-lg',
} as const;

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

export default function TenantLogo({
  name,
  logoUrl,
  size = 'sm',
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={cn(
          'flex-shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5 dark:border-workshop-border',
          SIZES[size],
          className
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white dark:bg-electric-blue dark:text-workshop-dark',
        SIZES[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
