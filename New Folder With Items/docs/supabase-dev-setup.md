# Supabase Dev Setup

## Source Toggle

- Mock remains the default active source.
- Use `VITE_APP_DATA_SOURCE=mock` for the current behavior.
- Use `VITE_APP_DATA_SOURCE=supabase` to enable live Supabase reads.
- `VITE_DATA_SOURCE` is still supported as a backward-compatible alias.
- `VITE_SUPABASE_ALLOW_MOCK_FALLBACK=true` allows local/dev Supabase read failures to fall back to mock data.
- Production Supabase mode is strict by default. A production build with `VITE_APP_DATA_SOURCE=supabase` and no explicit fallback flag must use real Supabase reads instead of silently substituting mock data.

## Environment Variables

To connect the frontend, add:

- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Local dev is intentionally safe if these are missing or the queries fail: Supabase mode falls back to mock-backed page data when `VITE_SUPABASE_ALLOW_MOCK_FALLBACK=true` or when Vite is running in dev mode without an explicit fallback setting.

Production/live mode should omit `VITE_SUPABASE_ALLOW_MOCK_FALLBACK` or set it to `false`. In that mode, missing frontend Supabase credentials or failed read queries surface as live-mode errors instead of pretending the CRM is backed by real data.

## Suggested Local Workflow

1. Apply the schema migration:
   - `supabase/migrations/20260416_000001_asap_operations_core.sql`
2. Load seed data for local/dev inspection:
   - `supabase/seeds/20260416_000001_asap_operations_seed.sql`
3. Set `VITE_APP_DATA_SOURCE=supabase` in `.env.local`.
   - Start from `.env.local.example` to avoid missing keys.
4. Optional local fallback: set `VITE_SUPABASE_ALLOW_MOCK_FALLBACK=true`.
5. Start the frontend with `npm run dev`.
6. Verify the live schema contract with `npm run check:supabase-live`.

## Current State

- SQL schema is the source of truth for table shapes and relationships.
- Frontend domain models remain display-oriented and stable for the current UI.
- Mapper functions bridge the SQL row shapes to the current frontend models.
- Repository methods support live Supabase reads with local/dev mock fallback and strict production live mode.
- Customer, job, dispatch, communication, invoice, job timeline, technician payout, public service request, manual customer call log, and hiring-candidate write paths now execute real Supabase mutations when Supabase credentials are configured.
- Page components load repository data asynchronously so remote reads do not block rendering.
- Mock mode remains the default and returns non-persistent typed mutation responses so local demos stay safe.
- When strict Supabase mode is requested without frontend credentials, reads fail clearly and writes return explicit non-success responses instead of attempting partial live writes.
- `npm run check:supabase-live` verifies the local migration contract for CRM-critical tables and guards against reintroducing mock-only hiring writes.
