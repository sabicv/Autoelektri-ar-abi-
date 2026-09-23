import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

// Anon-key client for Server Components / Route Handlers. Respects RLS —
// use lib/supabase/admin.ts when a trusted server-side operation needs to
// bypass it (e.g. the triage submit route).
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render with no response to
            // attach cookies to — safe to ignore, session refresh happens
            // in middleware once auth is added.
          }
        },
      },
    }
  );
}
