# SignalWire / Twilio-Compatible Webhook Intake

ASAP's current voice/SMS provider is SignalWire. The code still keeps `/api/twilio/*`
route names because SignalWire's Compatibility API uses Twilio-style webhook payloads,
signatures, and TwiML/CXML. Prefer `SIGNALWIRE_*` env names for new setup; the
older `TWILIO_*` names remain supported as fallback aliases where the code already
uses Twilio-compatible helpers.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create local env files from the examples:

```bash
cp .env.local.example .env.local
cp .env.server.example .env.server.local
```

3. Fill in the env vars listed in `Required Frontend Env` and `Required Server Env`.
4. Apply the Supabase migration `supabase/migrations/20260420120004_twilio_voice_recordings.sql` before expecting recording callbacks to persist successfully.
5. Start the frontend:

```bash
npm run dev
```

6. Start the local webhook server in a second terminal:

```bash
npm run signalwire:webhooks
```

7. Run the smoke test on a fresh port so it does not reuse an older local process:

```bash
SIGNALWIRE_WEBHOOK_PORT=8788 npm run signalwire:webhooks:smoke
```

8. In SignalWire Console, set the inbound voice webhook to:

```text
<SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/voice
```

9. In the app, open `Customers`, select a customer, and click the provider call action in the `Primary contact` card.

## Required Frontend Env

Create `.env.local` in the app root and set:

- `VITE_APP_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## Required Server Env

Create `.env.server.local` in the app root and set:

- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SIGNALWIRE_SPACE_URL=caseless-industries-llc.signalwire.com`
- `SIGNALWIRE_PROJECT_ID=...`
- `SIGNALWIRE_API_TOKEN=...`
- `SIGNALWIRE_SIGNING_KEY=...` (recommended if SignalWire sends `X-SignalWire-Signature`)
- `SIGNALWIRE_PHONE_NUMBER=+15615769819` (active ASAP CRM SignalWire business line, default outbound caller ID, and primary inbound webhook destination)
- `SIGNALWIRE_MANAGED_PHONE_NUMBERS=+15615769819` (comma-separated list of SignalWire business lines the webhook server should accept as yours)
- `SIGNALWIRE_VOICE_FORWARD_TO=...` (recommended for inbound voice forwarding)
- `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER=...` (optional override for outbound click-to-call; otherwise the server falls back to `ASSISTANT_OFFICE_PHONE_NUMBER`)
- `THUMBTACK_ASSISTANT_PHONE_NUMBER=...` (optional override for Thumbtack lead calls; set this to Lamia's Vodafone number if you only want Thumbtack leads to ring her first)
- `THUMBTACK_WEBHOOK_SECRET=...` (required for `POST /api/thumbtack/lead`)
- `TWILIO_CLICK_TO_CALL_AUTO_COOLDOWN_HOURS=24` (optional; blocks automated re-calls to the same customer during the cooldown window)
- `TWILIO_CLICK_TO_CALL_MISSED_SMS_DELAY_SECONDS=120` (optional; delay before the missed-call follow-up SMS is sent)
- `TWILIO_CLICK_TO_CALL_MISSED_SMS_BODY=...` (optional; supports `{{customerName}}`)
- `ASSISTANT_OFFICE_PHONE_NUMBER=...` (optional but recommended for office invoice notifications)
- `LUMIA_INVOICE_SMS_PHONE_NUMBER=...`
- `WORKFLOW_DISPATCH_HEADS_UP_MINUTES=60` (optional)
- `WORKFLOW_FINAL_ALERT_LEAD_MINUTES=10` (optional)
- `WORKFLOW_PAYMENT_FOLLOWUP_MINUTES=8` (optional)
- `WORKFLOW_LABOR_INVOICE_AMOUNT=150` (optional)
- `SIGNALWIRE_WEBHOOK_BASE_URL=...`
- `SIGNALWIRE_WEBHOOK_PORT=8787` (optional)

The webhook server reads `SUPABASE_URL` from `.env.server.local`. If that is unset, it falls back to `VITE_SUPABASE_URL` from `.env.local`.

Start from `.env.server.example` to avoid missing keys. The legacy
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
`TWILIO_MANAGED_PHONE_NUMBERS`, `TWILIO_WEBHOOK_BASE_URL`, and related names are
still accepted as fallbacks, but new SignalWire setup should use the `SIGNALWIRE_*`
names above.

Before running a smoke test, get a no-secrets checklist:

```bash
npm run check:server-env
```

For full hosted readiness, including Thumbtack and browser calling:

```bash
npm run check:hosted-env
```

For hosted live-safe route verification without placing real calls or texts:

```bash
npm run smoke:external-integrations
```

That hosted smoke creates a temporary Supabase Auth dashboard user, runs browser-token, outbound-call, outbound-SMS, invoice-notification, provider-callback boundary, and Thumbtack boundary checks, then deletes the temporary user. Valid signed provider callbacks and valid Thumbtack payloads still require the local secret values documented in `docs/external-integration-verification.md`.

## Dashboard Route Auth

The React dashboard uses Supabase Auth email/password sessions:

- `/dashboard/login` is public and shows the dashboard login form.
- `/dashboard/*` routes are wrapped by `ProtectedRoute`.
- Logged-out users who open `/dashboard/phone`, `/dashboard/home`, or any other dashboard page are redirected to `/dashboard/login`.
- Logout signs out of Supabase Auth and sends the user back to `/dashboard/login`.
- Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` shows a dashboard auth configuration error instead of opening the dashboard.

Dashboard-origin API routes require `Authorization: Bearer <supabase-user-access-token>`. The frontend adds the current Supabase Auth session token to private API requests.

Protected dashboard API routes include invoice SMS/call notifications, dispatch workflow routes, manual outbound calls/SMS, active-call listing, browser call/hangup, browser voice-token creation, hiring candidates, and manual call logging. SignalWire/Twilio provider callbacks and Thumbtack lead callbacks are intentionally not protected by dashboard user sessions; they keep their signature or webhook-secret checks.

Create dashboard users in Supabase Authentication. See `docs/dashboard-auth.md` for first-user setup.

## Local Development

1. Run the app normally with `npm run dev`.
2. Run the webhook server with `npm run signalwire:webhooks`.
3. Expose the webhook server publicly with your tunnel of choice.
4. Set `SIGNALWIRE_WEBHOOK_BASE_URL` to that public base URL.
5. In the SignalWire console, point:
   - inbound messaging webhook to `POST /api/twilio/sms`
   - inbound voice webhook to `POST /api/twilio/voice`
   - voice status callback webhook to `POST /api/twilio/calls/status` if you still want the existing inbound call event log

The app can also initiate outbound click-to-call requests against the local server route `POST /api/twilio/outbound/calls`; this route now requires the dashboard API secret header.
Thumbtack or any intermediary automation can post new leads to `POST /api/thumbtack/lead`.

## SignalWire Console Setup

Use `SIGNALWIRE_WEBHOOK_BASE_URL` as the public base URL. With the current route structure:

- SignalWire Console inbound messaging webhook:
  - `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/sms`
- SignalWire Console inbound voice webhook:
  - `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/voice`
- Separate inbound call-status callback:
  - optional
  - only needed if you want inbound call event logging in `communications`
  - `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/calls/status`
- Outbound click-to-call route:
  - not entered in SignalWire Console
  - the app calls `POST /api/twilio/outbound/calls` on the local server directly
- Thumbtack lead route:
  - not entered in SignalWire Console
  - your Thumbtack automation, iPhone shortcut, Zapier scenario, or other integration posts to `POST /api/thumbtack/lead`
- Routes the provider will hit during outbound click-to-call:
  - `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/outbound/bridge`
  - `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/outbound/calls/status`
  - `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/recordings/status`
- Number called first during outbound click-to-call:
  - `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER`
  - if unset, `ASSISTANT_OFFICE_PHONE_NUMBER`
  - if that is unset, `SIGNALWIRE_VOICE_FORWARD_TO`
  - this must be an answerable office or staff phone, not the SignalWire business caller ID `+15615769819`

For the hosted ASAPACboss.com API, use these exact URLs on the SignalWire phone number `+15615769819`:

- Incoming SMS: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/sms`
- Incoming voice calls: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/voice`
- Incoming voice call status callback: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/calls/status`
- Recording status callbacks generated in TwiML: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/recordings/status`
- Outbound click-to-call status callbacks generated by the server: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/outbound/calls/status`
- Browser call status callback if browser calling is enabled: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/browser-call/status`
- Browser TwiML App voice request URL if browser calling is enabled: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/browser-call/twiml`

Outbound SMS status callbacks are not currently configured by the CRM's provider Messages API call.

## Local Smoke Test

Run:

```bash
export SUPABASE_AUTH_ACCESS_TOKEN=<current-dashboard-user-access-token>
npm run signalwire:webhooks:smoke
```

`ASAP_DASHBOARD_AUTH_BEARER_TOKEN` is accepted as an alias for `SUPABASE_AUTH_ACCESS_TOKEN`.

What it does:

- first runs the same missing-env checklist as `npm run check:server-env`
- reuses a healthy local webhook server if one is already running, otherwise starts a temporary local server on `SIGNALWIRE_WEBHOOK_PORT` or `TWILIO_WEBHOOK_PORT`
- checks `GET /health`
- sends one dashboard-authenticated click-to-call dry run, one signed click-to-call bridge webhook, one Twilio-style signed SMS callback, one signed inbound voice webhook, one signed call-status callback, and one safe recording-callback request to the local server
- uses an intentionally wrong `To` number for the SMS and call-status checks so both signed requests are accepted but ignored before any Supabase write path runs
- uses a mismatched `AccountSid` for the recording callback check so the route is verified without creating a recording row
- sends one invalid-signature request and expects a `403`

This gives you a repeatable local check for server health, signature validation, and route wiring without creating live `communications` or `unmatched_inbound_communications` rows.

If required env is missing, the command exits before starting the server and prints the
missing variable names only, never secret values.

For the current external integration verification matrix, hosted route-boundary evidence, and copy/paste dry-run payloads, see `docs/external-integration-verification.md`.

## Assistant Invoice Notifications

- After a live invoice is created from the CRM invoice flow, the frontend calls the local server route `POST /api/invoices/send-lumia`.
- The server uses `ASSISTANT_OFFICE_PHONE_NUMBER` and falls back to `LUMIA_INVOICE_SMS_PHONE_NUMBER` if the assistant key is not set.
- The server sends both an outbound SMS summary and a short voice call that tells the office the technician is finished and the invoice was just texted over.
- If the invoice flow already has a hosted invoice URL in the future, the server can send that URL. Today it sends a concise summary with the invoice identifier, customer name, total amount, and amount due.
- For safe validation without sending a real SMS or call, post `{"invoice": {...}, "dryRun": true}` to `POST /api/invoices/send-lumia`.

Safe dry run:

```bash
export ASAP_API_BASE="http://127.0.0.1:8787"

curl -sS -X POST "$ASAP_API_BASE/api/invoices/send-lumia" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -d '{"dryRun":true,"notifyAssistant":{"sms":true,"call":true},"notifyCustomer":{"sms":false,"call":false},"invoice":{"invoiceNumber":"DRY-RUN-001","customerName":"Dry Run Customer","customerPhone":"+15551234567","totalAmount":150,"outstandingBalance":150,"invoiceUrl":"https://example.com/invoices/DRY-RUN-001"}}'
```

## Dispatch ETA Notifications

- The Dispatch page now includes an `ETA notifications` panel that saves the ETA text update through the live repository path and then posts to `POST /api/dispatch/notify-eta`.
- The server resolves the selected job, customer phone, and technician phone from Supabase, then sends the requested mix of text and voice notifications.
- For safe validation without placing real calls or texts, post `dryRun: true` to `POST /api/dispatch/notify-eta`.
- This route still loads the selected job from Supabase during dry run, so use an existing `jobId`.

Safe dry run:

```bash
curl -sS -X POST "$ASAP_API_BASE/api/dispatch/notify-eta" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -d '{"dryRun":true,"jobId":"<existing-job-id>","etaWindowText":"Arriving in 20 minutes","notifyTechnician":{"sms":true,"call":false},"notifyCustomer":{"sms":true,"call":true}}'
```

## Workflow Automation

- `POST /api/workflows/dispatch`
  - reuses the current job and ETA context
  - sends technician notifications immediately
  - can schedule the customer heads-up based on `etaAt` and `customerLeadMinutes`
- `POST /api/workflows/generate-invoice`
  - creates a workflow invoice for diagnosis or parts approval
  - notifies the assistant and customer
- `POST /api/workflows/invoice-paid`
  - sends paid-in-full confirmation to the customer
- `POST /api/workflows/final-work`
  - alerts the assistant about the final 10-minute window
  - creates the labor invoice
  - notifies the assistant and customer
  - schedules an assistant follow-up if the invoice is still unpaid after the configured follow-up window

Workflow dry runs never insert invoices, schedule durable tasks, or place calls/SMS, but they do load referenced jobs or invoices from Supabase. Use existing IDs:

```bash
curl -sS -X POST "$ASAP_API_BASE/api/workflows/dispatch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -d '{"dryRun":true,"jobId":"<existing-job-id>","etaWindowText":"Arriving in 45 minutes","notifyTechnician":{"sms":true,"call":false},"notifyCustomer":{"sms":true,"call":false},"customerLeadMinutes":60}'

curl -sS -X POST "$ASAP_API_BASE/api/workflows/generate-invoice" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -d '{"dryRun":true,"jobId":"<existing-job-id>","invoiceNumber":"DRY-RUN-INV-001","invoiceType":"parts_deposit","paymentStatus":"parts_due","totalAmount":150,"outstandingBalance":150,"notifyAssistant":{"sms":true,"call":false},"notifyCustomer":{"sms":false,"call":false}}'

curl -sS -X POST "$ASAP_API_BASE/api/workflows/invoice-paid" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -d '{"dryRun":true,"invoiceId":"<existing-invoice-id>"}'

curl -sS -X POST "$ASAP_API_BASE/api/workflows/final-work" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -d '{"dryRun":true,"jobId":"<existing-job-id>","laborAmount":150,"leadMinutes":10,"paymentFollowupMinutes":8}'
```

## Tunnel Rotation Checklist

If your tunnel URL changes in a later session:

1. Update `SIGNALWIRE_WEBHOOK_BASE_URL` in `.env.server.local`.
2. Restart the local webhook server so it reloads the updated env.
3. Update the SignalWire console messaging webhook to `<new-base-url>/api/twilio/sms`.
4. Update the SignalWire console inbound voice webhook to `<new-base-url>/api/twilio/voice`.
5. Update the SignalWire console voice status callback to `<new-base-url>/api/twilio/calls/status` if you use it.
6. The server-generated recording callback will post to `<new-base-url>/api/twilio/recordings/status`.
7. Run `npm run signalwire:webhooks:smoke` to confirm the local server still accepts valid signatures and rejects invalid ones.

## Recorded Call Behavior

- Inbound calls:
  - SignalWire hits `POST /api/twilio/voice`
  - the server forwards the caller to `SIGNALWIRE_VOICE_FORWARD_TO`
  - the bridged call is recorded from answer with dual-channel Dial recording
  - recording callbacks post to `POST /api/twilio/recordings/status`

- Outbound click-to-call:
  - the app hits `POST /api/twilio/outbound/calls`
  - the server tells SignalWire to call the agent number first
  - after the agent answers, SignalWire fetches `POST /api/twilio/outbound/bridge`
  - that bridge TwiML dials the customer and records the bridged call from answer
  - recording callbacks reuse `POST /api/twilio/recordings/status`
  - only one live customer call is attempted per trigger
- if the customer does not answer, the server waits `TWILIO_CLICK_TO_CALL_MISSED_SMS_DELAY_SECONDS` and then sends one polite SMS follow-up from the business number
- no automatic rapid retry calling is performed
- automated triggers respect customer opt-outs and a 24-hour auto-call cooldown by default

## Managed Number Notes

- The active ASAP CRM SignalWire business line is `+15615769819`.
- Set `SIGNALWIRE_PHONE_NUMBER=+15615769819` and `SIGNALWIRE_MANAGED_PHONE_NUMBERS=+15615769819` for the hosted CRM.
- If you later want the CRM to accept multiple business lines at once, keep `+15615769819` in `SIGNALWIRE_PHONE_NUMBER` and add every other owned line to `SIGNALWIRE_MANAGED_PHONE_NUMBERS`.
- Outbound click-to-call can optionally pass a `businessPhoneNumber` field when you want a specific managed line to be used as the caller ID.

## Thumbtack Lead Trigger

- Route:
  - `POST /api/thumbtack/lead`
- Auth:
  - send `Authorization: Bearer <THUMBTACK_WEBHOOK_SECRET>`
  - or `x-thumbtack-secret: <THUMBTACK_WEBHOOK_SECRET>`
  - or `{"webhookSecret":"<THUMBTACK_WEBHOOK_SECRET>"}` in the JSON body
- Supported lead fields:
  - `customerName`
  - `customerPhone`
  - `phone`
  - `contactPhone`
  - `customer.phone`
  - plus related `name` and `leadId` variants
- Behavior:
  - the server normalizes the customer phone number
  - calls `THUMBTACK_ASSISTANT_PHONE_NUMBER` first when set, otherwise falls back to `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER`
  - only after Lamia answers does SignalWire dial the customer
  - the customer only sees `SIGNALWIRE_PHONE_NUMBER`, not Lamia's Egypt Vodafone number
  - the trigger is treated as automated, so opt-out and cooldown protections still apply

Example. For local testing, set `ASAP_API_BASE=http://127.0.0.1:8787`; for hosted testing, set it to the Supabase Edge Function base URL.

```bash
curl -sS -X POST "$ASAP_API_BASE/api/thumbtack/lead" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $THUMBTACK_WEBHOOK_SECRET" \
  -d '{"customerName":"Thumbtack Customer","customerPhone":"+15551234567","leadId":"tt-123","dryRun":true}'
```

## In-App Click Path

- Page: `Customers`
- Location: selected customer detail panel
- Card: `Primary contact`
- Action button: provider call action in the primary contact card
- Behavior:
  - uses the customer `primaryPhone`
  - falls back to `secondaryPhone`
  - shows inline loading, success, and error feedback in the page banner

## Supabase Migration Requirement

- Recording callback persistence depends on the table created by:
  - `supabase/migrations/20260420120004_twilio_voice_recordings.sql`
- If that migration is not applied yet:
  - inbound and outbound calls can still be placed
  - `POST /api/twilio/recordings/status` will fail to persist metadata until the migration is applied

## Current Matching Behavior

- Inbound SMS and call events try to match a customer by normalized phone number against:
  - `customers.primary_phone`
  - `customers.secondary_phone`
- `communications.job_id` remains nullable, so unmatched job linkage is not a blocker.
- `communications.customer_id` is still required.
- If no unique customer phone match exists, the webhook is accepted and written to `unmatched_inbound_communications` instead of `communications`.
- The unmatched record stays pending until office staff link it to a real existing customer from the Communications page.
- Linking can optionally attach the resulting communication to a job that belongs to that selected customer.
- This keeps fake customers and fake communication rows out of the system while still preserving the inbound event.

## Webhook Behavior

- `POST /api/twilio/sms`
  - validates `X-Twilio-Signature` or `X-SignalWire-Signature`
  - verifies `AccountSid`
  - verifies the `To` number matches `SIGNALWIRE_PHONE_NUMBER` or one of `SIGNALWIRE_MANAGED_PHONE_NUMBERS`
  - creates one inbound `communications` row per unique `MessageSid` when there is a unique customer match
  - otherwise creates or reuses one pending `unmatched_inbound_communications` row per unique `MessageSid`

- `POST /api/twilio/voice`
  - validates `X-Twilio-Signature` or `X-SignalWire-Signature`
  - verifies `AccountSid`
  - verifies the `To` number matches `SIGNALWIRE_PHONE_NUMBER` or one of `SIGNALWIRE_MANAGED_PHONE_NUMBERS`
  - returns TwiML that forwards the inbound caller to `SIGNALWIRE_VOICE_FORWARD_TO`
  - records from answer using dual-channel Dial recording
  - points recording callbacks to `POST /api/twilio/recordings/status`

- `POST /api/twilio/calls/status`
  - validates `X-Twilio-Signature` or `X-SignalWire-Signature`
  - verifies `AccountSid`
  - verifies the `To` number matches `SIGNALWIRE_PHONE_NUMBER` or one of `SIGNALWIRE_MANAGED_PHONE_NUMBERS`
  - logs inbound calls into `communications` when there is a unique customer match
  - otherwise creates or updates one pending `unmatched_inbound_communications` row by `CallSid`
  - updates the existing persisted row on later callbacks by `CallSid`

- `POST /api/twilio/recordings/status`
  - validates `X-Twilio-Signature` or `X-SignalWire-Signature`
  - verifies `AccountSid`
  - upserts one recording metadata row per unique `RecordingSid`
  - stores the raw callback payload plus normalized recording metadata
  - links the callback back to a `communications` row when the Twilio `CallSid` or `ParentCallSid` matches an existing inbound call log
  - when `OPENAI_API_KEY` is configured, downloads the recording, generates a full transcript, and stores structured call highlights plus category sections back onto the communication record (or unmatched inbound queue item)

- `POST /api/twilio/outbound/calls`
  - accepts an app-origin JSON payload with customer identity and phone context
  - places the first outbound provider call to `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER`
  - configures the provider to fetch bridge TwiML from `POST /api/twilio/outbound/bridge`
  - configures provider status callbacks to `POST /api/twilio/outbound/calls/status`

- `POST /api/twilio/outbound/bridge`
  - validates `X-Twilio-Signature` or `X-SignalWire-Signature`
  - returns TwiML that dials the customer after the agent answers first
  - records the bridged conversation from answer with dual-channel recording
  - points recording callbacks to `POST /api/twilio/recordings/status`

- `POST /api/twilio/outbound/calls/status`
  - validates `X-Twilio-Signature` or `X-SignalWire-Signature`
  - accepts outbound parent-leg and customer-leg status callbacks for click-to-call
  - logs callback details on the server for operational visibility

## Communications Triage Flow

1. SignalWire posts inbound SMS or call events to the local webhook server.
2. The server tries to match the inbound `From` number to one unique customer.
3. If one customer matches, the event is written directly to `communications`.
4. If zero or multiple customers match, the event is written to `unmatched_inbound_communications`.
5. Office staff open the Communications page, review the unmatched item, choose an existing customer, and optionally choose one of that customer’s jobs.
6. The app creates the final `communications` row from the unmatched payload and marks the unmatched triage row as linked.

## Local Testing

### Matched inbound SMS

1. Start the app with `VITE_APP_DATA_SOURCE=supabase`.
2. Start the webhook server with `npm run signalwire:webhooks`.
3. Ensure a customer exists whose `primary_phone` or `secondary_phone` matches the inbound SignalWire `From` number.
4. Send an SMS to `SIGNALWIRE_PHONE_NUMBER`.
5. Confirm a new `communications` row appears in the Communications feed and no pending unmatched triage item is created for that `MessageSid`.

### Unmatched inbound SMS

1. Start the app and webhook server as above.
2. Send an SMS from a number that matches no customer, or from a number that currently matches multiple customers.
3. Confirm the webhook responds successfully and the event appears in the Communications page under the unmatched inbound triage queue.
4. Confirm no row is created in `communications` until manual linking happens.

### Link an unmatched event to an existing customer

1. Open the Communications page in live Supabase mode.
2. Select the pending unmatched inbound item.
3. Choose an existing customer.
4. Optionally choose one of that customer’s jobs.
5. Click `Link to customer`.
6. Confirm the unmatched triage item disappears from the pending queue and a normal `communications` row appears in the feed with the same inbound details.
