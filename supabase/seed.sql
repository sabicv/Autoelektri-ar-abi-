-- =====================================================================
-- Auto Električar SaaS — Seed data
-- Realistic Croatian mock data for local development. Safe to re-run:
-- every insert uses a fixed UUID with ON CONFLICT (id) DO NOTHING.
-- =====================================================================

-- Tenant: Brane Auto Električar -----------------------------------------
insert into public.tenants (
  id, name, slug, logo_url, phone, address,
  industry_type, free_parking_days, daily_parking_fee, created_at
) values (
  '11111111-1111-1111-1111-111111111111',
  'Brane Auto Električar',
  'brane-autoelektrika',
  null,
  '+385915550123',
  'Brnaze bb, 21230 Sinj, Hrvatska',
  'auto_electrician',
  3,
  15.00,
  now()
)
on conflict (id) do nothing;

-- Client: Ivan Horvat -----------------------------------------------------
insert into public.clients (
  id, tenant_id, first_name, last_name, phone_number, email, notes, created_at
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Ivan',
  'Horvat',
  '+385912345678',
  'ivan.horvat@example.com',
  'Redoviti klijent, preferira kontakt putem telefona.',
  now()
)
on conflict (id) do nothing;

-- Vehicle: VW Golf 7 2.0 TDI ------------------------------------------------
insert into public.vehicles (
  id, tenant_id, client_id, vin, registration_plate, make, model, year, created_at
) values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'WVWZZZAUZEW123456',
  'ZG-1234-AA',
  'Volkswagen',
  'Golf 7 2.0 TDI',
  2015,
  now()
)
on conflict (id) do nothing;

-- Job: parasitic drain investigation ---------------------------------------
insert into public.jobs (
  id, tenant_id, client_id, vehicle_id, status,
  is_emergency, emergency_surcharge_percent,
  diagnostic_hours, repair_hours,
  diagnostic_notes, work_summary,
  total_parts_cost, total_labor_cost, accrued_parking_fees,
  finished_at, collected_at, created_at
) values (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'PARASITIC_DRAIN_TESTING',
  false,
  50.00,
  2.50,
  0,
  'Klijent prijavio prazan akumulator nakon dvije noći mirovanja. Sumnja na parazitsko pražnjenje preko CAN-BUS modula. Pokrenut test potrošnje u stanju mirovanja (key-off).',
  null,
  0,
  0,
  0,
  null,
  null,
  now()
)
on conflict (id) do nothing;

-- Diagnostic report for the job above ---------------------------------------
insert into public.diagnostic_reports (
  id, job_id, dtc_codes, battery_drain_ma, module_notes, created_at
) values (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  array['P0300', 'U0121'],
  350.00,
  'Izmjereno 350mA potrošnje u mirovanju, iznad dopuštene granice (<50mA). U0121 upućuje na gubitak komunikacije s ABS modulom, moguć uzrok isprekidanog CAN-BUS signala. Slijedi izolacija po osiguračima (fuse pull test).',
  now()
)
on conflict (id) do nothing;
