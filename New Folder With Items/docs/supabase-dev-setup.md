# Supabase Dev Setup

## Source Toggle

- Mock remains the default active source.
- Use `VITE_APP_DATA_SOURCE=mock` for the current behavior.
- Use `VITE_APP_DATA_SOURCE=supabase` to enable live Supabase reads.
- `VITE_DATA_SOURCE` is still supported as a backward-compatible alias.

## Environment Variables

To connect the frontend, add:

- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

The app is intentionally safe if these are missing or the queries fail.
Supabase mode will fall back to mock-backed page data rather than crashing.

## Suggested Local Workflow

1. Apply the schema migration:
   - `supabase/migrations/20260416_000001_asap_operations_core.sql`
2. Load seed data for local/dev inspection:
   - `supabase/seeds/20260416_000001_asap_operations_seed.sql`
3. Set `VITE_APP_DATA_SOURCE=supabase` in `.env.local`.
   - Start from `.env.local.example` to avoid missing keys.
4. Start the frontend with `npm run dev`.

## Current State

- SQL schema is the source of truth for table shapes and relationships.
- Frontend domain models remain display-oriented and stable for the current UI.
- Mapper functions bridge the SQL row shapes to the current frontend models.
- Repository methods now support live Supabase reads with a safe mock fallback.
- Page components load repository data asynchronously so remote reads do not block rendering.
- Mutation plans remain scaffolded placeholders until write flows are wired.
