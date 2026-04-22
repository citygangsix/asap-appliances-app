# LeadWinner + Thumbtack Setup

Use this when configuring LeadWinner for ASAP CRM.

## Immediate Lead Call Target

- LeadWinner notification / 2-way call number: `+15618781674`
- ASAP CRM Thumbtack assistant number: `+15618781674`

## ASAP Webhook Endpoint

- URL: `https://retold-playback-cause.ngrok-free.dev/api/thumbtack/lead`
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

- New lead calls target `+15618781674` first.
- Calls are recorded through the CRM Twilio flow.
- The current outbound caller ID shown to customers is still `+15617706385`.
- Once BYOC is live for `+15615641545` or `+15618781674`, we can switch the caller ID to one of those business lines.
