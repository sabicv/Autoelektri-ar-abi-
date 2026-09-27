import 'server-only';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// For dashboard server components. Redirects instead of returning null so
// callers can rely on `profile` being present.
export async function getSessionProfile() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/login');

  return { supabase, user, profile };
}

// Hiding a nav link isn't access control — every owner-only page calls this.
export async function requireOwner() {
  const session = await getSessionProfile();
  if (session.profile.role !== 'owner') redirect('/dashboard/jobs');
  return session;
}
