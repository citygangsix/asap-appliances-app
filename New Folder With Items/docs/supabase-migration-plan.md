# ASAP Operations CRM Migration Plan

## Migration Order

1. Create shared database objects first:
   - `pgcrypto` extension
   - `set_updated_at()` trigger function
   - workflow enums
2. Create root tables with no foreign-key dependencies:
   - `customers`
   - `technicians`
3. Create `jobs`:
   - depends on `customers`
   - optionally references `technicians`
4. Create `invoices`:
   - depends on `jobs`
   - optionally references `technicians`
5. Create `communications`:
   - depends on `customers`
   - optionally references `jobs` and `invoices`
6. Create `technician_payouts`:
   - depends on `technicians`
7. Create `technician_payout_invoice_links`:
   - depends on `technician_payouts`
   - depends on `invoices`
8. Create `job_timeline_events`:
   - depends on `jobs`
9. Create indexes, update triggers, and computed reporting views last.

## Schema Changes From The Earlier Draft

- Primary keys are now `uuid` columns with `gen_random_uuid()` defaults instead of text IDs.
- `customers.active_job_id` was removed.
  It is a convenience field and can be derived from open jobs.
- `jobs.invoice_id` was removed.
  A job can have multiple invoices, so the relationship should live on `invoices.job_id`.
- `invoices.customer_id` was removed.
  Customer context should come from `invoices -> jobs -> customers`.
- `communications.linked_job_id` was normalized to `communications.job_id`.
- Label-style fields were replaced with canonical database fields:
  - `scheduledStartLabel` -> `jobs.scheduled_start_at`
  - `etaLabel` -> `jobs.eta_at` plus optional `jobs.eta_window_text`
  - `latenessLabel` -> `jobs.lateness_minutes`
  - `lastContactLabel` -> `customers.last_contact_at`
  - `eventAtLabel` -> `job_timeline_events.event_at`
- Invoice payment state now uses a dedicated `invoice_payment_status` enum instead of reusing the job payment workflow enum.
- `technician_payouts.invoiceIds` was replaced by the join table `technician_payout_invoice_links`.
- `revenue_summaries` is not a stored table.
  It should be computed from invoices, or from invoices plus payouts, via views or reporting queries.

## Pre-Apply Guardrails Confirmed

- `invoices.job_id` remains `not null`.
  Detached invoices are not needed in the current appliance-repair workflow, so every invoice must belong to a job.
- `communications.job_id` remains nullable.
  This supports inbound calls or texts that have not been matched to a job yet.
- `jobs.scheduled_start_at` and `jobs.eta_at` are canonical `timestamptz` fields.
  The database no longer depends on label-style strings for scheduling.
- `job_timeline_events.event_type` is protected by a dedicated enum.
  New event types must be added by migration, which prevents arbitrary values from creeping into the event log.

## Fields Removed Or Replaced For Normalization

- Removed `customers.active_job_id` because it duplicates open-job state.
- Removed `jobs.invoice_id` because it incorrectly implies one invoice per job.
- Removed `invoices.customer_id` because it duplicates customer ownership already present on `jobs`.
- Replaced display-only date/time labels with timestamps or numeric state fields so the UI can format them later.
- Replaced the payout invoice array with relational link rows so one payout can cover many invoices without storing arrays in the main table.

## Table Notes

### `customers`
- Why it exists:
  stores the canonical customer/contact record for CRM and communications.
- Frontend mapping:
  `Customer.customerId` maps to `customers.customer_id`, and `lastContactLabel` should be derived from `last_contact_at`.

### `technicians`
- Why it exists:
  stores technician identity, service area, and scorecard metrics used across dispatch and payouts.
- Frontend mapping:
  `Technician.techId` maps to `technicians.tech_id`, and `availabilityLabel` should be derived from `availability_notes`.

### `jobs`
- Why it exists:
  stores the operational state machine for service work and owns the main customer relationship.
- Frontend mapping:
  `Job.jobId` maps to `jobs.job_id`; display labels should be built from canonical timestamp and numeric fields.

### `invoices`
- Why it exists:
  stores billable records attached to a job, including collection state and invoice type.
- Frontend mapping:
  `Invoice.invoiceId` maps to `invoices.invoice_id`; customer context is joined through `jobs`.

### `communications`
- Why it exists:
  stores inbound/outbound call and text history with optional links to jobs and invoices.
- Frontend mapping:
  `Communication.linkedJobId` should map through `communications.job_id`, and time labels should come from `occurred_at`.

### `technician_payouts`
- Why it exists:
  stores payout batches for technicians, separate from invoice and job records.
- Frontend mapping:
  `TechnicianPayout.payoutId` maps to `technician_payouts.payout_id`, while invoice relationships come from the join table.

### `technician_payout_invoice_links`
- Why it exists:
  links many invoices to a payout batch without storing invoice arrays.
- Frontend mapping:
  `TechnicianPayout.invoiceIds` should be hydrated from these link rows.

### `job_timeline_events`
- Why it exists:
  stores immutable job history for auditability, dispatch review, and future automation.
- Frontend mapping:
  `JobTimelineEvent.eventId` maps to `job_timeline_events.event_id`, and `eventAtLabel` should be formatted from `event_at`.

## Recommendation On Job And Invoice Cardinality

Invoices should be one-to-many from jobs.

- Keep `invoices.job_id` as the owning relationship.
- Do not add `jobs.invoice_id`.
- A single service job can reasonably generate multiple invoice records:
  parts deposit, parts payment, labor invoice, or adjusted follow-up billing.
- If the UI later needs a “primary invoice,” derive it in a view or repository layer rather than denormalizing the base schema.
