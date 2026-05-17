# GitHub Pages Production Environment

The `Publish ASAP Website and CRM` workflow builds the public site and dashboard for GitHub Pages. The dashboard is a static Vite app, so Supabase frontend values must be available at build time.

## Required GitHub Actions Settings

Open the repository on GitHub:

```text
citygangsix/asap-appliances-app > Settings > Secrets and variables > Actions
```

Set these repository variables on the `Variables` tab:

```text
VITE_SUPABASE_URL=https://nexkymqahpkvzzlvivfi.supabase.co
VITE_APP_DATA_SOURCE=supabase
VITE_LOCAL_OPERATIONS_SERVER_URL=https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
```

Set this repository secret on the `Secrets` tab:

```text
VITE_SUPABASE_ANON_KEY=<Supabase project anon/public API key>
```

The anon key is the project anon or publishable browser key from:

```text
Supabase Dashboard > Project Settings > API > Project API keys
```

Do not use the service-role key for `VITE_SUPABASE_ANON_KEY`. The service-role key is server-only and belongs in Supabase Edge Function secrets or local server env, never in a Vite frontend build.

## CLI Setup

With GitHub CLI access to the repo:

```bash
gh variable set VITE_SUPABASE_URL --body "https://nexkymqahpkvzzlvivfi.supabase.co"
gh variable set VITE_APP_DATA_SOURCE --body "supabase"
gh variable set VITE_LOCAL_OPERATIONS_SERVER_URL --body "https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm"
gh secret set VITE_SUPABASE_ANON_KEY --body "<Supabase project anon/public API key>"
```

Confirm names are present:

```bash
gh variable list
gh secret list
```

GitHub does not print secret values back after they are stored.

## Workflow Behavior

`.github/workflows/deploy-pages.yml` now fails before build if either `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.

The workflow runs:

```bash
npm run build:pages:hosted
```

That ensures the published dashboard and public service form target the hosted Supabase Edge Function at:

```text
https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm
```

## Manual Verification

After updating the GitHub Actions settings, run:

```bash
npm run build:pages:hosted
npm run check:pages-routes
npm run build
npm run check:dashboard-auth
npm run check:supabase-live
```

Then push `main` or run the `Publish ASAP Website and CRM` workflow manually. After publish, verify:

```bash
curl -I https://asapacboss.com/dashboard/login/
```

The live page should show `Dashboard Login`, not `Dashboard Auth Unavailable`.
