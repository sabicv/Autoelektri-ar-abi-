-- =====================================================================
-- Auto Električar SaaS — Postgres RPC functions
-- Business logic that needs to run as a single atomic transaction.
-- Run after schema.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- submit_triage_intake
--
-- Atomically upserts the client (by tenant_id + phone_number) and vehicle
-- (by tenant_id + registration_plate), then inserts a PENDING_TRIAGE job
-- linking them. Called from app/api/triage/submit/route.ts with the
-- service role, so it runs as SECURITY DEFINER and is only reachable via
-- that trusted server-side path (not exposed to anon/authenticated).
--
-- Photo attachment is handled separately by the API route after this
-- returns, because moving a staged Storage object into its final path is
-- a Storage-API call, not something plain SQL can do.
-- ---------------------------------------------------------------------
create or replace function public.submit_triage_intake(
  p_tenant_slug text,
  p_first_name text,
  p_last_name text,
  p_phone_number text,
  p_registration_plate text,
  p_make text,
  p_model text,
  p_year int,
  p_vin text,
  p_symptoms text[],
  p_description text,
  p_is_emergency boolean
)
returns table (job_id uuid, tenant_id uuid, job_reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_emergency_surcharge_percent numeric;
  v_client_id uuid;
  v_vehicle_id uuid;
  v_job_id uuid;
begin
  select id, emergency_surcharge_percent
    into v_tenant_id, v_emergency_surcharge_percent
    from public.tenants where slug = p_tenant_slug;
  if v_tenant_id is null then
    raise exception 'TENANT_NOT_FOUND: %', p_tenant_slug;
  end if;

  insert into public.clients (tenant_id, first_name, last_name, phone_number)
  values (v_tenant_id, p_first_name, p_last_name, p_phone_number)
  on conflict (tenant_id, phone_number)
  do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name
  returning id into v_client_id;

  insert into public.vehicles (tenant_id, client_id, registration_plate, make, model, year, vin)
  values (v_tenant_id, v_client_id, p_registration_plate, p_make, p_model, p_year, p_vin)
  on conflict (tenant_id, registration_plate)
  do update set
    client_id = excluded.client_id,
    make = coalesce(excluded.make, public.vehicles.make),
    model = coalesce(excluded.model, public.vehicles.model),
    year = coalesce(excluded.year, public.vehicles.year),
    vin = coalesce(excluded.vin, public.vehicles.vin)
  returning id into v_vehicle_id;

  insert into public.jobs (
    tenant_id, client_id, vehicle_id, status, is_emergency, emergency_surcharge_percent, symptoms, diagnostic_notes
  ) values (
    v_tenant_id, v_client_id, v_vehicle_id, 'PENDING_TRIAGE', p_is_emergency, v_emergency_surcharge_percent, p_symptoms, p_description
  )
  returning id into v_job_id;

  return query select v_job_id, v_tenant_id, upper(left(v_job_id::text, 8));
end;
$$;

comment on function public.submit_triage_intake is 'Atomic client/vehicle upsert + PENDING_TRIAGE job insert for the public QR triage form. Server-only (service role).';

-- Only the service role calls this (from the API route) — anon/authenticated
-- never get direct EXECUTE, so all input validation stays enforced by the
-- Zod schema server-side before this runs.
revoke all on function public.submit_triage_intake from public, anon, authenticated;
grant execute on function public.submit_triage_intake to service_role;

-- ---------------------------------------------------------------------
-- apply_upsell_response
--
-- Called from app/api/notifications/webhook/route.ts when a client taps
-- the ODOBRI/ODBIJ WhatsApp quick-reply button. Looks up the most recent
-- UPSELL_REQUESTED job_event for the job to recover the price/description
-- (rather than trusting a price embedded in the button payload), applies
-- it atomically, and logs the resolution as a new job_event.
--
-- Idempotent: if the pending request already has a later
-- UPSELL_APPROVED/UPSELL_REJECTED event, it does nothing and reports
-- applied = false — Meta retries webhook deliveries on non-2xx responses,
-- so a duplicate button-click delivery must not double-charge the job.
-- ---------------------------------------------------------------------
create or replace function public.apply_upsell_response(
  p_job_id uuid,
  p_approved boolean
)
returns table (applied boolean, price numeric, tenant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_request_event public.job_events%rowtype;
  v_already_resolved boolean;
  v_price numeric;
begin
  select tenants.id into v_tenant_id from public.tenants where tenants.id = (
    select jobs.tenant_id from public.jobs where jobs.id = p_job_id
  );

  if v_tenant_id is null then
    raise exception 'JOB_NOT_FOUND: %', p_job_id;
  end if;

  select * into v_request_event
  from public.job_events
  where job_id = p_job_id and event_type = 'UPSELL_REQUESTED'
  order by created_at desc
  limit 1;

  if v_request_event.id is null then
    raise exception 'NO_PENDING_UPSELL: %', p_job_id;
  end if;

  select exists (
    select 1 from public.job_events
    where job_id = p_job_id
      and event_type in ('UPSELL_APPROVED', 'UPSELL_REJECTED')
      and created_at > v_request_event.created_at
  ) into v_already_resolved;

  if v_already_resolved then
    return query select false, null::numeric, v_tenant_id;
    return;
  end if;

  v_price := (v_request_event.metadata->>'price')::numeric;

  if p_approved then
    update public.jobs
    set total_parts_cost = total_parts_cost + coalesce(v_price, 0)
    where id = p_job_id;

    insert into public.job_events (tenant_id, job_id, event_type, actor, message, metadata)
    values (
      v_tenant_id, p_job_id, 'UPSELL_APPROVED', 'client',
      'Klijent je odobrio dodatni zahvat putem WhatsAppa.',
      v_request_event.metadata
    );
  else
    insert into public.job_events (tenant_id, job_id, event_type, actor, message, metadata)
    values (
      v_tenant_id, p_job_id, 'UPSELL_REJECTED', 'client',
      'Klijent je odbio dodatni zahvat putem WhatsAppa.',
      v_request_event.metadata
    );
  end if;

  return query select true, v_price, v_tenant_id;
end;
$$;

comment on function public.apply_upsell_response is 'Atomically applies a client WhatsApp ODOBRI/ODBIJ response to the job total + timeline. Idempotent against duplicate webhook deliveries. Server-only (service role).';

revoke all on function public.apply_upsell_response from public, anon, authenticated;
grant execute on function public.apply_upsell_response to service_role;

-- ---------------------------------------------------------------------
-- recalculate_parking_fees
--
-- Called daily by app/api/cron/parking-check/route.ts. Historically this
-- computed and accrued a monetary penalty (accrued_parking_fees) — the
-- platform no longer does aggressive fee enforcement, so this is now a
-- passive read-only check: it finds FINISHED_AWAITING_PICKUP jobs sitting
-- past the tenant's configured window and returns how many days, purely
-- so the cron route can leave an informational job_events note. It does
-- NOT write to jobs.accrued_parking_fees anymore — that column is frozen
-- at whatever value existing rows already had (kept for historical/
-- accounting reference, not actively grown).
-- ---------------------------------------------------------------------
create or replace function public.recalculate_parking_fees()
returns table (
  job_id uuid,
  tenant_id uuid,
  days_parked int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    j.id,
    j.tenant_id,
    floor(extract(epoch from (now() - j.finished_at)) / 86400)::int as computed_days_parked
  from public.jobs j
  join public.tenants t on t.id = j.tenant_id
  where j.status = 'FINISHED_AWAITING_PICKUP'
    and j.finished_at is not null
    and floor(extract(epoch from (now() - j.finished_at)) / 86400)::int > t.free_parking_days;
end;
$$;

comment on function public.recalculate_parking_fees is 'Daily cron: passively reports FINISHED_AWAITING_PICKUP jobs sitting past the tenant''s window. Does not accrue fees. Server-only (service role).';

revoke all on function public.recalculate_parking_fees from public, anon, authenticated;
grant execute on function public.recalculate_parking_fees to service_role;
