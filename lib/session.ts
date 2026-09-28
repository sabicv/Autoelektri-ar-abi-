import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// For dashboard server components. Redirects instead of returning null so
// callers can rely on `profile` being present. Cached per request: the
// layout and the page both call it, and each call is two round trips to
// Supabase (auth check + profile) that a page view only needs once.
export const getSessionProfile = cache(async () => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) redirect('/login');

  return { supabase, user, profile };
});

// Hiding a nav link isn't access control — every owner-only page calls this.
export async function requireOwner() {
  const session = await getSessionProfile();
  if (session.profile.role !== 'owner') redirect('/dashboard/jobs');
  return session;
}
