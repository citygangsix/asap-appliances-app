# Final Launch QA Report

Date: May 16, 2026 local / May 17, 2026 UTC

## Summary

GitHub Pages was rebuilt, verified, committed, and pushed to `gh-pages`.
Public hosted routes load and the hosted Supabase Edge API matches the expected public/private boundary.

The remaining launch blocker is dashboard auth configuration in the published Pages build: the live dashboard fails closed with `Dashboard Auth Unavailable` because the build environment did not include `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

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
- Final published commit: `04fc143 Deploy website and dashboard`
- PASS GitHub Actions Pages workflow completed successfully for source commit `f92fa36`
- Hosted domain checked: `https://asapacboss.com/`

## Local Browser QA

Served `dist-pages` locally from `http://127.0.0.1:4180`.

- PASS `/` hydrated with public service request form
- PASS `/privacy-policy/`, `/terms-and-conditions/`, and `/confirmations/` hydrated
- PASS `/dashboard/login/`, `/dashboard/phone/`, `/dashboard/jobs/`, and `/dashboard/settings/` loaded as direct routes
- PASS service request empty-submit validation showed all required field errors
- PASS dashboard/private direct routes failed closed when Supabase frontend auth env was missing

## Hosted Smoke QA

Hosted Pages:

- PASS `https://asapacboss.com/` returned 200 and hydrated
- PASS `https://asapacboss.com/privacy-policy/` returned 200 and hydrated
- PASS `https://asapacboss.com/terms-and-conditions/` returned 200 and hydrated
- PASS `https://asapacboss.com/confirmations/` returned 200 and hydrated
- PASS `https://asapacboss.com/dashboard/login/` returned 200 and hydrated
- PASS `https://asapacboss.com/dashboard/phone/` returned 200 as a direct route
- PASS `https://asapacboss.com/dashboard/jobs/` returned 200 as a direct route

Hosted Supabase API:

- PASS `GET /health` returned 200 `{ "ok": true, "status": "ok" }`
- PASS `POST /api/service-requests` with `dryRun: true` returned 200 and did not create a live customer/job
- PASS `GET /api/hiring-candidates` without auth returned 401
- PASS `GET /api/twilio/voice-token` without auth returned 401
- PASS `POST /api/invoices/send-lumia` without auth returned 401

## Blockers

1. Dashboard login cannot complete on the published Pages build until the build environment includes:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. For live CRM production mode, publish with:
   - `VITE_APP_DATA_SOURCE=supabase`
   - `VITE_LOCAL_OPERATIONS_SERVER_URL=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm`

After setting those values locally or in GitHub Actions variables/secrets, rerun:

```bash
npm run build:pages:hosted
npm run check:pages-routes
rsync -a --delete --exclude .git dist-pages/ /tmp/asap-gh-pages/
git -C /tmp/asap-gh-pages add -A
git -C /tmp/asap-gh-pages commit -m "Deploy ASAP Appliances production dashboard auth"
git -C /tmp/asap-gh-pages push origin gh-pages
```
