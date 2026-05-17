# Supabase Live CRM Readiness

Date: 2026-05-17

## Result

Live mode is now explicit and testable:

- `VITE_APP_DATA_SOURCE=mock` remains the safe local default.
- `VITE_APP_DATA_SOURCE=supabase` enables Supabase-backed CRM reads/writes.
- `VITE_SUPABASE_ALLOW_MOCK_FALLBACK=true` keeps local/dev fallback behavior available.
- Production Supabase mode is strict by default, so missing credentials or read failures no longer silently render mock CRM data.

## Verified Contract

`npm run check:supabase-live` verifies the local migration contract for these CRM-critical tables:

- `customers`
- `technicians`
- `jobs`
- `invoices`
- `communications`
- `unmatched_inbound_communications`
- `hiring_candidates`
- `technician_payouts`
- `technician_payout_invoice_links`
- `twilio_voice_recordings`
- `outbound_contact_attempts`
- `job_timeline_events`

It also verifies the extended `job_lifecycle_status` values used by the CRM and checks that strict live-mode guards are present.

## Verified Routes And Write Paths

Static verification covers these CRM-critical live paths:

- Dashboard repository reads for Home, Jobs, Customers, Dispatch, Communications, Invoices, Revenue, Technicians, hiring candidates, and technician payouts.
- Dashboard repository writes for customers, jobs, job workflow, communications, unmatched inbound resolution, invoices, job timeline events, and technician payouts.
- Server API writes for public service requests (`customers` + `jobs`), manual customer call logs (`communications`), manual hiring call logs (`hiring_candidates`), voice/SMS webhooks, recording callbacks, outbound contact attempts, and hiring candidate listing.

## Hiring Candidate Fix

Manual hiring call logs now write the full current `hiring_candidates` payload directly. The stale mock/schema-compatibility helper call was removed, so manual hiring outreach no longer fails before reaching Supabase.

## Live Smoke Status

Local static verification passed. No local migration/schema gaps were found for the CRM-critical tables above.

Hosted non-destructive smoke checks passed:

- `GET /health`: 200, `{ ok: true, status: "ok" }`
- `POST /api/service-requests` with `dryRun: true`: 200, no customer/job created.
- `GET /api/hiring-candidates` without auth: 401, `Supabase dashboard session is required.`
- `GET /api/twilio/voice-token` without auth: 401, `Supabase dashboard session is required.`

Real hosted write smoke tests were not run from this workspace because `.env.local` and `.env.server.local` are missing. The blocked local env names are:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`
- `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
- `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- `SIGNALWIRE_PHONE_NUMBER` or `TWILIO_PHONE_NUMBER`
- `SIGNALWIRE_WEBHOOK_BASE_URL` or `TWILIO_WEBHOOK_BASE_URL`
- One answerable human destination for click-to-call and voice forwarding, using the documented `SIGNALWIRE_*`, `TWILIO_*`, `ASSISTANT_OFFICE_PHONE_NUMBER`, or `LUMIA_INVOICE_SMS_PHONE_NUMBER` keys.

Run these after filling local/server credentials:

```bash
npm run check:supabase-live
npm run check:server-env
VITE_APP_DATA_SOURCE=supabase VITE_SUPABASE_ALLOW_MOCK_FALLBACK=false npm run build
```

For hosted API changes, refresh the Edge mirror and deploy:

```bash
npm run api:prepare
npm run api:deploy
```
