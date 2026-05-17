# LeadWinner + Thumbtack Setup

Use this when configuring LeadWinner for ASAP CRM.

## Immediate Lead Call Target

- LeadWinner notification / 2-way call number: `+15615641545`
- ASAP CRM Thumbtack assistant number: `+15615641545`

## ASAP Webhook Endpoint

- URL: `https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/thumbtack/lead`
- Method: `POST`
- Header:
  - `Authorization: Bearer <THUMBTACK_WEBHOOK_SECRET>`
  - `Content-Type: application/json`

The current `THUMBTACK_WEBHOOK_SECRET` is stored only in `.env.server.local`.
Do not place this secret in Vite/public frontend code.

## Sample Payload

```json
{
  "customerName": "Thumbtack Customer",
  "customerPhone": "+15551234567",
  "leadId": "tt-123"
}
```

## Safe Dry Run

Use this before enabling a live LeadWinner or Thumbtack automation. It validates the route and prepares the click-to-call bridge without placing a live call:

```bash
export HOSTED_API="https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm"

curl -sS -X POST "$HOSTED_API/api/thumbtack/lead" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $THUMBTACK_WEBHOOK_SECRET" \
  -d '{"customerName":"Thumbtack Dry Run","customerPhone":"+15551234567","leadId":"dry-run-tt-001","dryRun":true}'
```

If this returns `401`, the request did not include a secret. If it returns `403`, the provided secret does not match `THUMBTACK_WEBHOOK_SECRET` in the server or hosted Supabase secrets.

Realistic provider-style dry-run payload:

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

Hosted route-boundary checks on 2026-05-17:

- Missing secret returned `401`.
- Invalid bearer secret returned `403`.
- Full hosted dry-run with a valid realistic provider payload is blocked in this workspace until the local `THUMBTACK_WEBHOOK_SECRET` value is supplied. The hosted secret name is configured, but Supabase does not expose secret values after they are set.

Run the complete hosted external integration smoke after adding the local secret value:

```bash
THUMBTACK_WEBHOOK_SECRET=<secret> npm run smoke:external-integrations
```

## Supported Lead Fields

The webhook currently accepts common variants such as:

- `customerName`
- `customerPhone`
- `phone`
- `contactPhone`
- `customer.phone`
- `leadId`

## Current Runtime Notes

- New lead calls target `+15615641545` first.
- Calls are recorded through the CRM SignalWire compatibility flow.
- The current outbound caller ID shown to customers is `+15615769819`.
- Keep `SIGNALWIRE_PHONE_NUMBER=+15615769819` and `SIGNALWIRE_MANAGED_PHONE_NUMBERS=+15615769819` in the hosted Supabase secrets unless another SignalWire line is intentionally added.
