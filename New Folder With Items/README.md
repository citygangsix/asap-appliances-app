# ASAP Operations Frontend Demo

Frontend demo for an appliance service operations dashboard built with React, Vite, and Tailwind CSS.

## What This Project Includes

- A multi-page single-page app with mock operational workflows
- Dashboard-style views for Phone, Home, Jobs, Dispatch, Communications, Invoices, Revenue, Technicians, and Settings
- `/dashboard` opens the Phone screen first for quickest SignalWire access; Dispatch remains available from the sidebar at `/dashboard/dispatch-board`
- Shared UI components with both mock and Supabase-backed repository modes

## Tech Stack

- React 18
- Vite 5
- Tailwind CSS
- Supabase JavaScript client
- Mock seed data stored locally in `src/data/mock/`

## Project Structure

- `src/App.jsx`: route table and application shell
- `src/components/`: layout, navigation, and UI primitives
- `src/pages/`: page-level screens for each workflow area
- `src/data/mock/`: local fallback data and static non-Supabase demo content
- `src/integrations/supabase/`: client, adapters, mappers, and query scaffolding
- `supabase/`: schema migration and seed SQL

## Local Development

Install dependencies:

```bash
npm ci
```

Start the Vite dev server:

```bash
npm run dev
```

Use mock mode by default, or add a local env file to enable Supabase reads:

```bash
cp .env.local.example .env.local
```

Set:

- `VITE_APP_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Build the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run the local SignalWire webhook intake server:

```bash
npm run signalwire:webhooks
```

Run the safe local webhook smoke test:

```bash
npm run signalwire:webhooks:smoke
```

It validates local webhook health plus signed-request acceptance and invalid-signature rejection without creating live communication rows.

When the live invoice flow creates a new invoice, the app now also calls the local server to send the assistant or office phone an outbound SMS summary and a short voice call through SignalWire. Set `ASSISTANT_OFFICE_PHONE_NUMBER` in `.env.server.local` to enable delivery. If you only set `LUMIA_INVOICE_SMS_PHONE_NUMBER`, the server uses that as the fallback office destination.

The webhook server also exposes `POST /api/thumbtack/lead`, which takes a protected JSON payload with a customer name and phone number, calls Lamia first, and only dials the customer after she answers so her Egyptian Vodafone number stays hidden.

## Notes

- `node_modules/` is intentionally ignored and should not be committed.
- If the local dependency tree ever gets into a bad state again, `npm ci` is the clean reset.
- If Supabase credentials are missing or live reads fail, the app falls back to mock data instead of crashing.
- Mock mode remains the default local runtime.
- The Jobs page is the first live Supabase-backed workflow; if live reads fail, the repository falls back to mock data.
- Jobs and Dispatch technician assignment now use the real Supabase-backed repository path from the UI.
- Customers now support real customer creation and basic profile updates through the Supabase-backed repository path.
- Invoices now support real invoice creation and payment-status updates through the Supabase-backed repository path.
- Live invoice creation now attempts a server-side SignalWire SMS summary plus a short voice call to the assistant or office phone after the invoice row is created.
- Dispatch now supports saving ETA text updates and then sending text or call notifications to the technician and customer from the same UI flow.
- Dispatch now includes a map workspace for technician pins, incoming leads, route links, and gas mileage reimbursement estimates.
- Dispatch workflow automation now supports one-hour customer heads-up scheduling, diagnosis invoice generation, paid-invoice confirmations, and a 10-minute final-work labor invoice workflow on the local server.
- Thumbtack lead intake can now trigger the same SignalWire agent-first bridge flow through `POST /api/thumbtack/lead`.
- Communications review, approve/reject, and attach-to-job actions now use the real Supabase-backed repository path from the UI.
- SignalWire webhook intake now runs through a small server-side adapter in `server/twilioWebhookServer.js`.
- Unmatched SignalWire inbound calls and texts now persist into a safe triage queue until office staff link them to a real existing customer.
- `.env.server.example` provides placeholder-only server env keys for local SignalWire webhook setup.
- Some non-invoice, non-assignment write flows elsewhere in the app still use scaffolded placeholders.

## Recommended Next Steps

1. Add a real router so page state is reflected in the URL.
2. Replace mock data with a small API layer and typed data contracts.
3. Add basic test coverage for page rendering and filter behavior.
4. Add a proper README section for deployment once hosting is chosen.
