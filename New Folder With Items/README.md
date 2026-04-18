# ASAP Operations Frontend Demo

Frontend demo for an appliance service operations dashboard built with React, Vite, and Tailwind CSS.

## What This Project Includes

- A multi-page single-page app with mock operational workflows
- Dashboard-style views for Home, Jobs, Dispatch, Communications, Invoices, Revenue, Technicians, and Settings
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

Run the local Twilio webhook intake server:

```bash
npm run twilio:webhooks
```

## Notes

- `node_modules/` is intentionally ignored and should not be committed.
- If the local dependency tree ever gets into a bad state again, `npm ci` is the clean reset.
- If Supabase credentials are missing or live reads fail, the app falls back to mock data instead of crashing.
- Mock mode remains the default local runtime.
- The Jobs page is the first live Supabase-backed workflow; if live reads fail, the repository falls back to mock data.
- Jobs and Dispatch technician assignment now use the real Supabase-backed repository path from the UI.
- Customers now support real customer creation and basic profile updates through the Supabase-backed repository path.
- Invoices now support real invoice creation and payment-status updates through the Supabase-backed repository path.
- Communications review, approve/reject, and attach-to-job actions now use the real Supabase-backed repository path from the UI.
- Twilio webhook intake now runs through a small server-side adapter in `server/twilioWebhookServer.js`.
- Unmatched Twilio inbound calls and texts now persist into a safe triage queue until office staff link them to a real existing customer.
- Some non-invoice, non-assignment write flows elsewhere in the app still use scaffolded placeholders.

## Recommended Next Steps

1. Add a real router so page state is reflected in the URL.
2. Replace mock data with a small API layer and typed data contracts.
3. Add basic test coverage for page rendering and filter behavior.
4. Add a proper README section for deployment once hosting is chosen.
