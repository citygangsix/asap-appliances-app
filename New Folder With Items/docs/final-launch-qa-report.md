# Final Launch QA Report

Date: May 17, 2026, America/New_York

## Summary

Final production QA was completed against the GitHub Pages site and hosted Supabase Edge API.

Status: partially live.

The public site, legal pages, hosted dashboard shell, real Supabase Auth login, protected dashboard routes, hosted public service request route, hosted private API boundary, and Supabase live CRM checks are live and passing. External provider integrations are verified through safe dry-run routes and rejection/security checks, but the live provider success paths still need local secret values or an approved live test destination before non-dry-run call/SMS and valid third-party webhook success tests can be completed.

## Build And Static Routes

- PASS `npm run build`
- PASS `npm run build:pages:hosted`
- PASS `npm run check:pages-routes`
- PASS `npm run check:dashboard-auth`
- PASS `npm run check:supabase-live`
- PASS `deno check supabase/functions/asap-crm/index.ts`
- PASS `dist-pages/CNAME` contains `ASAPACBoss.com`
- PASS `dist-pages/.nojekyll` exists
- PASS legal/static routes exist: `/privacy-policy/`, `/terms-and-conditions/`, `/confirmations/`
- PASS dashboard direct routes exist, including `/dashboard/login/`, `/dashboard/phone/`, `/dashboard/jobs/`, `/dashboard/people/`, `/dashboard/contacts/`

Vite still reports the existing dashboard bundle-size warning after minification. The production builds complete successfully.

## Hosted Browser QA

Hosted domain checked: `https://asapacboss.com/`

- PASS public homepage rendered with the ASAP Appliance service request experience.
- PASS public service request form rendered with name, phone, service address, appliance type, preferred timing, issue summary, SMS consent, and submit controls.
- PASS `https://asapacboss.com/dashboard/login/` rendered the real Supabase Auth dashboard login.
- PASS a temporary Supabase Auth dashboard user signed in on the hosted dashboard.
- PASS authenticated dashboard redirected to `/dashboard/phone` and rendered `Protected dashboard`, `Supabase live`, phone controls, and live people rows.
- PASS direct hosted reload of `/dashboard/jobs/` loaded the dashboard app and rendered the protected jobs route.
- PASS the temporary dashboard QA user was deleted after the authenticated smoke test.

## Hosted Pages And API Smoke

Hosted Pages:

- PASS `GET /` returned 200 and included `Appliance Repair Service`.
- PASS `GET /privacy-policy/` returned 200 and included `Privacy Policy`.
- PASS `GET /terms-and-conditions/` returned 200 and included `Terms and Conditions`.
- PASS `GET /confirmations/` returned 200 and included `SMS opt-in`.
- PASS `GET /dashboard/login/` returned 200 and served the dashboard root.
- PASS `GET /dashboard/phone/` returned 200 as a direct dashboard route.
- PASS `GET /dashboard/jobs/` returned 200 as a direct dashboard route.

Hosted Supabase API:

- PASS `GET /health` returned 200 with `{ "ok": true, "status": "ok" }`.
- PASS `POST /api/service-requests` with `dryRun: true` returned 200, echoed the lead, and did not create a customer or job.
- PASS `GET /api/hiring-candidates` without auth returned 401 with `Supabase dashboard session is required.`
- PASS `GET /api/twilio/voice-token` without auth returned 401 with `Supabase dashboard session is required.`
- PASS `GET /api/hiring-candidates` with a real temporary Supabase access token returned 200, `ok: true`, and live candidate data.

## Supabase Live Mode

- PASS `npm run check:supabase-live` verified the CRM migration/table expectations and job lifecycle statuses.
- PASS previous safe live write smoke `npm run smoke:supabase-live-writes` verified temporary service request, customer, job, invoice, communication log, outbound contact attempt, job timeline, and hiring candidate writes with cleanup.
- PASS production/live mode remains configured to use Supabase rather than silently falling back to mocks unless `VITE_SUPABASE_ALLOW_MOCK_FALLBACK=true` is explicitly set.

Detailed schema and live-write evidence is maintained in `docs/supabase-live-readiness-report.md`.

## External Integrations

PASS `npm run smoke:external-integrations` against the hosted API.

Verified:

- PASS browser calling token/session route returned 200 with a token, identity, expiry, and TwiML app SID.
- PASS outbound call dry-run returned 200 and prepared agent/business phone values, bridge URL, status callback URL, recording callback URL, and bridge TwiML.
- PASS outbound SMS dry-run returned 200 and accepted the approved test payload shape.
- PASS invoice notification dry-run returned 200 and prepared the assistant/customer notification preferences.
- PASS unauthenticated private provider/dashboard routes returned 401.
- PASS invalid dashboard bearer token returned 403.
- PASS SignalWire/Twilio recording, browser TwiML, and SMS callbacks with mismatched account IDs returned 403.
- PASS Thumbtack/LeadWinner without a secret returned 401.
- PASS Thumbtack/LeadWinner with an invalid secret returned 403.
- PASS temporary dashboard smoke user cleanup completed.

Remaining exact provider blockers:

- BLOCKED Thumbtack/LeadWinner valid provider payload dry-run: local `THUMBTACK_WEBHOOK_SECRET` value is not available. The hosted secret name is configured, but Supabase does not reveal secret values.
- BLOCKED valid SignalWire/Twilio webhook signature success path: local `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID` value and local `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN` value are not available. The hosted secret names are configured, but valid signature generation needs the secret values locally.
- BLOCKED live non-dry-run outbound call/SMS: requires `ASAP_EXTERNAL_SMOKE_TEST_PHONE` set to an approved E.164 test number plus explicit approval to run with `dryRun: false`.

Provider setup, commands, and payload examples are documented in `docs/external-integration-verification.md`, `docs/twilio-webhooks.md`, and `docs/leadwinner-thumbtack-setup.md`.

## Production Status

- Public GitHub Pages site: live.
- Public service request flow: live; hosted dry-run route verified, non-dry-run writes covered by Supabase live smoke.
- Legal pages: live.
- Dashboard shell and direct routes: live.
- Real Supabase Auth dashboard login/logout/session flow: live; hosted login verified with a temporary Supabase user.
- Hosted private API boundary: live; anonymous requests reject and authenticated Supabase bearer access succeeds.
- Supabase live CRM mode: live for the verified CRM-critical paths.
- External integrations: partially live; safe hosted dry-runs and security checks pass, while valid provider signature success and live non-dry-run sends remain blocked by the exact local secret/test-destination requirements above.

## Rerun Commands

```bash
npm run build
npm run build:pages:hosted
npm run check:pages-routes
npm run check:dashboard-auth
npm run check:supabase-live
deno check supabase/functions/asap-crm/index.ts
npm run smoke:external-integrations
```
