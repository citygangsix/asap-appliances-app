# Final Launch QA Report

Date: May 16, 2026 local / May 17, 2026 UTC

## Summary

GitHub Pages was rebuilt, verified, committed, and pushed to `gh-pages`.
Public hosted routes load, the hosted Supabase Edge API matches the expected public/private boundary, and the production dashboard now receives the Supabase frontend auth environment.

## Build And Static Routes

- PASS `npm run build:pages:hosted`
- PASS `npm run check:pages-routes`
- PASS `npm run build`
- PASS `npm run check:dashboard-auth`
- PASS `npm run check:supabase-live`
- PASS `deno check supabase/functions/asap-crm/index.ts`
- PASS `dist-pages/CNAME` contains `ASAPACBoss.com`
- PASS `dist-pages/.nojekyll` exists
- PASS legal/static routes exist: `/privacy-policy/`, `/terms-and-conditions/`, `/confirmations/`
- PASS dashboard direct routes exist, including `/dashboard/login/`, `/dashboard/phone/`, `/dashboard/jobs/`, `/dashboard/people/`, `/dashboard/contacts/`

Vite reported the existing dashboard bundle-size warning after minification; the build still completed successfully.

## Publish

- PASS published `dist-pages` to `origin/gh-pages`
- Final published commit: `bf06c9f Deploy website and dashboard`
- PASS GitHub Actions Pages workflow completed successfully after the source push
- PASS follow-up QA-report-only push completed successfully and did not move `origin/gh-pages`
- PASS production Supabase frontend env workflow completed successfully for source commit `5c1860f`
- Hosted domain checked: `https://asapacboss.com/`

## Local Browser QA

Served `dist-pages` locally from `http://127.0.0.1:4180`.

- PASS `/` hydrated with public service request form
- PASS `/privacy-policy/`, `/terms-and-conditions/`, and `/confirmations/` hydrated
- PASS `/dashboard/login/`, `/dashboard/phone/`, `/dashboard/jobs/`, and `/dashboard/settings/` loaded as direct routes
- PASS service request empty-submit validation showed all required field errors
- PASS dashboard/private direct routes failed closed when Supabase frontend auth env was missing
- PASS rebuilt dashboard with Supabase frontend env showed `Dashboard Login` without missing-env warnings

## Hosted Smoke QA

Hosted Pages:

- PASS `https://asapacboss.com/` returned 200 and hydrated
- PASS `https://asapacboss.com/privacy-policy/` returned 200 and hydrated
- PASS `https://asapacboss.com/terms-and-conditions/` returned 200 and hydrated
- PASS `https://asapacboss.com/confirmations/` returned 200 and hydrated
- PASS `https://asapacboss.com/dashboard/login/` returned 200 and hydrated
- PASS `https://asapacboss.com/dashboard/phone/` returned 200 as a direct route
- PASS `https://asapacboss.com/dashboard/jobs/` returned 200 as a direct route
- PASS `https://asapacboss.com/dashboard/login/` showed `Dashboard Login` without `Dashboard Auth Unavailable`
- PASS unauthenticated `https://asapacboss.com/dashboard/phone/` redirected to login without missing-env warnings

Hosted Supabase API:

- PASS `GET /health` returned 200 `{ "ok": true, "status": "ok" }`
- PASS `POST /api/service-requests` with `dryRun: true` returned 200 and did not create a live customer/job
- PASS `GET /api/hiring-candidates` without auth returned 401
- PASS `GET /api/twilio/voice-token` without auth returned 401
- PASS `POST /api/invoices/send-lumia` without auth returned 401

## Dashboard Pages Env

The production GitHub Actions environment now includes:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_DATA_SOURCE=supabase`
- `VITE_LOCAL_OPERATIONS_SERVER_URL=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm`

Setup and recovery steps are documented in `docs/github-pages-environment.md`.

## Remaining Notes

- No active launch blocker remains for missing Supabase frontend env.
- Vite still reports the existing dashboard bundle-size warning during production builds.
- GitHub Actions warns that Node.js 20 actions are deprecated and will need an Actions runtime update later.

If the Pages environment is changed, rerun:

```bash
npm run build:pages:hosted
npm run check:pages-routes
npm run build
npm run check:dashboard-auth
npm run check:supabase-live
```
