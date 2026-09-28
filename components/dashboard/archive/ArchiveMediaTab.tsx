import Link from 'next/link';
import { DOCUMENT_TAGS, isPdfPath, PHOTO_ONLY_TAGS, PHOTO_TAG_LABELS_HR } from '@/lib/format';
import { signWithThumbnails } from '@/lib/thumbnails';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import type { JobPhoto, PhotoTag } from '@/types/database';
import DocumentGrid from './DocumentGrid';
import { EmptyState, FilterPill } from './shared';

const PAGE_SIZE = 48;

const GROUPS = {
  fotografije: { tags: PHOTO_ONLY_TAGS, empty: 'Nema fotografija.' },
  dokumenti: { tags: DOCUMENT_TAGS, empty: 'Nema dokumenata.' },
} as const;

export type MediaTab = keyof typeof GROUPS;

// Fotografije: a tap opens the job the photo belongs to.
// Dokumenti: a tap opens the document itself (PDF in a new tab, a scan
// full screen), since the paper is what's being looked for.
export async function ArchiveMediaTab({
  supabase,
  tab,
  tag,
}: {
  supabase: ServerSupabaseClient;
  tab: MediaTab;
  tag: PhotoTag | null;
}) {
  const group = GROUPS[tab];
  const activeTag = tag && group.tags.includes(tag) ? tag : null;

  const [{ data: allTags }, { data: rows }] = await Promise.all([
    supabase.from('job_photos').select('tag').in('tag', group.tags),
    supabase
      .from('job_photos')
      .select('*')
      .in('tag', activeTag ? [activeTag] : group.tags)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),
  ]);

  const counts = new Map<PhotoTag, number>();
  for (const row of allTags ?? []) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);

  const list = rows ?? [];
  const signed = await signWithThumbnails(
    supabase.storage.from('job-vault'),
    list.map((p) => p.photo_url)
  );

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <FilterPill href={`/dashboard/archive?tab=${tab}`} active={!activeTag}>
          Sve ({allTags?.length ?? 0})
        </FilterPill>
        {group.tags
          .filter((t) => counts.has(t))
          .map((t) => (
            <FilterPill key={t} href={`/dashboard/archive?tab=${tab}&tag=${t}`} active={activeTag === t}>
              {PHOTO_TAG_LABELS_HR[t]} ({counts.get(t)})
            </FilterPill>
          ))}
      </div>

      {list.length === 0 ? (
        <EmptyState>{group.empty}</EmptyState>
      ) : tab === 'fotografije' ? (
        <PhotoGrid photos={list} signed={signed} />
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

function PhotoGrid({
  photos,
  signed,
}: {
  photos: JobPhoto[];
  signed: Awaited<ReturnType<typeof signWithThumbnails>>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {photos.map((photo) => {
        const media = signed.get(photo.photo_url);
        return (
          <Link
            key={photo.id}
            href={`/dashboard/jobs/${photo.job_id}?from=arhiva`}
            className="press-effect relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-workshop-border dark:bg-workshop-surface-hover"
          >
            {media?.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.thumbUrl}
                alt={PHOTO_TAG_LABELS_HR[photo.tag]}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] font-semibold text-white">
              {new Date(photo.taken_at ?? photo.created_at).toLocaleDateString('hr-HR')} · {PHOTO_TAG_LABELS_HR[photo.tag]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
