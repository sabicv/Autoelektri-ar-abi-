'use client';

// Unsaved typing (new job form, dictated notes) is mirrored into
// localStorage so a closed tab, dead battery or lost signal doesn't lose
// it. Storage can be unavailable (private mode, quota) — every call is
// best-effort and never throws.

export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore — the in-memory form still works.
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}
