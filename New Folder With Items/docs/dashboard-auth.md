# Dashboard Supabase Auth

The dashboard uses Supabase Auth email/password sessions. The old local email/password hash and shared dashboard API secret are no longer used by the frontend or protected API routes.

## Required Frontend Env

Set these in `.env.local` before running or building the dashboard:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<project-anon-key>
```

The Supabase client persists and refreshes the auth session in browser storage, so signed-in users stay signed in across refreshes until they log out or the session expires.

## Required Server Env

Set these in `.env.server.local` and as Supabase Edge Function secrets:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<project-service-role-key>
```

The service-role key stays server-side. Protected dashboard API routes verify `Authorization: Bearer <supabase-access-token>` with Supabase Auth before running server actions.

## Create The First Dashboard User

1. Open the Supabase project dashboard.
2. Go to Authentication, then Users.
3. Add a user with the dashboard email address and a strong password.
4. Mark the email as confirmed if email confirmation is required for the project.
5. Sign in at `/dashboard/login`.

For production, keep public signup disabled unless the business intentionally wants self-service dashboard account creation.

## Protected API Checks

Anonymous protected routes should return `401`:

```bash
export HOSTED_API="https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm"
curl -i "$HOSTED_API/api/hiring-candidates"
curl -i "$HOSTED_API/api/twilio/voice-token"
```

After signing in through the dashboard, private API calls include the Supabase access token automatically. For manual checks, use a current Supabase user access token:

```bash
curl -i "$HOSTED_API/api/hiring-candidates" \
  -H "Authorization: Bearer <supabase-user-access-token>"
```
