# Hosted CRM API

The public site and dashboard can stay on GitHub Pages, but server-backed CRM actions must run on a hosted API. GitHub Pages only serves static files, so the production API lives in Supabase Edge Functions.

## Production URLs

- Website: `https://asapacboss.com/`
- Dashboard default: `https://asapacboss.com/dashboard/` opens the Phone screen for fastest SignalWire access.
- Quickest phone access: `https://asapacboss.com/dashboard/phone`
- Dispatch board: `https://asapacboss.com/dashboard/dispatch-board` remains available from the sidebar/menu.
- Legacy dispatch shortcut: `https://asapacboss.com/dashboard/dispatch` redirects to Phone.
- Hosted CRM API: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm`
- API health check: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/health`

## Production Deploy Runbook

The Supabase project owner or an admin with Edge Function and secret privileges must run the API deploy. Do not commit real secret values. Put server-only secrets in `.env.server.local`, keep browser build values in `.env.local`, and load Supabase secrets from the env file so values are not pasted into shell history.

1. Confirm server/hosted env readiness:

```bash
npm run check:hosted-env
```

2. Load Supabase Edge Function secrets from `.env.server.local`:

```bash
supabase secrets set --env-file .env.server.local
```

At minimum, `.env.server.local` must provide these keys or their documented fallback names:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SIGNALWIRE_PROJECT_ID=...
SIGNALWIRE_API_TOKEN=...
SIGNALWIRE_SPACE_URL=caseless-industries-llc.signalwire.com
SIGNALWIRE_PHONE_NUMBER=+15615769819
SIGNALWIRE_MANAGED_PHONE_NUMBERS=+15615769819
SIGNALWIRE_WEBHOOK_BASE_URL=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
THUMBTACK_WEBHOOK_SECRET=...
TWILIO_API_KEY_SID=...
TWILIO_API_KEY_SECRET=...
TWILIO_TWIML_APP_SID=...
SIGNALWIRE_VOICE_FORWARD_TO=...
SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER=...
```

`SIGNALWIRE_SIGNING_KEY` is strongly recommended when SignalWire sends `X-SignalWire-Signature`. `OPENAI_API_KEY` is optional and only needed for call recording transcription/analysis.

If you need to patch only the public, non-secret hosted values, run:

```bash
supabase secrets set SIGNALWIRE_SPACE_URL=caseless-industries-llc.signalwire.com SIGNALWIRE_PHONE_NUMBER=+15615769819 SIGNALWIRE_MANAGED_PHONE_NUMBERS=+15615769819
supabase secrets set SIGNALWIRE_WEBHOOK_BASE_URL=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
```

3. Prepare and deploy the Supabase Edge Function:

```bash
npm run api:prepare
deno check supabase/functions/asap-crm/index.ts
npm run api:deploy
```

The function is deployed with `--no-verify-jwt` because SignalWire, Thumbtack, and the public service request form need to reach webhook/API routes without a Supabase user JWT. Dashboard-only routes verify Supabase Auth bearer tokens inside the router before running handlers.

4. Build the GitHub Pages artifact against the hosted API. `.env.local` must include `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before this build:

```bash
npm run build:pages:hosted
npm run check:pages-routes
```

5. Publish `dist-pages` to GitHub Pages. Use an existing `gh-pages` worktree if one is already present; otherwise create one outside the app repo:

```bash
git fetch origin gh-pages
git worktree add /tmp/asap-gh-pages gh-pages
rsync -a --delete --exclude .git dist-pages/ /tmp/asap-gh-pages/
cd /tmp/asap-gh-pages
git status --short
git add -A
git commit -m "Deploy ASAP Appliances production site"
git push origin gh-pages
```

Do not run the final `git push` until the publish diff has been reviewed.

## Dashboard API Auth

Dashboard-only API routes require a real Supabase Auth session. The React dashboard signs in with Supabase Auth and sends the current user access token on protected API calls:

```text
Authorization: Bearer <supabase-user-access-token>
```

The server verifies the bearer token with Supabase Auth using server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If those server values are missing, protected routes return `503`. If the request has no bearer token, protected routes return `401`. If the token is invalid or expired, protected routes return `403`.

Protected dashboard API routes:

- `POST /api/invoices/send-lumia`
- `POST /api/dispatch/notify-eta`
- `POST /api/workflows/dispatch`
- `POST /api/workflows/generate-invoice`
- `POST /api/workflows/invoice-paid`
- `POST /api/workflows/final-work`
- `POST /api/twilio/outbound/calls`
- `GET /api/twilio/outbound/calls/active`
- `POST /api/twilio/outbound/messages`
- `POST /api/twilio/browser-call`
- `POST /api/twilio/hangup`
- `GET /api/twilio/voice-token`
- `GET /api/hiring-candidates`
- `POST /api/manual/calls/log`

Provider callback routes are not gated by dashboard user sessions because SignalWire, Twilio, and Thumbtack must be able to call them directly. They stay protected by their own signature or secret validation:

- SignalWire/Twilio webhooks: `X-Twilio-Signature` or `X-SignalWire-Signature`
- Thumbtack lead bridge: `THUMBTACK_WEBHOOK_SECRET`

Create dashboard users in Supabase Authentication. See `docs/dashboard-auth.md` for the first-user setup checklist.

Keep these human destination secrets pointed at phones the office can actually answer. Do not set `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER` or `TWILIO_CLICK_TO_CALL_AGENT_NUMBER` to the SignalWire business caller ID; outbound click-to-call first rings this human destination, then bridges the customer from `+15615769819`.

- `SIGNALWIRE_VOICE_FORWARD_TO`
- `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER`
- `TWILIO_VOICE_FORWARD_TO`
- `TWILIO_CLICK_TO_CALL_AGENT_NUMBER`
- `ASSISTANT_OFFICE_PHONE_NUMBER`
- `LUMIA_INVOICE_SMS_PHONE_NUMBER`

## Hosted Verification

Run these checks after deploying or when you suspect hosted source is stale:

```bash
export HOSTED_API="https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm"

curl -sS "$HOSTED_API/health"

curl -i -X OPTIONS "$HOSTED_API/api/twilio/sms" \
  -H "Origin: https://asapacboss.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-SignalWire-Signature, Content-Type"

curl -i -X OPTIONS "$HOSTED_API/api/hiring-candidates" \
  -H "Origin: https://asapacboss.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type"

curl -i "$HOSTED_API/api/hiring-candidates"
curl -i "$HOSTED_API/api/twilio/voice-token"
```

Expected results:

- `GET /health` returns HTTP `200` and `{"ok":true,"status":"ok"}`.
- `OPTIONS` returns HTTP `204`.
- `Access-Control-Allow-Headers` includes `Authorization`, `X-SignalWire-Signature`, `X-Twilio-Signature`, `X-Thumbtack-Secret`, and `X-ASAP-Webhook-Secret`.
- Dashboard-only requests without `Authorization: Bearer <supabase-user-access-token>` return `401` when server Supabase auth env is configured. They return `503` if the hosted Supabase auth env is missing.

If local source includes `X-SignalWire-Signature` or hosted OPTIONS does not allow `Authorization`, the deployed Edge Function is stale. If dashboard-only hosted routes return live data or a browser voice token without auth, the deployed Edge Function is also stale and must be redeployed immediately. Run:

```bash
npm run api:prepare
npm run api:deploy
```

Safe dry-run examples for Thumbtack, invoice notifications, dispatch ETA, and workflow routes are in `docs/twilio-webhooks.md`. Dashboard-only dry-run routes require a Supabase Auth bearer token; Thumbtack uses `THUMBTACK_WEBHOOK_SECRET`.

## Publish Dashboard Against Hosted API

After the Edge Function health check passes, publish the static site with the hosted API URL embedded:

```bash
npm run build:pages:hosted
```

Before publishing, confirm `.env.local` includes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then copy `dist-pages` into the `gh-pages` worktree and push the live publish commit.

## Public Service Request Route

The public homepage posts service request forms to:

```text
POST /api/service-requests
```

This route is public by design, validates required customer fields server-side, requires SMS consent, and creates or updates a customer plus a new unassigned job using server-side Supabase service-role credentials. It does not require or expose the dashboard API secret. Local development can send `dryRun: true` or set `VITE_PUBLIC_SERVICE_REQUEST_DRY_RUN=true` so the route validates and returns a reference without creating live rows.

Required JSON fields:

- `name`
- `phone`
- `serviceAddress`
- `applianceType`
- `issueSummary`
- `preferredTiming`
- `smsConsent: true`

Optional public frontend env:

- `VITE_PUBLIC_SERVICE_REQUEST_API_URL` for a non-default API base URL. This is not a secret.
- `VITE_PUBLIC_SERVICE_REQUEST_DRY_RUN=true` for local or staging dry-run form checks.

## SignalWire Console

For the phone number `+15615769819`, update SignalWire webhook URLs from the old ngrok host to:

- Incoming SMS webhook: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/sms` using HTTP POST
- Incoming voice webhook: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/voice` using HTTP POST
- Incoming voice call status callback: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/calls/status` using HTTP POST

Browser calling and click-to-call generate their own callback URLs from `SIGNALWIRE_WEBHOOK_BASE_URL` or `TWILIO_WEBHOOK_BASE_URL`, so they will use the hosted API after the secret is updated:

- Recording status callback generated in TwiML: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/recordings/status`
- Outbound click-to-call status callback generated by the server: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/outbound/calls/status`
- Browser call status callback if browser calling is enabled: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/browser-call/status`
- Browser TwiML App voice request URL if browser calling is enabled: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/browser-call/twiml`

Outbound SMS status callbacks are not currently configured by the CRM's provider Messages API call.

See `docs/signalwire-crm.md` for the SignalWire-specific environment and webhook checklist.
