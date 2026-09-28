'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// job-vault is private: every photo needs a short-lived signed URL.
// Batched into one request per distinct set of paths.
export function useSignedUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = [...new Set(paths)].sort().join('|');

  useEffect(() => {
    const unique = key ? key.split('|') : [];
    const missing = unique.filter((p) => !urls[p]);
    if (missing.length === 0) return;
    let cancelled = false;
    createBrowserSupabaseClient()
      .storage.from('job-vault')
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setUrls((prev) => {
          const next = { ...prev };
          for (const item of data) if (item.path && item.signedUrl) next[item.path] = item.signedUrl;
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
    // urls is read only to skip already-signed paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
