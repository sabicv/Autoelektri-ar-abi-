import { notFound } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Phone } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import QRTriageForm from '@/components/triage/QRTriageForm';
import type { Tenant } from '@/types/database';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ tenant_slug: string }>;
}

async function getTenant(slug: string): Promise<Tenant | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('tenants').select('*').eq('slug', slug).maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenant_slug } = await params;
  const tenant = await getTenant(tenant_slug);

  if (!tenant) {
    return { title: 'Radionica nije pronađena' };
  }

  return {
    title: `Prijava kvara — ${tenant.name}`,
    description: `Prijavite kvar na vozilu za ${tenant.name} putem QR prijave, bez čekanja u redu.`,
  };
}

export default async function TriageIntakePage({ params }: PageProps) {
  const { tenant_slug } = await params;
  const tenant = await getTenant(tenant_slug);

  if (!tenant) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-2 px-4 py-6 text-center">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
              {tenant.name.slice(0, 1)}
            </div>
          )}

          <h1 className="text-xl font-bold text-slate-900">{tenant.name}</h1>

          <div className="flex flex-col items-center gap-1 text-sm text-slate-500">
            {tenant.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 flex-shrink-0" /> {tenant.address}
              </span>
            )}
            {tenant.phone && (
              <a href={`tel:${tenant.phone}`} className="flex items-center gap-1 font-medium text-blue-600">
                <Phone className="h-4 w-4 flex-shrink-0" /> {tenant.phone}
              </a>
            )}
          </div>
        </div>
      </header>

      <QRTriageForm tenant={tenant} />
    </main>
  );
}
