import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Service-role client. Bypasses RLS entirely — never import this into a
// 'use client' component or route handler that echoes it back to the
// browser. Reserved for trusted server-side operations (triage intake,
// tenant onboarding, admin tooling).
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
