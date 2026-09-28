-- =====================================================================
-- Auto Električar SaaS — Core Database Schema
-- Multi-tenant architecture for auto-electrician diagnostic workshops.
-- Safe to re-run: every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Enum types
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum (
      'PENDING_TRIAGE',
      'IN_DIAGNOSTIC',
      'PARASITIC_DRAIN_TESTING',
      'AWAITING_MODULE_REMAP',
      'IN_REPAIR',
      'FINISHED_AWAITING_PICKUP',
      'COLLECTED'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'photo_tag') then
    create type public.photo_tag as enum (
      'INTAKE_CONDITION',
      'REGISTRATION_CARD',
      'DTC_DIAGNOSTIC_SCREEN',
      'WIRING_DEFECT',
      'NEW_PARTS',
      'PARTS_INVOICE'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------

-- tenants: one row per workshop ("radni nalog" owner)
create table if not exists public.tenants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  logo_url            text,
  phone               text,
  address             text,
  industry_type       text not null default 'auto_electrician',
  free_parking_days   int not null default 3 check (free_parking_days >= 0),
  daily_parking_fee   numeric(10, 2) not null default 15.00 check (daily_parking_fee >= 0),
  created_at          timestamptz not null default now()
);

comment on table public.tenants is 'One row per auto-electrician workshop tenant.';
comment on column public.tenants.free_parking_days is 'Grace period before daily_parking_fee starts accruing on a finished, uncollected job.';

-- profiles: links a Supabase auth user to the tenant they staff for.
-- Required infrastructure for tenant-scoped RLS (auth.uid() -> tenant_id).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  full_name   text,
  role        text not null default 'owner',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Maps an authenticated staff user to the tenant they work for.';

-- clients: workshop customers
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  phone_number  text not null,
  email         text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- vehicles: owned by a client, scoped to a tenant
create table if not exists public.vehicles (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  client_id             uuid not null references public.clients (id) on delete cascade,
  vin                   text,
  registration_plate    text not null,
  make                  text,
  model                 text,
  year                  int check (year is null or (year between 1900 and extract(year from now())::int + 1)),
  created_at            timestamptz not null default now()
);

-- jobs: a single repair/diagnostic ticket
create table if not exists public.jobs (
  id                              uuid primary key default gen_random_uuid(),
  tenant_id                       uuid not null references public.tenants (id) on delete cascade,
  client_id                       uuid not null references public.clients (id) on delete cascade,
  vehicle_id                      uuid not null references public.vehicles (id) on delete cascade,
  status                          public.job_status not null default 'PENDING_TRIAGE',
  is_emergency                    boolean not null default false,
  emergency_surcharge_percent     numeric(5, 2) not null default 50.00 check (emergency_surcharge_percent >= 0),
  diagnostic_hours                numeric(6, 2) not null default 0 check (diagnostic_hours >= 0),
  repair_hours                    numeric(6, 2) not null default 0 check (repair_hours >= 0),
  symptoms                        text[] not null default '{}',
  diagnostic_notes                text,
  work_summary                    text,
  total_parts_cost                numeric(10, 2) not null default 0 check (total_parts_cost >= 0),
  total_labor_cost                numeric(10, 2) not null default 0 check (total_labor_cost >= 0),
  accrued_parking_fees            numeric(10, 2) not null default 0 check (accrued_parking_fees >= 0),
  finished_at                     timestamptz,
  collected_at                    timestamptz,
  created_at                      timestamptz not null default now()
);

comment on table public.jobs is 'A single vehicle intake -> diagnostic -> repair -> pickup ticket.';
comment on column public.jobs.accrued_parking_fees is 'Fees accrued once a vehicle sits FINISHED_AWAITING_PICKUP past tenants.free_parking_days.';

-- diagnostic_reports: structured diagnostic findings for a job
create table if not exists public.diagnostic_reports (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs (id) on delete cascade,
  dtc_codes           text[] not null default '{}',
  battery_drain_ma    numeric(10, 2) check (battery_drain_ma is null or battery_drain_ma >= 0),
  module_notes        text,
  created_at          timestamptz not null default now()
);

comment on column public.diagnostic_reports.dtc_codes is 'OBD-II / manufacturer DTC fault codes, e.g. {P0300,CAN-BUS-ERR}.';
comment on column public.diagnostic_reports.battery_drain_ma is 'Parasitic draw measured during a key-off drain test, in milliamps.';

-- job_photos: permanent photo vault
create table if not exists public.job_photos (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  photo_url     text not null,
  tag           public.photo_tag not null,
  caption       text,
  created_at    timestamptz not null default now()
);

comment on table public.job_photos is 'Permanent photo vault entries; file lives in the job-vault storage bucket.';

-- ---------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_tenant_id on public.profiles (tenant_id);

create index if not exists idx_clients_tenant_id on public.clients (tenant_id);
create index if not exists idx_clients_phone_number on public.clients (phone_number);

create index if not exists idx_vehicles_tenant_id on public.vehicles (tenant_id);
create index if not exists idx_vehicles_client_id on public.vehicles (client_id);
create index if not exists idx_vehicles_vin on public.vehicles (vin);
create index if not exists idx_vehicles_registration_plate on public.vehicles (registration_plate);

create index if not exists idx_jobs_tenant_id on public.jobs (tenant_id);
create index if not exists idx_jobs_client_id on public.jobs (client_id);
create index if not exists idx_jobs_vehicle_id on public.jobs (vehicle_id);
create index if not exists idx_jobs_status on public.jobs (status);

create index if not exists idx_diagnostic_reports_job_id on public.diagnostic_reports (job_id);

create index if not exists idx_job_photos_tenant_id on public.job_photos (tenant_id);
create index if not exists idx_job_photos_job_id on public.job_photos (job_id);
create index if not exists idx_job_photos_tag on public.job_photos (tag);

-- ---------------------------------------------------------------------
-- 4. Helper function: resolve the calling user's tenant_id
-- SECURITY DEFINER + fixed search_path so it can read public.profiles
-- regardless of the caller's RLS grants, without causing policy recursion.
-- ---------------------------------------------------------------------
create or replace function public.auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.jobs enable row level security;
alter table public.diagnostic_reports enable row level security;
alter table public.job_photos enable row level security;

-- Table-level grants (RLS still applies on top of these).
grant usage on schema public to anon, authenticated;

grant select, update on public.tenants to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.diagnostic_reports to authenticated;
grant select, insert, update, delete on public.job_photos to authenticated;

-- Public QR triage endpoint needs to create a client, its vehicle, and the
-- job itself without an authenticated session.
grant insert on public.clients to anon;
grant insert on public.vehicles to anon;
grant insert on public.jobs to anon;

-- tenants ---------------------------------------------------------------
drop policy if exists "tenants_select_own" on public.tenants;
create policy "tenants_select_own" on public.tenants
  for select
  to authenticated
  using (id = public.auth_tenant_id());

drop policy if exists "tenants_update_own" on public.tenants;
create policy "tenants_update_own" on public.tenants
  for update
  to authenticated
  using (id = public.auth_tenant_id())
  with check (id = public.auth_tenant_id());

-- profiles ----------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- clients -------------------------------------------------------------
drop policy if exists "clients_staff_all" on public.clients;
create policy "clients_staff_all" on public.clients
  for all
  to authenticated
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

drop policy if exists "clients_public_qr_triage_insert" on public.clients;
create policy "clients_public_qr_triage_insert" on public.clients
  for insert
  to anon
  with check (true);

-- vehicles ------------------------------------------------------------
drop policy if exists "vehicles_staff_all" on public.vehicles;
create policy "vehicles_staff_all" on public.vehicles
  for all
  to authenticated
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

drop policy if exists "vehicles_public_qr_triage_insert" on public.vehicles;
create policy "vehicles_public_qr_triage_insert" on public.vehicles
  for insert
  to anon
  with check (true);

-- jobs ------------------------------------------------------------------
drop policy if exists "jobs_staff_all" on public.jobs;
create policy "jobs_staff_all" on public.jobs
  for all
  to authenticated
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

-- Public QR triage may only ever create a fresh ticket in the intake queue.
drop policy if exists "jobs_public_qr_triage_insert" on public.jobs;
create policy "jobs_public_qr_triage_insert" on public.jobs
  for insert
  to anon
  with check (status = 'PENDING_TRIAGE');

-- diagnostic_reports (no tenant_id column; scope via the parent job) ------
drop policy if exists "diagnostic_reports_staff_all" on public.diagnostic_reports;
create policy "diagnostic_reports_staff_all" on public.diagnostic_reports
  for all
  to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = diagnostic_reports.job_id
        and jobs.tenant_id = public.auth_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.jobs
      where jobs.id = diagnostic_reports.job_id
        and jobs.tenant_id = public.auth_tenant_id()
    )
  );

-- job_photos --------------------------------------------------------------
drop policy if exists "job_photos_staff_all" on public.job_photos;
create policy "job_photos_staff_all" on public.job_photos
  for all
  to authenticated
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

-- ---------------------------------------------------------------------
-- 6. Triage module support (public QR intake at /t/[tenant_slug])
-- ---------------------------------------------------------------------

-- Patches installs that ran an earlier version of this file, where these
-- columns/constraints did not yet exist. Harmless no-op on a fresh install.
alter table public.jobs add column if not exists symptoms text[] not null default '{}';
alter table public.vehicles alter column registration_plate set not null;

comment on column public.jobs.symptoms is 'Customer-selected symptom codes captured at QR triage intake (e.g. PARASITIC_DRAIN, DASHBOARD_LIGHTS).';

-- Natural-key uniqueness so the triage intake flow can upsert by
-- (tenant_id, phone_number) / (tenant_id, registration_plate) instead of
-- creating duplicate clients/vehicles on a repeat visit.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_tenant_phone_unique'
  ) then
    alter table public.clients
      add constraint clients_tenant_phone_unique unique (tenant_id, phone_number);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vehicles_tenant_plate_unique'
  ) then
    alter table public.vehicles
      add constraint vehicles_tenant_plate_unique unique (tenant_id, registration_plate);
  end if;
end $$;

-- Tenant branding (name/logo/phone/address) must be readable by an
-- anonymous visitor who just scanned the QR code, before any login exists.
grant select on public.tenants to anon;

drop policy if exists "tenants_public_select" on public.tenants;
create policy "tenants_public_select" on public.tenants
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------
-- 7. Telephony + notifications support
-- ---------------------------------------------------------------------

-- Maps an inbound Vapi.ai call (identified by the Vapi phone number
-- resource id that was dialed) to the tenant it belongs to.
alter table public.tenants add column if not exists vapi_phone_number_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_vapi_phone_number_id_unique'
  ) then
    alter table public.tenants
      add constraint tenants_vapi_phone_number_id_unique unique (vapi_phone_number_id);
  end if;
end $$;

comment on column public.tenants.vapi_phone_number_id is 'Vapi.ai phone number resource id used to resolve which tenant an inbound call belongs to.';

-- job_events: generic audit trail / timeline for a job — WhatsApp dispatch
-- log, client button responses, status changes, etc.
create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  event_type  text not null,
  actor       text not null default 'system' check (actor in ('system', 'mechanic', 'client')),
  message     text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

comment on table public.job_events is 'Audit trail / timeline entries for a job: WhatsApp dispatch log, client responses, status changes.';

create index if not exists idx_job_events_job_id on public.job_events (job_id, created_at desc);
create index if not exists idx_job_events_tenant_id on public.job_events (tenant_id);

alter table public.job_events enable row level security;

grant select, insert on public.job_events to authenticated;

drop policy if exists "job_events_staff_all" on public.job_events;
create policy "job_events_staff_all" on public.job_events
  for all
  to authenticated
  using (tenant_id = public.auth_tenant_id())
  with check (tenant_id = public.auth_tenant_id());

-- ---------------------------------------------------------------------
-- 8. Tenant white-label settings support
-- ---------------------------------------------------------------------

-- Tenant-level default, editable on /dashboard/settings. jobs.emergency_
-- surcharge_percent remains what was actually charged on that specific
-- job (copied from this default at intake time via submit_triage_intake,
-- see functions.sql) — so changing this later doesn't rewrite history.
alter table public.tenants add column if not exists emergency_surcharge_percent numeric(5, 2) not null default 50.00;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tenants_emergency_surcharge_percent_check'
  ) then
    alter table public.tenants
      add constraint tenants_emergency_surcharge_percent_check check (emergency_surcharge_percent >= 0);
  end if;
end $$;

comment on column public.tenants.emergency_surcharge_percent is 'Default emergency surcharge percent applied to new jobs at intake; jobs.emergency_surcharge_percent stores what was actually charged for that job.';

-- ---------------------------------------------------------------------
-- 9. Draft-until-confirmed job records
-- ---------------------------------------------------------------------

-- NULL = draft, every field on the job (and its client/vehicle) stays
-- freely editable from the job detail page. Once the mechanic taps
-- "Potvrdi nalog", this is set and content (client/vehicle info, symptoms,
-- diagnostic notes, work summary, cost) becomes read-only — status changes
-- and photo uploads still work after confirmation, only the RECORDED
-- CONTENT freezes, matching a finalized/audit-safe record.
alter table public.jobs add column if not exists confirmed_at timestamptz;

comment on column public.jobs.confirmed_at is 'When the mechanic locked the job record. NULL = still a draft (fully editable).';

-- ---------------------------------------------------------------------
-- 10. Invoice-relevant client fields
-- ---------------------------------------------------------------------

-- Address and OIB (Croatian personal/company tax id) — collected by staff
-- when useful for a work order / future fiscal invoice, never required on
-- the public QR triage form.
alter table public.clients add column if not exists address text;
alter table public.clients add column if not exists oib text;

comment on column public.clients.oib is 'Croatian OIB (11-digit tax id) — format-checked only (11 digits), not checksum-validated.';

-- ---------------------------------------------------------------------
-- 11. Sales-demo data support
-- ---------------------------------------------------------------------

-- Marks a client (and, by cascade, its vehicles/jobs/reports/events) as
-- seeded sales-demo content rather than a real customer. /api/demo/reset
-- only ever deletes and re-inserts rows with is_demo = true, so it can
-- never touch real client data created through the normal intake flows.
alter table public.clients add column if not exists is_demo boolean not null default false;

comment on column public.clients.is_demo is 'true for curated demo dataset rows (see lib/demo-seed.ts); real clients are always false.';

-- ---------------------------------------------------------------------
-- 12. Generic document attachments (job-vault, not just photos)
-- ---------------------------------------------------------------------

-- The job-vault storage bucket and job_photos table already handle any
-- file type (storage doesn't check content-type), so a running business
-- needs somewhere to put PDFs — scanned diagnostic reports, supplier
-- invoices, warranty papers — without inventing a parallel table. This
-- just adds one more tag value for "non-photo document"; the UI decides
-- how to render a row (image vs. document tile) from the file extension.
alter type public.photo_tag add value if not exists 'DOCUMENT';

comment on type public.photo_tag is 'Tags job_photos rows — despite the name, DOCUMENT entries may be any file type (PDF, etc.), not just images.';

-- ---------------------------------------------------------------------
-- 13. Staff roles: owner vs. mechanic
-- ---------------------------------------------------------------------

-- Any hand-provisioned profile predating this constraint becomes an owner,
-- which is what every existing account already effectively was.
update public.profiles set role = 'owner' where role not in ('owner', 'mechanic');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'mechanic'));
  end if;
end $$;

comment on column public.profiles.role is 'owner = full access incl. finances, archive, settings, staff. mechanic = jobs and clients only.';

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Owners see their whole team; a mechanic still only sees their own row
-- (profiles_select_own). Permissive policies OR together. There is
-- deliberately no insert policy: creating a staff member also creates an
-- auth.users row, which only the service-role client can do
-- (app/api/staff/route.ts).
drop policy if exists "profiles_owner_select_staff" on public.profiles;
create policy "profiles_owner_select_staff" on public.profiles
  for select
  to authenticated
  using (tenant_id = public.auth_tenant_id() and public.auth_role() = 'owner');

-- Workshop settings (pricing, slug, branding) are owner-only.
drop policy if exists "tenants_update_own" on public.tenants;
create policy "tenants_update_own" on public.tenants
  for update
  to authenticated
  using (id = public.auth_tenant_id() and public.auth_role() = 'owner')
  with check (id = public.auth_tenant_id() and public.auth_role() = 'owner');

-- ---------------------------------------------------------------------
-- 14. Tenant subscription lock
-- ---------------------------------------------------------------------

-- Set by the platform operator in the SQL editor until real billing exists:
--   update public.tenants set status = 'suspended', status_note = '...' where slug = '...';
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tenant_status') then
    create type public.tenant_status as enum ('active', 'trial', 'suspended');
  end if;
end $$;

alter table public.tenants add column if not exists status public.tenant_status not null default 'active';
alter table public.tenants add column if not exists status_note text;

comment on column public.tenants.status is 'suspended = all staff of this workshop are locked out (auth_tenant_id() resolves to null). Operator-only.';
comment on column public.tenants.status_note is 'Operator''s internal note, e.g. why a workshop was suspended. Never shown in the app.';

-- A suspended workshop resolves to no tenant at all, so every tenant-scoped
-- policy (tables and storage alike) denies its staff without editing each
-- policy. The public QR intake path doesn't use this and keeps working.
create or replace function public.auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid() and t.status <> 'suspended'
$$;

-- Staff may edit their workshop's settings but never its status — without
-- this column list, tenants_update_own would let an owner un-suspend or
-- self-upgrade from the browser.
revoke update on public.tenants from authenticated;
grant update (
  name, slug, phone, address, logo_url,
  free_parking_days, daily_parking_fee, emergency_surcharge_percent
) on public.tenants to authenticated;

-- ---------------------------------------------------------------------
-- 15. Payment tracking + owner-only financial fields on jobs
-- ---------------------------------------------------------------------

-- The job row already is the invoice (labor + parts totals), so paid /
-- unpaid is two columns here rather than a separate invoices table.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('UNPAID', 'PAID');
  end if;
end $$;

alter table public.jobs add column if not exists payment_status public.payment_status not null default 'UNPAID';
alter table public.jobs add column if not exists paid_at timestamptz;

create index if not exists idx_jobs_payment_status on public.jobs (tenant_id, payment_status);

-- Mechanics need the rest of a job row (status, notes, work summary), so
-- RLS — which is row-level only — can't hide these columns, and a column
-- GRANT can't tell owner from mechanic (both are the `authenticated` DB
-- role). A trigger can. Service-role callers (auth.uid() is null, e.g.
-- apply_upsell_response) are trusted server code and pass through.
create or replace function public.enforce_owner_only_job_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce(public.auth_role(), '') <> 'owner'
     and (
       new.total_labor_cost is distinct from old.total_labor_cost
       or new.total_parts_cost is distinct from old.total_parts_cost
       or new.accrued_parking_fees is distinct from old.accrued_parking_fees
       or new.payment_status is distinct from old.payment_status
       or new.paid_at is distinct from old.paid_at
     ) then
    raise exception 'Samo vlasnik radionice može mijenjati cijene i plaćanje.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_owner_only_job_fields on public.jobs;
create trigger trg_enforce_owner_only_job_fields
  before update on public.jobs
  for each row
  execute function public.enforce_owner_only_job_fields();

-- ---------------------------------------------------------------------
-- 16. Workshop tasks: owner dictates, a mechanic receives it live
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('PENDING', 'IN_PROGRESS', 'DONE');
  end if;
end $$;

create table if not exists public.mechanic_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  sender_id    uuid references public.profiles (id) on delete set null,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  job_id       uuid references public.jobs (id) on delete set null,
  message_text text not null check (length(btrim(message_text)) > 0),
  status       public.task_status not null default 'PENDING',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_mechanic_tasks_receiver on public.mechanic_tasks (receiver_id, status);
create index if not exists idx_mechanic_tasks_tenant on public.mechanic_tasks (tenant_id, created_at desc);

alter table public.mechanic_tasks enable row level security;

-- A mechanic may only move a task along (status), never rewrite or reassign it.
grant select, insert, delete on public.mechanic_tasks to authenticated;
revoke update on public.mechanic_tasks from authenticated;
grant update (status, updated_at) on public.mechanic_tasks to authenticated;

-- Colleagues' names, so a mechanic can see who a task came from. profiles
-- holds nothing sensitive (name, role, tenant).
drop policy if exists "profiles_select_tenant" on public.profiles;
create policy "profiles_select_tenant" on public.profiles
  for select
  to authenticated
  using (tenant_id = public.auth_tenant_id());

drop policy if exists "mechanic_tasks_select" on public.mechanic_tasks;
create policy "mechanic_tasks_select" on public.mechanic_tasks
  for select
  to authenticated
  using (tenant_id = public.auth_tenant_id() and (receiver_id = auth.uid() or public.auth_role() = 'owner'));

drop policy if exists "mechanic_tasks_insert_owner" on public.mechanic_tasks;
create policy "mechanic_tasks_insert_owner" on public.mechanic_tasks
  for insert
  to authenticated
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() = 'owner'
    and sender_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = receiver_id and p.tenant_id = mechanic_tasks.tenant_id)
    and (job_id is null or exists (select 1 from public.jobs j where j.id = job_id and j.tenant_id = mechanic_tasks.tenant_id))
  );

drop policy if exists "mechanic_tasks_update" on public.mechanic_tasks;
create policy "mechanic_tasks_update" on public.mechanic_tasks
  for update
  to authenticated
  using (tenant_id = public.auth_tenant_id() and (receiver_id = auth.uid() or public.auth_role() = 'owner'))
  with check (tenant_id = public.auth_tenant_id() and (receiver_id = auth.uid() or public.auth_role() = 'owner'));

drop policy if exists "mechanic_tasks_delete_owner" on public.mechanic_tasks;
create policy "mechanic_tasks_delete_owner" on public.mechanic_tasks
  for delete
  to authenticated
  using (tenant_id = public.auth_tenant_id() and public.auth_role() = 'owner');

-- Live delivery. Supabase Realtime applies the select policy above per
-- subscriber, so a mechanic's socket only ever receives their own tasks.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mechanic_tasks'
  ) then
    alter publication supabase_realtime add table public.mechanic_tasks;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 17. Photo capture metadata (read from EXIF in the browser at upload)
-- ---------------------------------------------------------------------

-- created_at is when the file reached the server; taken_at is when the
-- shutter fired, which is what a repair history should be ordered by.
alter table public.job_photos add column if not exists taken_at timestamptz;
alter table public.job_photos add column if not exists gps_lat double precision;
alter table public.job_photos add column if not exists gps_lng double precision;

comment on column public.job_photos.taken_at is 'Capture time from EXIF (or the file timestamp). NULL for older uploads — fall back to created_at.';

-- ---------------------------------------------------------------------
-- 18. Help requests, replies and a permanent per-job message record
-- ---------------------------------------------------------------------

-- TASK = owner → mechanic. HELP = mechanic → management ("Trebam pomoć"),
-- addressed to no single person: every owner sees it.
alter table public.mechanic_tasks add column if not exists kind text not null default 'TASK';
alter table public.mechanic_tasks add column if not exists photo_path text;
alter table public.mechanic_tasks add column if not exists reply_to_id uuid references public.mechanic_tasks (id) on delete set null;
alter table public.mechanic_tasks alter column receiver_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mechanic_tasks_kind_check') then
    alter table public.mechanic_tasks
      add constraint mechanic_tasks_kind_check
      check (kind in ('TASK', 'HELP') and (kind = 'HELP' or receiver_id is not null));
  end if;
end $$;

create index if not exists idx_mechanic_tasks_job on public.mechanic_tasks (job_id, created_at);

-- Senders also see what they sent (a mechanic tracks their own help requests).
drop policy if exists "mechanic_tasks_select" on public.mechanic_tasks;
create policy "mechanic_tasks_select" on public.mechanic_tasks
  for select
  to authenticated
  using (
    tenant_id = public.auth_tenant_id()
    and (receiver_id = auth.uid() or sender_id = auth.uid() or public.auth_role() = 'owner')
  );

drop policy if exists "mechanic_tasks_insert_help" on public.mechanic_tasks;
create policy "mechanic_tasks_insert_help" on public.mechanic_tasks
  for insert
  to authenticated
  with check (
    tenant_id = public.auth_tenant_id()
    and kind = 'HELP'
    and sender_id = auth.uid()
    and receiver_id is null
    and job_id is not null
    and exists (select 1 from public.jobs j where j.id = job_id and j.tenant_id = mechanic_tasks.tenant_id)
  );

-- Anything tied to a job is part of that job's permanent record: text is
-- already immutable (column grant), and now it can't be deleted either.
drop policy if exists "mechanic_tasks_delete_owner" on public.mechanic_tasks;
create policy "mechanic_tasks_delete_owner" on public.mechanic_tasks
  for delete
  to authenticated
  using (tenant_id = public.auth_tenant_id() and public.auth_role() = 'owner' and job_id is null);

-- Web Push endpoints, one per device a staff member enabled notifications on.
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_profile on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;
grant select, insert, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all
  to authenticated
  using (profile_id = auth.uid() and tenant_id = public.auth_tenant_id())
  with check (profile_id = auth.uid() and tenant_id = public.auth_tenant_id());
