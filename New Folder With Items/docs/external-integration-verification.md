# External Integration Verification

Date: 2026-05-17

This note covers SignalWire/Twilio-compatible voice/SMS, browser calling, invoice notifications, provider webhook signatures, recording callbacks, and Thumbtack/LeadWinner.

## Current Result

No local live credentials are present in this workspace. `.env.server.local` and `.env.local` are missing, and every checked provider/Supabase secret is absent from the process environment. Because of that, live call/SMS/token/persisting smoke tests were not run locally.

Hosted route-boundary checks were run against:

```bash
HOSTED_API=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
```

Verified hosted behavior:

- `GET /api/twilio/voice-token` without dashboard auth: `401`, `Supabase dashboard session is required.`
- `GET /api/twilio/voice-token` with an invalid bearer token: `403`, `Supabase dashboard session is invalid or expired.`
- `POST /api/twilio/outbound/calls` without dashboard auth: `401`, `Supabase dashboard session is required.`
- `POST /api/twilio/outbound/messages` without dashboard auth: `401`, `Supabase dashboard session is required.`
- `POST /api/invoices/send-lumia` without dashboard auth: `401`, `Supabase dashboard session is required.`
- `POST /api/thumbtack/lead` without secret: `401`, `Thumbtack lead route requires a Bearer token, x-thumbtack-secret header, or webhookSecret field.`
- `POST /api/thumbtack/lead` with an invalid secret: `403`, `Thumbtack lead secret is invalid.`
- `POST /api/twilio/recordings/status` with a mismatched `AccountSid`: `403`, `SignalWire AccountSid mismatch.`
- `POST /api/twilio/browser-call/twiml` with a mismatched `AccountSid`: `403`, `SignalWire AccountSid mismatch.`

## Required Credentials

Supabase/server API:

- `SUPABASE_URL` or `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE`
- `ASAP_DASHBOARD_AUTH_BEARER_TOKEN` or `SUPABASE_AUTH_ACCESS_TOKEN`

SignalWire/Twilio-compatible provider:

- `SIGNALWIRE_PROJECT_ID` or `TWILIO_ACCOUNT_SID`
- `SIGNALWIRE_API_TOKEN` or `TWILIO_AUTH_TOKEN`
- `SIGNALWIRE_PHONE_NUMBER` or `TWILIO_PHONE_NUMBER`
- `SIGNALWIRE_MANAGED_PHONE_NUMBERS` or `TWILIO_MANAGED_PHONE_NUMBERS` when more than one business line is accepted
- `SIGNALWIRE_WEBHOOK_BASE_URL` or `TWILIO_WEBHOOK_BASE_URL`
- `SIGNALWIRE_SPACE_URL`, `TELEPHONY_API_BASE_URL`, or `TWILIO_API_BASE_URL`
- `SIGNALWIRE_SIGNING_KEY` if SignalWire sends `X-SignalWire-Signature`

Answerable test/destination numbers:

- `SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER`, `TWILIO_CLICK_TO_CALL_AGENT_NUMBER`, `ASSISTANT_OFFICE_PHONE_NUMBER`, `LUMIA_INVOICE_SMS_PHONE_NUMBER`, `SIGNALWIRE_VOICE_FORWARD_TO`, or `TWILIO_VOICE_FORWARD_TO`
- `SIGNALWIRE_VOICE_FORWARD_TO`, `TWILIO_VOICE_FORWARD_TO`, `LUMIA_INVOICE_SMS_PHONE_NUMBER`, or `ASSISTANT_OFFICE_PHONE_NUMBER`
- `THUMBTACK_ASSISTANT_PHONE_NUMBER` if Thumbtack leads should ring a different first-answer number

Browser calling:

- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_TWIML_APP_SID` or `SIGNALWIRE_CXML_APP_SID`

Thumbtack/LeadWinner:

- `THUMBTACK_WEBHOOK_SECRET`

Optional call intelligence:

- `OPENAI_API_KEY`
- `OPENAI_TRANSCRIPTION_MODEL`
- `OPENAI_CALL_ANALYSIS_MODEL`

## Minimal Test Plan

1. Fill `.env.server.local` from `.env.server.example`.
2. Obtain a Supabase dashboard user access token and set it as `SUPABASE_AUTH_ACCESS_TOKEN` or `ASAP_DASHBOARD_AUTH_BEARER_TOKEN`.
3. Run:

```bash
npm run check:hosted-env
npm run signalwire:webhooks:smoke
```

4. For hosted dashboard-protected dry-runs, use:

```bash
HOSTED_API=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
AUTH_HEADER="Authorization: Bearer $SUPABASE_AUTH_ACCESS_TOKEN"
```

## Live-Safe Commands

Browser calling token:

```bash
curl -sS "$HOSTED_API/api/twilio/voice-token" \
  -H "$AUTH_HEADER"
```

Outbound call dry-run:

```bash
curl -sS -X POST "$HOSTED_API/api/twilio/outbound/calls" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  --data '{
    "customerName": "Smoke Test Customer",
    "customerPhone": "+15551110004",
    "dryRun": true
  }'
```

Outbound SMS dry-run:

```bash
curl -sS -X POST "$HOSTED_API/api/twilio/outbound/messages" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  --data '{
    "toNumber": "+15551110004",
    "body": "ASAP smoke test SMS dry-run.",
    "dryRun": true
  }'
```

Invoice call/SMS dry-run:

```bash
curl -sS -X POST "$HOSTED_API/api/invoices/send-lumia" \
  -H "$AUTH_HEADER" \
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

Thumbtack/LeadWinner dry-run with a realistic provider payload:

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

Provider webhook signature, inbound voice, click-to-call bridge, browser-call status, invalid signature, and recording callback are covered by:

```bash
npm run signalwire:webhooks:smoke
```

That smoke test signs Twilio-compatible forms with the configured auth token, verifies safe ignored callbacks, verifies recorded bridge TwiML, verifies recording callback rejection for mismatched accounts, and verifies invalid signatures are rejected.
