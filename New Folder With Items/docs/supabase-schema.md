# ASAP Operations CRM Supabase Schema Summary

This is a human-readable summary of the live schema implemented by the migrations in `supabase/migrations/`.
Use the migration files as the backend source of truth.

## Core Guardrails

- `invoices.job_id` is required.
- `communications.job_id` is nullable.
- `jobs.scheduled_start_at` and `jobs.eta_at` are the canonical scheduling timestamps.
- `job_timeline_events.event_type` is a constrained enum, not a free-form string.
- `jobs.invoice_id` does not exist.
- `invoices.customer_id` does not exist.
- `customers.active_job_id` does not exist.
- Public service requests write to `customers` and `jobs`; there is no separate `service_requests` table in the current production path.
- Hiring candidate capture writes to `hiring_candidates` and can promote onboarded candidates into `technicians`.
- Outbound call/SMS compliance writes to `outbound_contact_attempts` and customer opt-out/cooldown columns.

## Enums

### `job_lifecycle_status`

- `new`
- `scheduled`
- `en_route`
- `onsite`
- `paused`
- `return_scheduled`
- `pending_installation`
- `pending_repair`
- `completed`
- `canceled`
- `declined`
- `diagnostic_paid_declined_repair`
- `closed`
- `no_work_needed`
- `paid_closed`

### `job_dispatch_status`

- `unassigned`
- `assigned`
- `confirmed`
- `late`
- `escalated`

### `job_payment_status`

- `none_due`
- `parts_due`
- `parts_paid`
- `labor_due`
- `labor_paid`
- `partial`
- `failed`

### `job_parts_status`

- `none_needed`
- `quoted`
- `awaiting_payment`
- `ready_to_order`
- `ordered`
- `shipped`
- `delivered`
- `installed`

### `communication_status`

- `clear`
- `awaiting_callback`
- `unread_message`
- `unresolved`

### `communication_channel`

- `text`
- `call`

### `communication_direction`

- `inbound`
- `outbound`

### `invoice_type`

- `parts_deposit`
- `labor`
- `parts_and_labor`
- `parts_payment`

### `invoice_payment_status`

- `draft`
- `open`
- `partial`
- `paid`
- `failed`
- `void`

### `job_priority`

- `normal`
- `high`
- `escalated`

### `technician_status_today`

- `unassigned`
- `en_route`
- `onsite`
- `late`

### `timeline_actor_type`

- `assistant`
- `technician`
- `dispatch`
- `system`
- `customer`

### `timeline_event_type`

- `job_created`
- `scheduled`
- `tech_assigned`
- `dispatch_updated`
- `communication_logged`
- `eta_updated`
- `en_route`
- `onsite`
- `parts_requested`
- `parts_ordered`
- `payment_requested`
- `payment_received`
- `return_scheduled`
- `completed`
- `canceled`
- `note_added`

### `payout_status`

- `ready`
- `pending`
- `partial`
- `retry`

## Tables

### `customers`

Primary key:

- `customer_id uuid`

Key columns:

- `name text not null`
- `primary_phone text not null`
- `secondary_phone text null`
- `email text null`
- `city text not null`
- `service_area text not null`
- `customer_segment text not null`
- `communication_status communication_status not null`
- `last_contact_at timestamptz null`
- `lifetime_value numeric(12,2) not null default 0`
- `notes text null`
- `sms_opted_out_at timestamptz null`
- `voice_opted_out_at timestamptz null`
- `auto_contact_cooldown_until timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `technicians`

Primary key:

- `tech_id uuid`

Key columns:

- `name text not null`
- `primary_phone text null`
- `email text null`
- `service_area text not null`
- `service_zip_codes text[] not null default '{}'`
- `skills text[] not null`
- `hire_start_date date null`
- `availability_notes text null`
- `availability_days text[] not null default '{}'`
- `availability_time_preferences text[] not null default '{}'`
- `status_today technician_status_today not null`
- `jobs_completed_this_week integer not null default 0`
- `callback_rate_percent numeric(5,2) not null default 0`
- `payout_total numeric(12,2) not null default 0`
- `gas_reimbursement_total numeric(12,2) not null default 0`
- `score integer not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `jobs`

Primary key:

- `job_id uuid`

Foreign keys:

- `customer_id -> customers.customer_id` required
- `tech_id -> technicians.tech_id` nullable

Key columns:

- `appliance_label text not null`
- `appliance_brand text null`
- `issue_summary text not null`
- `service_address text not null`
- `scheduled_start_at timestamptz not null`
- `eta_at timestamptz null`
- `eta_window_text text null`
- `en_route_at timestamptz null`
- `onsite_at timestamptz null`
- `completed_at timestamptz null`
- `canceled_at timestamptz null`
- `return_requested_at timestamptz null`
- `return_scheduled_at timestamptz null`
- `lifecycle_status job_lifecycle_status not null`
- `dispatch_status job_dispatch_status not null`
- `payment_status job_payment_status not null`
- `parts_status job_parts_status not null`
- `communication_status communication_status not null`
- `customer_updated boolean not null default false`
- `priority job_priority not null`
- `lateness_minutes integer null`
- `internal_notes text null`
- `dispatch_confirmation_requested_at timestamptz null`
- `dispatch_confirmation_received_at timestamptz null`
- `dispatch_response_minutes integer null`
- `technician_confirmation_response text null`
- `payment_collected_before_tech_left boolean null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `invoices`

Primary key:

- `invoice_id uuid`

Foreign keys:

- `job_id -> jobs.job_id` required
- `servicing_tech_id -> technicians.tech_id` nullable

Key columns:

- `invoice_number text not null unique`
- `invoice_type invoice_type not null`
- `payment_status invoice_payment_status not null`
- `issued_on date not null`
- `due_on date null`
- `paid_at timestamptz null`
- `currency_code char(3) not null default 'USD'`
- `total_amount numeric(12,2) not null`
- `collected_amount numeric(12,2) not null default 0`
- `outstanding_balance numeric(12,2) not null`
- `processor_reference text null`
- `payment_failed_at timestamptz null`
- `notes text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `communications`

Primary key:

- `communication_id uuid`

Foreign keys:

- `customer_id -> customers.customer_id` required
- `job_id -> jobs.job_id` nullable
- `invoice_id -> invoices.invoice_id` nullable

Key columns:

- `communication_channel communication_channel not null`
- `direction communication_direction not null`
- `communication_status communication_status not null`
- `preview_text text not null`
- `transcript_text text null`
- `call_highlights text null`
- `call_summary_sections jsonb null`
- `transcription_status text null`
- `transcription_error text null`
- `transcribed_at timestamptz null`
- `extracted_event_summary text null`
- `from_number text null`
- `to_number text null`
- `provider_name text null`
- `provider_message_sid text null`
- `provider_call_sid text null`
- `occurred_at timestamptz not null`
- `started_at timestamptz null`
- `ended_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `unmatched_inbound_communications`

Primary key:

- `unmatched_communication_id uuid`

Foreign keys:

- `linked_customer_id -> customers.customer_id` nullable
- `linked_job_id -> jobs.job_id` nullable
- `linked_communication_id -> communications.communication_id` nullable

Key columns:

- `communication_channel communication_channel not null`
- `direction communication_direction not null`
- `communication_status communication_status not null`
- `match_status text not null`
- `resolution_status text not null`
- `from_number text null`
- `to_number text null`
- `preview_text text not null`
- `transcript_text text null`
- `call_highlights text null`
- `call_summary_sections jsonb null`
- `transcription_status text null`
- `transcription_error text null`
- `transcribed_at timestamptz null`
- `provider_name text not null`
- `provider_message_sid text null`
- `provider_call_sid text null`
- `raw_payload jsonb not null`
- `occurred_at timestamptz not null`
- `started_at timestamptz null`
- `ended_at timestamptz null`
- `resolution_notes text null`
- `resolved_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `hiring_candidates`

Primary key:

- `candidate_id uuid`

Foreign keys:

- `linked_communication_id -> communications.communication_id` nullable
- `promoted_tech_id -> technicians.tech_id` nullable

Key columns:

- `name text not null`
- `primary_phone text null unique when present`
- `email text null`
- `source text null`
- `stage text not null`
- `trade text null`
- `city text null`
- `service_area text null`
- `structured_start_date date null`
- `availability_summary text null`
- `availability_days text[] not null default '{}'`
- `availability_time_preferences text[] not null default '{}'`
- `current_job_status text null`
- `tools_status text null`
- `vehicle_status text null`
- `tools_vehicle_summary text null`
- `payout_expectation_summary text null`
- `experience_summary text null`
- `appliance_experience_summary text null`
- `other_work_experience_summary text null`
- `next_step text null`
- `call_highlights text null`
- `transcript_text text null`
- `provider_call_sid text null unique when present`
- `promoted_at timestamptz null`
- `raw_analysis jsonb not null`
- `last_contact_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `technician_payouts`

Primary key:

- `payout_id uuid`

Foreign keys:

- `tech_id -> technicians.tech_id` required

Key columns:

- `payout_number text null unique`
- `period_start date not null`
- `period_end date not null`
- `payout_status payout_status not null`
- `gross_amount numeric(12,2) not null`
- `gas_reimbursement_amount numeric(12,2) not null`
- `adjustment_amount numeric(12,2) not null`
- `net_amount numeric(12,2) generated stored`
- `note text null`
- `scheduled_for timestamptz null`
- `paid_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `technician_payout_invoice_links`

Composite primary key:

- `(payout_id, invoice_id)`

Foreign keys:

- `payout_id -> technician_payouts.payout_id` required
- `invoice_id -> invoices.invoice_id` required

Key columns:

- `allocated_amount numeric(12,2) not null`
- `created_at timestamptz not null`

### `twilio_voice_recordings`

Primary key:

- `recording_id uuid`

Foreign keys:

- `linked_communication_id -> communications.communication_id` nullable

Key columns:

- `provider_name text not null`
- `provider_account_sid text null`
- `provider_call_sid text null`
- `provider_parent_call_sid text null`
- `provider_recording_sid text not null unique`
- `recording_status text null`
- `recording_source text null`
- `recording_track text null`
- `recording_channels integer null`
- `recording_duration_seconds integer null`
- `recording_url text null`
- `transcript_text text null`
- `call_headline text null`
- `call_highlights text null`
- `call_summary_sections jsonb null`
- `transcription_status text null`
- `transcription_error text null`
- `transcribed_at timestamptz null`
- `raw_payload jsonb not null`
- `callback_received_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `outbound_contact_attempts`

Primary key:

- `attempt_id uuid`

Foreign keys:

- `customer_id -> customers.customer_id` nullable
- `communication_id -> communications.communication_id` nullable

Key columns:

- `trigger_source text not null`
- `is_automated boolean not null default false`
- `attempt_channel communication_channel not null`
- `customer_number text not null`
- `provider_call_sid text null`
- `provider_parent_call_sid text null`
- `provider_message_sid text null unique when present`
- `outcome text not null`
- `outcome_detail text null`
- `requested_at timestamptz not null`
- `completed_at timestamptz null`
- `cooldown_applied_until timestamptz null`
- `raw_payload jsonb not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### `job_timeline_events`

Primary key:

- `event_id uuid`

Foreign keys:

- `job_id -> jobs.job_id` required

Key columns:

- `actor_type timeline_actor_type not null`
- `actor_label text not null`
- `event_type timeline_event_type not null`
- `event_at timestamptz not null`
- `summary text not null`
- `details text null`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null`

## Jobs Rollout Notes

- The frontend Jobs page still consumes a label-first `JobRecord`.
- Supabase adapters currently derive display labels like `scheduledStartLabel`, `etaLabel`, and `latenessLabel`.
- `JobRecord.invoice` is currently a derived primary invoice over the one-to-many invoices relation.
- Live Supabase job IDs are UUIDs, so the current UI shows UUIDs directly.
