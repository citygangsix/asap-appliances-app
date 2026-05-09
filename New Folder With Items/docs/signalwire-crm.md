# SignalWire CRM Provider

ASAP CRM uses SignalWire as the active voice and SMS provider through SignalWire's Twilio-compatible Compatibility API.

## Active Business Number

- SignalWire number: `+15615769819`
- Dashboard label: `+1 (561) 576-9819`
- Space URL: `caseless-industries-llc.signalwire.com`

## Required Server Environment

Prefer the SignalWire names below. The older `TWILIO_*` names are still supported as fallbacks because the CRM route names and provider payloads are Twilio-compatible.

```bash
SIGNALWIRE_SPACE_URL=caseless-industries-llc.signalwire.com
SIGNALWIRE_PROJECT_ID=...
SIGNALWIRE_API_TOKEN=...
SIGNALWIRE_SIGNING_KEY=...
SIGNALWIRE_PHONE_NUMBER=+15615769819
SIGNALWIRE_MANAGED_PHONE_NUMBERS=+15615769819
SIGNALWIRE_WEBHOOK_BASE_URL=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
SIGNALWIRE_VOICE_FORWARD_TO=+15555550111
SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER=+15555550111
```

The local `.env.server.local` can keep using `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` if those already contain the SignalWire Project ID and API Token.

## Webhook URLs

Configure these in the SignalWire phone number settings. The `/api/twilio/*` path names stay as-is for compatibility.

- Messaging webhook: `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/sms`
- Voice webhook: `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/voice`
- Voice status callback: `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/calls/status`

The CRM generated callbacks reuse:

- Recording status: `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/recordings/status`
- Click-to-call status: `POST <SIGNALWIRE_WEBHOOK_BASE_URL>/api/twilio/outbound/calls/status`

## Local Commands

```bash
npm run signalwire:webhooks
npm run signalwire:webhooks:smoke
```

The older `npm run twilio:webhooks` commands are aliases for the same local server.
