'use client';

import { useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { onAuthChangeElsewhere } from '@/lib/authSync';

// Keeps this tab's screen in step with who is actually signed in (see
// lib/authSync.ts). Checked when the tab comes back into view and when
// another tab signs in or out; a mismatch reloads the page, which renders
// the right account (or the login screen).
export default function SessionGuard({ userId }: { userId: string }) {
  useEffect(() => {
    let checking = false;
    async function check() {
      if (checking) return;
      checking = true;
      // Reads the session cookie; no network round trip.
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      checking = false;
      if ((data.session?.user.id ?? null) !== userId) window.location.reload();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    const stopListening = onAuthChangeElsewhere(check);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      stopListening();
    };
  }, [userId]);

  return null;
}
