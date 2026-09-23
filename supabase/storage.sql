-- =====================================================================
-- Auto Električar SaaS — Storage: job-vault bucket
-- Permanent photo vault for intake photos, DTC screenshots, wiring
-- defects, new parts, and invoices.
--
-- Object path convention (enforced by policy, not by a DB constraint):
--   {tenant_id}/{job_id}/{tag}_{timestamp}.jpg
-- e.g. 11111111-1111-1111-1111-111111111111/44444444-4444-4444-4444-444444444444/WIRING_DEFECT_1716400000000.jpg
--
-- The bucket is private: photos frequently contain registration cards and
-- other customer PII, so they are served via short-lived signed URLs
-- generated server-side rather than public links. Safe to re-run.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-vault',
  'job-vault',
  false,
  20971520, -- 20 MB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase by default; policies
-- below scope every operation to the first path segment, {tenant_id},
-- matching the requesting staff member's own tenant.

drop policy if exists "job_vault_tenant_select" on storage.objects;
create policy "job_vault_tenant_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  );

drop policy if exists "job_vault_tenant_insert" on storage.objects;
create policy "job_vault_tenant_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  );

drop policy if exists "job_vault_tenant_update" on storage.objects;
create policy "job_vault_tenant_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  )
  with check (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  );

drop policy if exists "job_vault_tenant_delete" on storage.objects;
create policy "job_vault_tenant_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  );

-- ---------------------------------------------------------------------
-- Public QR triage staging uploads
--
-- Before a job exists, an anonymous visitor's browser uploads photos
-- straight to Storage at {tenant_id}/temp_{timestamp}_{filename}. This is
-- intentionally narrow: anon may only write/delete objects whose name
-- matches the temp_ staging pattern inside a real tenant's folder — never
-- the {tenant_id}/{job_id}/... path staff and the API route use, which
-- stays authenticated-only via the policies above. The API route moves a
-- staged file into its final path with the service role once the job is
-- created, bypassing RLS entirely.
-- ---------------------------------------------------------------------

drop policy if exists "job_vault_public_triage_insert" on storage.objects;
create policy "job_vault_public_triage_insert" on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] in (select id::text from public.tenants)
    and name ~ '/temp_[0-9]+_.+$'
  );

drop policy if exists "job_vault_public_triage_delete" on storage.objects;
create policy "job_vault_public_triage_delete" on storage.objects
  for delete
  to anon
  using (
    bucket_id = 'job-vault'
    and (storage.foldername(name))[1] in (select id::text from public.tenants)
    and name ~ '/temp_[0-9]+_.+$'
  );

-- ---------------------------------------------------------------------
-- tenant-branding bucket
--
-- Logos are shown unauthenticated on the public /t/[tenant_slug] triage
-- page (a plain <img>/<Image> tag — no Authorization header). job-vault is
-- deliberately private (registration cards, defect photos), and Supabase
-- Storage's "public" flag is bucket-wide, not path-scoped — so a logo
-- cannot safely live in job-vault no matter how RLS is configured there.
-- A separate public bucket, scoped to non-sensitive branding assets only,
-- is the correct fix.
--
-- Path convention: {tenant_id}/logo_{timestamp}.{ext}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-branding',
  'tenant-branding',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reads are unauthenticated by virtue of the bucket's public flag (no
-- policy needed/consulted for public-bucket reads). Writes still go
-- through the authenticated API and are RLS-checked as normal.
drop policy if exists "tenant_branding_staff_write" on storage.objects;
create policy "tenant_branding_staff_write" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'tenant-branding'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  )
  with check (
    bucket_id = 'tenant-branding'
    and (storage.foldername(name))[1] = public.auth_tenant_id()::text
  );
