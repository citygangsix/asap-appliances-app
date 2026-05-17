# Hosted API Launch Blocker Note

Last checked: 2026-05-17 02:38 UTC

## Status

- Supabase project: `nexkymqahpkvzzlvivfi`
- Edge Function: `asap-crm`
- Expected repo deploy script: `npm run api:deploy`
- Direct deploy command used from this unlinked checkout:

```bash
supabase functions deploy asap-crm --project-ref nexkymqahpkvzzlvivfi --use-api --no-verify-jwt --import-map supabase/functions/import_map.json
```

The hosted `asap-crm` function was redeployed from the prepared source and moved to version 40.

## Verification

- `GET /health`: `200`
- `GET /api/hiring-candidates` without dashboard auth: `401`, no candidate data returned
- `GET /api/twilio/voice-token` without dashboard auth: `401`, no browser voice token returned
- `GET /api/hiring-candidates` with an invalid bearer token: `403`, no candidate data returned
- `OPTIONS /api/hiring-candidates`: `204`, includes `X-SignalWire-Signature` and `Authorization` in allowed headers after the Supabase Auth change is deployed
- `POST /api/service-requests` with a valid `dryRun: true` public payload: `200`

Source behavior was also checked locally: protected dashboard routes returned `401` without a Supabase bearer token when server auth env was configured, while the public dry-run service request route returned `200`.

## Superseded Auth Blocker

The shared dashboard API secret described below was replaced by Supabase Auth. Protected dashboard routes now require:

```text
Authorization: Bearer <supabase-user-access-token>
```

`ASAP_DASHBOARD_API_SECRET`, `ASAP_CRM_DASHBOARD_API_SECRET`, and `VITE_ASAP_DASHBOARD_API_SECRET` are no longer used.

## Redeploy Commands

Redeploy the function after preparing the Edge mirror:

```bash
npm run api:prepare
supabase functions deploy asap-crm --project-ref nexkymqahpkvzzlvivfi --use-api --no-verify-jwt --import-map supabase/functions/import_map.json
```

After deploying, rerun:

```bash
curl -i https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/hiring-candidates
curl -i https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/twilio/voice-token
curl -i -X POST https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm/api/service-requests \
  -H "Content-Type: application/json" \
  --data '{"name":"Hosted Smoke Test","phone":"5615550100","serviceAddress":"123 Test St, Boca Raton, FL","applianceType":"Washer","issueSummary":"Smoke test dry run","preferredTiming":"Tomorrow morning","smsConsent":true,"dryRun":true}'
```
