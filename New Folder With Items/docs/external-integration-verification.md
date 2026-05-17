# External Integration Verification

Date: 2026-05-17

This note covers the hosted Supabase Edge Function integrations for SignalWire/Twilio-compatible voice/SMS, browser calling, invoice notifications, provider webhook signatures, recording callbacks, and Thumbtack/LeadWinner.

## Current Result

Hosted API:

```bash
HOSTED_API=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
```

Hosted Supabase secret names are present for Supabase service auth, SignalWire/Twilio provider credentials, browser calling keys, Thumbtack, invoice/assistant phone targets, and call intelligence. Secret values were not printed or copied into docs.

The live-safe hosted smoke command passed:

```bash
npm run smoke:external-integrations
```

What it does:

- Creates a temporary Supabase Auth dashboard user with service-role access.
- Signs in as that user and sends dashboard-authenticated hosted requests.
- Runs dry-run provider flows so no real call or SMS is sent.
- Deletes the temporary Auth user at the end.
- Redacts bearer tokens and configured phone numbers from output.

Latest evidence:

- Browser calling token/session: `200`, token returned, identity `asap-crm-browser`, TwiML/CXML app SID present.
- Outbound click-to-call dry-run: `200`, agent phone configured, business phone configured, bridge URL present, status callback URL present, recording callback URL present, bridge TwiML present.
- Outbound SMS dry-run: `200`, provider from-number configured, destination accepted, message body accepted.
- Invoice call/SMS dry-run: `200`, assistant destination configured, assistant SMS/call and customer SMS/call preferences accepted, no call or SMS requested because `dryRun: true`.
- Recording callback validation boundary: mismatched `AccountSid` rejected with `403`.
- Browser TwiML callback validation boundary: mismatched `AccountSid` rejected with `403`.
- Inbound SMS callback validation boundary: mismatched `AccountSid` rejected with `403`.
- Thumbtack/LeadWinner missing secret: `401`.
- Thumbtack/LeadWinner invalid secret: `403`.
- Protected private routes without auth returned `401`.
- Invalid dashboard bearer on `GET /api/twilio/voice-token` returned `403`.
- Temporary dashboard user cleanup: deleted successfully.

## Verification Matrix

| Area | Status | Evidence or exact blocker |
| --- | --- | --- |
| Supabase/API auth | Verified | Temporary real Supabase Auth user created, signed in, used as `Authorization: Bearer <access token>`, then deleted. |
| Browser calling token/session | Verified | `GET /api/twilio/voice-token` returned `200` with a valid JWT-shaped token and `identity: asap-crm-browser`. |
| Outbound calls | Dry-run verified; live send blocked | Hosted dry-run returned `200` with bridge/status/recording URLs. Live non-dry-run call was not placed because no approved live destination was supplied for this workspace. Required: `ASAP_EXTERNAL_SMOKE_TEST_PHONE=<approved E.164 test number>` and explicit approval to send `dryRun:false`. |
| Outbound SMS | Dry-run verified; live send blocked | Hosted dry-run returned `200`. Live non-dry-run SMS was not sent because no approved live destination was supplied for this workspace. Required: `ASAP_EXTERNAL_SMOKE_TEST_PHONE=<approved E.164 test number>` and explicit approval to send `dryRun:false`. |
| Invoice call/SMS | Dry-run verified | Hosted invoice notification dry-run returned `200`; assistant destination was configured; no provider send occurred. Live send uses the same approved destination/explicit-send requirement as outbound calls/SMS. |
| Provider webhook signature validation | Boundary verified; valid signature success blocked | Mismatched `AccountSid` returns `403`. Valid signed callback requires local values for `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`, plus `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`; hosted secret names exist but their values cannot be read back from Supabase. |
| Recording callbacks | Boundary verified; valid signed upsert blocked | Mismatched recording callback returns `403`. Valid signed recording callback and cleanup will run from `npm run smoke:external-integrations` once local provider account/token values are supplied. |
| Thumbtack/LeadWinner webhook | Boundary verified; valid provider payload blocked | Missing secret returns `401`; invalid secret returns `403`. Valid realistic dry-run requires local `THUMBTACK_WEBHOOK_SECRET` value; hosted secret name exists but its value cannot be read back from Supabase. |

## Required Env Vars By Surface

### Supabase/API Auth

- Hosted/server:
  - `SUPABASE_URL` or `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`
- Manual dashboard-protected curl tests:
  - `SUPABASE_AUTH_ACCESS_TOKEN` or `ASAP_DASHBOARD_AUTH_BEARER_TOKEN`
- Frontend dashboard login:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### SignalWire/Twilio Browser Calling

- `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
- `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- `SIGNALWIRE_PHONE_NUMBER` or `TWILIO_PHONE_NUMBER`
- `SIGNALWIRE_WEBHOOK_BASE_URL` or `TWILIO_WEBHOOK_BASE_URL`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_TWIML_APP_SID` or `SIGNALWIRE_CXML_APP_SID`

### Outbound Calls

- `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
- `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- `SIGNALWIRE_SPACE_URL`, `TELEPHONY_API_BASE_URL`, or `TWILIO_API_BASE_URL`
- `SIGNALWIRE_PHONE_NUMBER` or `TWILIO_PHONE_NUMBER`
- `SIGNALWIRE_MANAGED_PHONE_NUMBERS` or `TWILIO_MANAGED_PHONE_NUMBERS`
- `SIGNALWIRE_WEBHOOK_BASE_URL` or `TWILIO_WEBHOOK_BASE_URL`
- One answerable first-leg phone:
  - `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER`
  - `TWILIO_CLICK_TO_CALL_AGENT_NUMBER`
  - `ASSISTANT_OFFICE_PHONE_NUMBER`
  - `LUMIA_INVOICE_SMS_PHONE_NUMBER`
  - `SIGNALWIRE_VOICE_FORWARD_TO`
  - `TWILIO_VOICE_FORWARD_TO`
- For live smoke, an approved destination:
  - `ASAP_EXTERNAL_SMOKE_TEST_PHONE=<approved E.164 test number>`

### Outbound SMS

- `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
- `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- `SIGNALWIRE_SPACE_URL`, `TELEPHONY_API_BASE_URL`, or `TWILIO_API_BASE_URL`
- `SIGNALWIRE_PHONE_NUMBER` or `TWILIO_PHONE_NUMBER`
- For live smoke, an approved destination:
  - `ASAP_EXTERNAL_SMOKE_TEST_PHONE=<approved E.164 test number>`

### Invoice Call/SMS

- Supabase/API auth vars above.
- Outbound call/SMS provider vars above.
- Assistant destination:
  - `ASSISTANT_OFFICE_PHONE_NUMBER` or `LUMIA_INVOICE_SMS_PHONE_NUMBER`
- Optional workflow tuning:
  - `WORKFLOW_LABOR_INVOICE_AMOUNT`
  - `WORKFLOW_PAYMENT_FOLLOWUP_MINUTES`

### Recording Callbacks

- Supabase/API auth vars above.
- `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
- `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- `SIGNALWIRE_WEBHOOK_BASE_URL` or `TWILIO_WEBHOOK_BASE_URL`
- Optional if SignalWire sends `X-SignalWire-Signature`:
  - `SIGNALWIRE_SIGNING_KEY`
- Optional call intelligence:
  - `OPENAI_API_KEY`
  - `OPENAI_TRANSCRIPTION_MODEL`
  - `OPENAI_CALL_ANALYSIS_MODEL`

### Thumbtack/LeadWinner Webhook

- `THUMBTACK_WEBHOOK_SECRET`
- Outbound call provider vars above.
- Optional Thumbtack-specific first-leg phone:
  - `THUMBTACK_ASSISTANT_PHONE_NUMBER`

## Commands

No-secrets hosted secret-name inventory:

```bash
supabase secrets list --project-ref nexkymqahpkvzzlvivfi
```

Main hosted dry-run and route-boundary smoke:

```bash
npm run smoke:external-integrations
```

Local env readiness check:

```bash
npm run check:hosted-env
```

The local readiness check currently fails in this workspace because `.env.server.local` and `.env.local` are not present. That is expected for this machine; hosted secret names are configured, but local secret values are not available.

Rerun valid Thumbtack and valid signed-provider callback paths after placing local secret values in `.env.server.local` or exporting them in the shell:

```bash
THUMBTACK_WEBHOOK_SECRET=<secret> \
SIGNALWIRE_PROJECT_ID=<project-id> \
SIGNALWIRE_API_TOKEN=<api-token> \
npm run smoke:external-integrations
```

Legacy aliases are also accepted:

```bash
THUMBTACK_WEBHOOK_SECRET=<secret> \
TWILIO_ACCOUNT_SID=<account-or-project-id> \
TWILIO_AUTH_TOKEN=<api-token> \
npm run smoke:external-integrations
```

Live outbound SMS to an approved number, after obtaining a real dashboard access token:

```bash
curl -sS -X POST "$HOSTED_API/api/twilio/outbound/messages" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "toNumber": "'"$ASAP_EXTERNAL_SMOKE_TEST_PHONE"'",
    "body": "ASAP live SMS smoke.",
    "dryRun": false,
    "triggerSource": "external_integration_live_smoke",
    "persistCustomerContact": false
  }'
```

Live outbound click-to-call to an approved number, after confirming the configured first-leg agent phone is answerable:

```bash
curl -sS -X POST "$HOSTED_API/api/twilio/outbound/calls" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "customerName": "Approved Smoke Test",
    "customerPhone": "'"$ASAP_EXTERNAL_SMOKE_TEST_PHONE"'",
    "dryRun": false,
    "triggerSource": "external_integration_live_smoke",
    "persistCustomerContact": false
  }'
```

Invoice notification dry-run:

```bash
curl -sS -X POST "$HOSTED_API/api/invoices/send-lumia" \
  -H "Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "dryRun": true,
    "invoice": {
      "invoiceNumber": "SMOKE-INV-001",
      "customerName": "Smoke Test Customer",
      "customerPhone": "+15551110004",
      "totalAmount": 125,
      "outstandingBalance": 125,
      "invoiceUrl": "https://example.com/invoices/SMOKE-INV-001"
    },
    "notifyAssistant": { "sms": true, "call": true },
    "notifyCustomer": { "sms": true, "call": true }
  }'
```

Thumbtack/LeadWinner realistic provider payload:

```bash
curl -sS -X POST "$HOSTED_API/api/thumbtack/lead" \
  -H "Authorization: Bearer $THUMBTACK_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  --data '{
    "event": "lead.created",
    "lead": {
      "id": "tt-lead-smoke-001",
      "name": "Smoke Test Customer",
      "phone": "+15551110004",
      "category": "Appliance repair",
      "city": "Miami",
      "state": "FL"
    },
    "customer": {
      "name": "Smoke Test Customer",
      "phone": "+15551110004"
    },
    "dryRun": true
  }'
```

## Exact Remaining Blockers

- Valid Thumbtack/LeadWinner provider-payload dry-run:
  - Missing local value: `THUMBTACK_WEBHOOK_SECRET`
- Valid signed SignalWire/Twilio webhook success path and recording callback upsert:
  - Missing local value: `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
  - Missing local value: `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- Live non-dry-run outbound call/SMS:
  - Missing approved destination: `ASAP_EXTERNAL_SMOKE_TEST_PHONE=<approved E.164 test number>`
  - Missing explicit approval to send `dryRun:false`

Everything else in the hosted external integration surface is either verified live-safe with evidence above or blocked only by the exact missing local secret/test-destination values listed here.
