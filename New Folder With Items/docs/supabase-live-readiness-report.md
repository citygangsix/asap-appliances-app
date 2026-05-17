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

Real hosted write smoke passed against the production Supabase project:

- Command: `npm run smoke:supabase-live-writes`
- Run ID: `codex-live-20260517035408920-76c01d4e`
- Project URL: `https://nexkymqahpkvzzlvivfi.supabase.co`
- Hosted API: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm`
- Credential source: logged-in Supabase CLI service-role lookup.
- Public service request wrote a live `customers` row and `jobs` row through the hosted Edge Function: HTTP 201.
- Live follow-up writes succeeded for `invoices`, `communications` call log, `communications` SMS log, `outbound_contact_attempts`, `job_timeline_events`, and `hiring_candidates`.
- Live reads found each inserted row with the expected foreign-key links and schema values.
- Cleanup deleted and re-queried every temporary row: 1 outbound contact attempt, 1 hiring candidate, 1 timeline event, 2 communications, 1 invoice, 1 job, and 1 customer. `allDeleted: true`.

Required env/credential inputs for rerunning live write smoke are:

- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`
- Or a logged-in Supabase CLI that can read API keys for `SUPABASE_PROJECT_REF=nexkymqahpkvzzlvivfi`
- Optional override: `ASAP_HOSTED_API_URL` or `VITE_LOCAL_OPERATIONS_SERVER_URL`
- Frontend/live dashboard checks still require `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_DATA_SOURCE=supabase`, and production should omit `VITE_SUPABASE_ALLOW_MOCK_FALLBACK` or set it to `false`.

Run these after filling local/server credentials:

```bash
npm run check:supabase-live
npm run check:server-env
VITE_APP_DATA_SOURCE=supabase VITE_SUPABASE_ALLOW_MOCK_FALLBACK=false npm run build
npm run smoke:supabase-live-writes
```

For hosted API changes, refresh the Edge mirror and deploy:

```bash
npm run api:prepare
npm run api:deploy
```
