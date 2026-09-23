# Auto Električar SaaS

Multi-tenant platforma za auto-električarske radionice: QR prijava kvara bez tipkanja, trajni foto-arhiv, AI telefonski recepcioner, WhatsApp obavijesti s odobrenjem mehaničara, praćenje ležarine i osnovna analitika.

## 1. Preduvjeti

- Node.js 20+ i npm
- Supabase projekt (besplatni tier je dovoljan za razvoj)
- Za produkciju: Vapi.ai račun (telefonija) i Meta WhatsApp Business Cloud API pristup

## 2. Lokalno pokretanje

```bash
npm install
cp .env.example .env.local
```

Ispunite `.env.local` sa stvarnim vrijednostima (vidi komentare u `.env.example` za objašnjenje svake varijable — Supabase ključevi su obavezni za rad aplikacije, Vapi/Meta/Cron varijable su potrebne tek kad povezujete te integracije).

```bash
npm run dev
```

Aplikacija je na `http://localhost:3000`. Javna stranica za prijavu kvara je na `/t/[slug]` (npr. `/t/brane-autoelektrika` ako koristite seed podatke), a nadzorna ploča za osoblje na `/dashboard` (zahtijeva prijavu).

Prije commit-a/deploya provjerite da nema TypeScript grešaka:

```bash
npm run type-check
npm run build
```

## 3. Supabase — redoslijed izvršavanja SQL migracija

U Supabase dashboardu (SQL Editor) pokrenite datoteke iz `supabase/` **ovim točnim redoslijedom** — svaka je idempotentna (sigurno ju je ponovno pokrenuti):

1. `supabase/schema.sql` — tablice, enumi, indeksi, RLS politike
2. `supabase/storage.sql` — `job-vault` (privatni) i `tenant-branding` (javni) storage bucketi + politike
3. `supabase/functions.sql` — Postgres RPC funkcije (`submit_triage_intake`, `apply_upsell_response`, `recalculate_parking_fees`)
4. `supabase/seed.sql` — opcionalno, primjer podataka za razvoj ("Brane Auto Električar")

### Kreiranje prvog korisničkog naloga za osoblje

Tablica `profiles` povezuje Supabase Auth korisnika s tenantom (radionicom) i njome se pokreće cijeli sustav prava pristupa (RLS). Nijedan `/dashboard` route ne radi bez ovoga:

1. Supabase Dashboard → Authentication → Users → **Add user** (email + lozinka).
2. Kopirajte novokreirani `user_id` (UUID).
3. U SQL Editoru:

```sql
insert into public.profiles (id, tenant_id, full_name, role)
values (
  '<user_id iz koraka 2>',
  '11111111-1111-1111-1111-111111111111', -- id tenanta iz seed.sql, ili vaš stvarni tenant.id
  'Ime Prezime',
  'owner'
);
```

Sada se tim korisnikom možete prijaviti na `/login`.

## 4. Integracije (opcionalno, po potrebi)

- **Vapi.ai (telefonija):** u Vapi dashboardu postavite Server URL asistenta na `https://vasa-domena.com/api/telephony/incoming-call`, kopirajte "Server URL Secret" u `VAPI_SERVER_SECRET`, a ID postojećeg asistenta u `VAPI_ASSISTANT_ID`. Broj telefona kupljen u Vapiju treba upisati u `tenants.vapi_phone_number_id` (njegov Vapi resource id) da bi sustav znao kojem tenantu poziv pripada.
- **Meta WhatsApp Cloud API:** u Meta App Dashboardu potrebni su `WHATSAPP_ACCESS_TOKEN` (permanent token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (za provjeru potpisa webhooka) i `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (proizvoljan string koji upišete i u Meta i u `.env`). Webhook URL: `https://vasa-domena.com/api/notifications/webhook`. Predlošci poruka (`job_finished_notice`, `upsell_request`, `parking_warning`) moraju biti unaprijed odobreni u Meta Business Manageru — imena predložaka su konfigurabilna preko `WHATSAPP_TEMPLATE_*` varijabli.

## 5. Deployment

Ova aplikacija **zahtijeva** hosting koji podržava Next.js API rute, middleware, cookie-based sesije i cron jobove (npr. Vercel). Statički hosting (npr. Surge.sh, GitHub Pages) **neće raditi** — nema poslužiteljsku okolinu za `/api/*` rute, middleware ni zakazani `parking-check` posao.

### Vercel (preporučeno)

1. Povežite repozitorij na [vercel.com](https://vercel.com).
2. U Project Settings → Environment Variables dodajte sve varijable iz `.env.example`.
3. `vercel.json` već sadrži konfiguraciju za dnevni cron (`/api/cron/parking-check` u 03:00). Vercel automatski šalje `Authorization: Bearer $CRON_SECRET` na taj poziv čim je `CRON_SECRET` postavljen kao env varijabla — ništa dodatno nije potrebno.
4. Deploy. Nakon prvog uspješnog deploya ažurirajte Vapi/Meta webhook URL-ove na stvarnu domenu.

### Netlify

Next.js App Router (rute, middleware) radi preko Netlify's Next.js Runtime adaptera, ali Netlify nema izvorni "Cron Jobs" ekvivalent identičan Vercelovom — `/api/cron/parking-check` bi trebalo okidati vanjskim schedulerom (npr. GitHub Actions `schedule` trigger ili [cron-job.org](https://cron-job.org)) koji šalje `GET` zahtjev s `Authorization: Bearer $CRON_SECRET` headerom na taj endpoint jednom dnevno.

## 6. Struktura projekta

```
app/
  t/[tenant_slug]/        javna QR prijava kvara
  dashboard/               nadzorna ploča za osoblje (zahtijeva prijavu)
  api/
    triage/submit/         atomarni upis prijave (RPC transakcija)
    telephony/incoming-call/  Vapi.ai webhook
    notifications/          WhatsApp slanje + webhook za ODOBRI/ODBIJ
    cron/parking-check/     dnevni obračun ležarine
components/
  triage/                  QR forma + upload fotografija
  dashboard/               postavke, PIN sef, draft/odobri modal
lib/
  supabase/                browser/server/admin klijenti
  notifications/           WhatsApp integracija, hrvatski predlošci poruka
  validation/               Zod sheme
supabase/
  schema.sql, storage.sql, functions.sql, seed.sql
```
