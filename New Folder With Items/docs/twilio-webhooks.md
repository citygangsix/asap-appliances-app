# Twilio Webhook Intake

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
npm run twilio:webhooks
```

7. Run the smoke test on a fresh port so it does not reuse an older local process:

```bash
TWILIO_WEBHOOK_PORT=8788 npm run twilio:webhooks:smoke
```

8. In Twilio Console, set the inbound voice webhook to:

```text
<TWILIO_WEBHOOK_BASE_URL>/api/twilio/voice
```

9. In the app, open `Customers`, select a customer, and click `Call via Twilio` in the `Primary contact` card.

## Required Frontend Env

Create `.env.local` in the app root and set:

- `VITE_APP_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## Required Server Env

Create `.env.server.local` in the app root and set:

- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_AUTH_TOKEN=...`
- `TWILIO_PHONE_NUMBER=+18445424212` (active ASAP CRM Twilio business line, default outbound caller ID, and primary inbound webhook destination)
- `TWILIO_MANAGED_PHONE_NUMBERS=+18445424212` (comma-separated list of Twilio or BYOC business lines the webhook server should accept as yours; add previous lines only if they still route through Twilio)
- `TWILIO_VOICE_FORWARD_TO=...` (optional but recommended for inbound voice forwarding)
- `TWILIO_CLICK_TO_CALL_AGENT_NUMBER=...` (optional override for outbound click-to-call; otherwise the server falls back to `ASSISTANT_OFFICE_PHONE_NUMBER`)
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
- `TWILIO_WEBHOOK_BASE_URL=...`
- `TWILIO_WEBHOOK_PORT=8787` (optional)

The webhook server reads `SUPABASE_URL` from `.env.server.local`. If that is unset, it falls back to `VITE_SUPABASE_URL` from `.env.local`.

Start from `.env.server.example` to avoid missing keys.

## Local Development

1. Run the app normally with `npm run dev`.
2. Run the webhook server with `npm run twilio:webhooks`.
3. Expose the webhook server publicly with your tunnel of choice.
4. Set `TWILIO_WEBHOOK_BASE_URL` to that public base URL.
5. In the Twilio console, point:
   - inbound messaging webhook to `POST /api/twilio/sms`
   - inbound voice webhook to `POST /api/twilio/voice`
   - voice status callback webhook to `POST /api/twilio/calls/status` if you still want the existing inbound call event log

The app can also initiate outbound click-to-call requests against the local server route `POST /api/twilio/outbound/calls`.
Thumbtack or any intermediary automation can post new leads to `POST /api/thumbtack/lead`.

## Twilio Console Setup

Use `TWILIO_WEBHOOK_BASE_URL` as the public base URL. With the current route structure:

- Twilio Console inbound messaging webhook:
  - `POST <TWILIO_WEBHOOK_BASE_URL>/api/twilio/sms`
- Twilio Console inbound voice webhook:
  - `POST <TWILIO_WEBHOOK_BASE_URL>/api/twilio/voice`
- Separate inbound call-status callback:
  - optional
  - only needed if you want inbound call event logging in `communications`
  - `POST <TWILIO_WEBHOOK_BASE_URL>/api/twilio/calls/status`
- Outbound click-to-call route:
  - not entered in Twilio Console
  - the app calls `POST /api/twilio/outbound/calls` on the local server directly
- Thumbtack lead route:
  - not entered in Twilio Console
  - your Thumbtack automation, iPhone shortcut, Zapier scenario, or other integration posts to `POST /api/thumbtack/lead`
- Routes Twilio itself will hit during outbound click-to-call:
  - `POST <TWILIO_WEBHOOK_BASE_URL>/api/twilio/outbound/bridge`
  - `POST <TWILIO_WEBHOOK_BASE_URL>/api/twilio/outbound/calls/status`
  - `POST <TWILIO_WEBHOOK_BASE_URL>/api/twilio/recordings/status`
- Number called first during outbound click-to-call:
  - `TWILIO_CLICK_TO_CALL_AGENT_NUMBER`
  - if unset, `ASSISTANT_OFFICE_PHONE_NUMBER`
  - if that is unset, `TWILIO_VOICE_FORWARD_TO`
  - this must be an answerable office or staff phone, not the Twilio business caller ID `+18445424212`

For the hosted ASAPACboss.com API, use these exact URLs on the Twilio phone number `+18445424212`:

- Incoming SMS: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/sms`
- Incoming voice calls: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/voice`
- Incoming voice call status callback: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/calls/status`
- Recording status callbacks generated in TwiML: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/recordings/status`
- Outbound click-to-call status callbacks generated by the server: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/outbound/calls/status`
- Browser call status callback if browser calling is enabled: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/browser-call/status`
- Browser TwiML App voice request URL if browser calling is enabled: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/browser-call/twiml`

Outbound SMS status callbacks are not currently configured by the CRM's Twilio Messages API call.

## Local Smoke Test

Run:

```bash
npm run twilio:webhooks:smoke
```

What it does:

- reuses a healthy local webhook server if one is already running, otherwise starts a temporary local server on `TWILIO_WEBHOOK_PORT`
- checks `GET /health`
- sends one click-to-call dry run, one signed click-to-call bridge webhook, one Twilio-style signed SMS callback, one signed inbound voice webhook, one signed call-status callback, and one safe recording-callback request to the local server
- uses an intentionally wrong `To` number for the SMS and call-status checks so both signed requests are accepted but ignored before any Supabase write path runs
- uses a mismatched `AccountSid` for the recording callback check so the route is verified without creating a recording row
- sends one invalid-signature request and expects a `403`

This gives you a repeatable local check for server health, signature validation, and route wiring without creating live `communications` or `unmatched_inbound_communications` rows.

## Assistant Invoice Notifications

- After a live invoice is created from the CRM invoice flow, the frontend calls the local server route `POST /api/invoices/send-lumia`.
- The server uses `ASSISTANT_OFFICE_PHONE_NUMBER` and falls back to `LUMIA_INVOICE_SMS_PHONE_NUMBER` if the assistant key is not set.
- The server sends both an outbound SMS summary and a short voice call that tells the office the technician is finished and the invoice was just texted over.
- If the invoice flow already has a hosted invoice URL in the future, the server can send that URL. Today it sends a concise summary with the invoice identifier, customer name, total amount, and amount due.
- For safe validation without sending a real SMS or call, post `{"invoice": {...}, "dryRun": true}` to `POST /api/invoices/send-lumia`.

## Dispatch ETA Notifications

- The Dispatch page now includes an `ETA notifications` panel that saves the ETA text update through the live repository path and then posts to `POST /api/dispatch/notify-eta`.
- The server resolves the selected job, customer phone, and technician phone from Supabase, then sends the requested mix of text and voice notifications.
- For safe validation without placing real calls or texts, post a payload like `{"jobId":"<job-id>","etaWindowText":"Arriving in 20 minutes","notifyTechnician":{"sms":true},"notifyCustomer":{"sms":true,"call":true},"dryRun":true}` to `POST /api/dispatch/notify-eta`.

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

## Tunnel Rotation Checklist

If your tunnel URL changes in a later session:

1. Update `TWILIO_WEBHOOK_BASE_URL` in `.env.server.local`.
2. Restart the local webhook server so it reloads the updated env.
3. Update the Twilio console messaging webhook to `<new-base-url>/api/twilio/sms`.
4. Update the Twilio console inbound voice webhook to `<new-base-url>/api/twilio/voice`.
5. Update the Twilio console voice status callback to `<new-base-url>/api/twilio/calls/status` if you use it.
6. The server-generated recording callback will post to `<new-base-url>/api/twilio/recordings/status`.
7. Run `npm run twilio:webhooks:smoke` to confirm the local server still accepts valid signatures and rejects invalid ones.

## Recorded Call Behavior

- Inbound calls:
  - Twilio hits `POST /api/twilio/voice`
  - the server forwards the caller to `TWILIO_VOICE_FORWARD_TO`
  - the bridged call is recorded from answer with dual-channel Dial recording
  - recording callbacks post to `POST /api/twilio/recordings/status`

- Outbound click-to-call:
  - the app hits `POST /api/twilio/outbound/calls`
  - the server tells Twilio to call the agent number first
  - after the agent answers, Twilio fetches `POST /api/twilio/outbound/bridge`
  - that bridge TwiML dials the customer and records the bridged call from answer
  - recording callbacks reuse `POST /api/twilio/recordings/status`
  - only one live customer call is attempted per trigger
- if the customer does not answer, the server waits `TWILIO_CLICK_TO_CALL_MISSED_SMS_DELAY_SECONDS` and then sends one polite SMS follow-up from the business number
- no automatic rapid retry calling is performed
- automated triggers respect customer opt-outs and a 24-hour auto-call cooldown by default

## BYOC Notes

- The active ASAP CRM Twilio business line is `+18445424212`.
- Set `TWILIO_PHONE_NUMBER=+18445424212` and `TWILIO_MANAGED_PHONE_NUMBERS=+18445424212` for the hosted CRM.
- If you later want the CRM to accept multiple business lines at once, keep `+18445424212` in `TWILIO_PHONE_NUMBER` and add every other Twilio or BYOC-owned line to `TWILIO_MANAGED_PHONE_NUMBERS`.
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
  - calls `THUMBTACK_ASSISTANT_PHONE_NUMBER` first when set, otherwise falls back to `TWILIO_CLICK_TO_CALL_AGENT_NUMBER`
  - only after Lamia answers does Twilio dial the customer
  - the customer only sees `TWILIO_PHONE_NUMBER`, not Lamia's Egypt Vodafone number
  - the trigger is treated as automated, so opt-out and cooldown protections still apply

Example:

```bash
curl -X POST "$TWILIO_WEBHOOK_BASE_URL/api/thumbtack/lead" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $THUMBTACK_WEBHOOK_SECRET" \
  -d '{"customerName":"Thumbtack Customer","customerPhone":"+15551234567","leadId":"tt-123","dryRun":true}'
```

## In-App Click Path

- Page: `Customers`
- Location: selected customer detail panel
- Card: `Primary contact`
- Action button: `Call via Twilio`
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
  - validates Twilio signature
  - verifies `AccountSid`
  - verifies the `To` number matches `TWILIO_PHONE_NUMBER` or one of `TWILIO_MANAGED_PHONE_NUMBERS`
  - creates one inbound `communications` row per unique `MessageSid` when there is a unique customer match
  - otherwise creates or reuses one pending `unmatched_inbound_communications` row per unique `MessageSid`

- `POST /api/twilio/voice`
  - validates Twilio signature
  - verifies `AccountSid`
  - verifies the `To` number matches `TWILIO_PHONE_NUMBER` or one of `TWILIO_MANAGED_PHONE_NUMBERS`
  - returns TwiML that forwards the inbound caller to `TWILIO_VOICE_FORWARD_TO`
  - records from answer using dual-channel Dial recording
  - points recording callbacks to `POST /api/twilio/recordings/status`

- `POST /api/twilio/calls/status`
  - validates Twilio signature
  - verifies `AccountSid`
  - verifies the `To` number matches `TWILIO_PHONE_NUMBER` or one of `TWILIO_MANAGED_PHONE_NUMBERS`
  - logs inbound calls into `communications` when there is a unique customer match
  - otherwise creates or updates one pending `unmatched_inbound_communications` row by `CallSid`
  - updates the existing persisted row on later callbacks by `CallSid`

- `POST /api/twilio/recordings/status`
  - validates Twilio signature
  - verifies `AccountSid`
  - upserts one recording metadata row per unique `RecordingSid`
  - stores the raw callback payload plus normalized recording metadata
  - links the callback back to a `communications` row when the Twilio `CallSid` or `ParentCallSid` matches an existing inbound call log
  - when `OPENAI_API_KEY` is configured, downloads the recording, generates a full transcript, and stores structured call highlights plus category sections back onto the communication record (or unmatched inbound queue item)

- `POST /api/twilio/outbound/calls`
  - accepts an app-origin JSON payload with customer identity and phone context
  - places the first outbound Twilio call to `TWILIO_CLICK_TO_CALL_AGENT_NUMBER`
  - configures Twilio to fetch bridge TwiML from `POST /api/twilio/outbound/bridge`
  - configures Twilio status callbacks to `POST /api/twilio/outbound/calls/status`

- `POST /api/twilio/outbound/bridge`
  - validates Twilio signature
  - returns TwiML that dials the customer after the agent answers first
  - records the bridged conversation from answer with dual-channel recording
  - points recording callbacks to `POST /api/twilio/recordings/status`

- `POST /api/twilio/outbound/calls/status`
  - validates Twilio signature
  - accepts outbound parent-leg and customer-leg status callbacks for click-to-call
  - logs callback details on the server for operational visibility

## Communications Triage Flow

1. Twilio posts inbound SMS or call events to the local webhook server.
2. The server tries to match the inbound `From` number to one unique customer.
3. If one customer matches, the event is written directly to `communications`.
4. If zero or multiple customers match, the event is written to `unmatched_inbound_communications`.
5. Office staff open the Communications page, review the unmatched item, choose an existing customer, and optionally choose one of that customer’s jobs.
6. The app creates the final `communications` row from the unmatched payload and marks the unmatched triage row as linked.

## Local Testing

### Matched inbound SMS

1. Start the app with `VITE_APP_DATA_SOURCE=supabase`.
2. Start the webhook server with `npm run twilio:webhooks`.
3. Ensure a customer exists whose `primary_phone` or `secondary_phone` matches the inbound Twilio `From` number.
4. Send an SMS to `TWILIO_PHONE_NUMBER`.
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
