# Twilio Webhook Intake

## Required Server Env

Create `.env.server.local` in the app root and set:

- `SUPABASE_SERVICE_ROLE_KEY=...`
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_AUTH_TOKEN=...`
- `TWILIO_PHONE_NUMBER=...`
- `TWILIO_WEBHOOK_BASE_URL=...`
- `TWILIO_WEBHOOK_PORT=8787` (optional)

The webhook server also reads `VITE_SUPABASE_URL` from `.env.local` so it can connect to the live project.

Start from `.env.server.example` to avoid missing keys.

## Local Development

1. Run the app normally with `npm run dev`.
2. Run the webhook server with `npm run twilio:webhooks`.
3. Expose the webhook server publicly with your tunnel of choice.
4. Set `TWILIO_WEBHOOK_BASE_URL` to that public base URL.
5. In the Twilio console, point:
   - inbound messaging webhook to `POST /api/twilio/sms`
   - voice status callback webhook to `POST /api/twilio/calls/status`

## Current Matching Behavior

- Inbound SMS and call events try to match a customer by normalized phone number against:
  - `customers.primary_phone`
  - `customers.secondary_phone`
- `communications.job_id` remains nullable, so unmatched job linkage is not a blocker.
- `communications.customer_id` is still required.
- If no unique customer phone match exists, the webhook is accepted and written to `unmatched_inbound_communications` instead of `communications`.
- The unmatched record stays pending until office staff link it to a real existing customer from the Communications page.
- Linking can optionally attach the resulting communication to a job that belongs to that selected customer.
- This keeps fake customers and fake communication rows out of the system while still preserving the inbound event.

## Webhook Behavior

- `POST /api/twilio/sms`
  - validates Twilio signature
  - verifies `AccountSid`
  - verifies the `To` number matches `TWILIO_PHONE_NUMBER`
  - creates one inbound `communications` row per unique `MessageSid` when there is a unique customer match
  - otherwise creates or reuses one pending `unmatched_inbound_communications` row per unique `MessageSid`

- `POST /api/twilio/calls/status`
  - validates Twilio signature
  - verifies `AccountSid`
  - verifies the `To` number matches `TWILIO_PHONE_NUMBER`
  - logs inbound calls into `communications` when there is a unique customer match
  - otherwise creates or updates one pending `unmatched_inbound_communications` row by `CallSid`
  - updates the existing persisted row on later callbacks by `CallSid`

## Communications Triage Flow

1. Twilio posts inbound SMS or call events to the local webhook server.
2. The server tries to match the inbound `From` number to one unique customer.
3. If one customer matches, the event is written directly to `communications`.
4. If zero or multiple customers match, the event is written to `unmatched_inbound_communications`.
5. Office staff open the Communications page, review the unmatched item, choose an existing customer, and optionally choose one of that customer’s jobs.
6. The app creates the final `communications` row from the unmatched payload and marks the unmatched triage row as linked.

## Local Testing

### Matched inbound SMS

1. Start the app with `VITE_APP_DATA_SOURCE=supabase`.
2. Start the webhook server with `npm run twilio:webhooks`.
3. Ensure a customer exists whose `primary_phone` or `secondary_phone` matches the inbound Twilio `From` number.
4. Send an SMS to `TWILIO_PHONE_NUMBER`.
5. Confirm a new `communications` row appears in the Communications feed and no pending unmatched triage item is created for that `MessageSid`.

### Unmatched inbound SMS

1. Start the app and webhook server as above.
2. Send an SMS from a number that matches no customer, or from a number that currently matches multiple customers.
3. Confirm the webhook responds successfully and the event appears in the Communications page under the unmatched inbound triage queue.
4. Confirm no row is created in `communications` until manual linking happens.

### Link an unmatched event to an existing customer

1. Open the Communications page in live Supabase mode.
2. Select the pending unmatched inbound item.
3. Choose an existing customer.
4. Optionally choose one of that customer’s jobs.
5. Click `Link to customer`.
6. Confirm the unmatched triage item disappears from the pending queue and a normal `communications` row appears in the feed with the same inbound details.
