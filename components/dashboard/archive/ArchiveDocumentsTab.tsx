import { isPdfPath, PHOTO_TAG_LABELS_HR } from '@/lib/format';
import { signWithThumbnails } from '@/lib/thumbnails';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { PHOTO_TAGS, type PhotoTag } from '@/types/database';
import DocumentGrid from './DocumentGrid';
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
  const signed = await signWithThumbnails(
    supabase.storage.from('job-vault'),
    list.map((p) => p.photo_url)
  );

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
        <DocumentGrid
          items={list.map((photo) => ({
            id: photo.id,
            path: photo.photo_url,
            url: signed.get(photo.photo_url)?.url ?? '',
            thumbUrl: signed.get(photo.photo_url)?.thumbUrl,
            jobHref: `/dashboard/jobs/${photo.job_id}?from=arhiva`,
            tag: photo.tag,
            caption: photo.caption,
            createdAt: photo.created_at,
            takenAt: photo.taken_at,
            gpsLat: photo.gps_lat,
            gpsLng: photo.gps_lng,
            isPdf: isPdfPath(photo.photo_url),
          }))}
        />
      )}
    </div>
  );
}
