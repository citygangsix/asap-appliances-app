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

## Sample Payload

```json
{
  "customerName": "Thumbtack Customer",
  "customerPhone": "+15551234567",
  "leadId": "tt-123"
}
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
