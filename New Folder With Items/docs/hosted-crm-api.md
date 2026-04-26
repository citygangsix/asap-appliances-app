# Hosted CRM API

The public site and dashboard can stay on GitHub Pages, but server-backed CRM actions must run on a hosted API. GitHub Pages only serves static files, so the production API lives in Supabase Edge Functions.

## Production URLs

- Website: `https://asapacboss.com/`
- Dashboard: `https://asapacboss.com/dashboard/`
- Hosted CRM API: `https://gntijouqttihazdupoiu.supabase.co/functions/v1/asap-crm`
- API health check: `https://gntijouqttihazdupoiu.supabase.co/functions/v1/asap-crm/health`

## Deploy

The Supabase project owner or an admin with Edge Function and secret privileges must run these commands:

```bash
supabase secrets set --env-file .env.server.local
supabase secrets set TWILIO_WEBHOOK_BASE_URL=https://gntijouqttihazdupoiu.supabase.co/functions/v1/asap-crm
npm run api:deploy
```

The function is deployed with `--no-verify-jwt` because Twilio, Thumbtack, and the public dashboard need to reach webhook/API routes without a Supabase user JWT. Route-level secrets and Twilio signatures still protect the sensitive webhook paths.

## Publish Dashboard Against Hosted API

After the Edge Function health check passes, publish the static site with the hosted API URL embedded:

```bash
npm run build:pages:hosted
```

Then copy `dist-pages` into the `gh-pages` worktree and push the live publish commit.

## Twilio Console

Update Twilio webhook URLs from the old ngrok host to:

- SMS webhook: `https://gntijouqttihazdupoiu.supabase.co/functions/v1/asap-crm/api/twilio/sms`
- Voice webhook: `https://gntijouqttihazdupoiu.supabase.co/functions/v1/asap-crm/api/twilio/voice`
- Call status callback: `https://gntijouqttihazdupoiu.supabase.co/functions/v1/asap-crm/api/twilio/calls/status`

Browser calling and click-to-call generate their own callback URLs from `TWILIO_WEBHOOK_BASE_URL`, so they will use the hosted API after the secret is updated.
