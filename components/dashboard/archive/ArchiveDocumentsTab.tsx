import Link from 'next/link';
import { FileText } from 'lucide-react';
import { isPdfPath, PHOTO_TAG_LABELS_HR } from '@/lib/format';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { PHOTO_TAGS, type PhotoTag } from '@/types/database';
import { EmptyState, FilterPill } from './shared';

const PAGE_SIZE = 30;

export async function ArchiveDocumentsTab({
  supabase,
  tag,
}: {
  supabase: ServerSupabaseClient;
  tag: PhotoTag | null;
}) {
  let listQuery = supabase.from('job_photos').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE);
  if (tag) listQuery = listQuery.eq('tag', tag);

  const [{ data: allTags }, { data: photos }] = await Promise.all([
    supabase.from('job_photos').select('tag'),
    listQuery,
  ]);

  const counts = new Map<PhotoTag, number>();
  for (const row of allTags ?? []) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  const total = allTags?.length ?? 0;

  const list = photos ?? [];
  const { data: signed } =
    list.length > 0
      ? await supabase.storage.from('job-vault').createSignedUrls(
          list.map((p) => p.photo_url),
          3600
        )
      : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <FilterPill href="/dashboard/archive?tab=dokumenti" active={!tag}>
          Sve ({total})
        </FilterPill>
        {PHOTO_TAGS.filter((t) => counts.has(t)).map((t) => (
          <FilterPill key={t} href={`/dashboard/archive?tab=dokumenti&tag=${t}`} active={tag === t}>
            {PHOTO_TAG_LABELS_HR[t]} ({counts.get(t)})
          </FilterPill>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState>Nema dokumenata.</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {list.map((photo) => {
            const url = urlByPath.get(photo.photo_url);
            const isPdf = isPdfPath(photo.photo_url);
            return (
              <Link
                key={photo.id}
                href={`/dashboard/jobs/${photo.job_id}`}
                className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-workshop-border dark:bg-workshop-surface-hover"
              >
                {isPdf || !url ? (
                  <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-400">
                    <FileText className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={PHOTO_TAG_LABELS_HR[photo.tag]} loading="lazy" className="h-full w-full object-cover" />
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
                  {new Date(photo.created_at).toLocaleDateString('hr-HR')} · {PHOTO_TAG_LABELS_HR[photo.tag]}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
