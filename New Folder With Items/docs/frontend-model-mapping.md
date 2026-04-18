# Frontend Model to Current Supabase Schema Mapping

This document reflects the normalized schema implemented by `supabase/migrations/20260416_000001_asap_operations_core.sql`.
If this file and the migration ever disagree, treat the migration as canonical.

## Job -> `jobs`

- `jobId` -> `jobs.job_id`
- `customerId` -> `jobs.customer_id`
- `techId` -> `jobs.tech_id`
- `applianceLabel` -> `jobs.appliance_label`
- `applianceBrand` -> `jobs.appliance_brand`
- `issueSummary` -> `jobs.issue_summary`
- `serviceAddress` -> `jobs.service_address`
- `scheduledStartLabel` -> derived from `jobs.scheduled_start_at`
- `lifecycleStatus` -> `jobs.lifecycle_status`
- `dispatchStatus` -> `jobs.dispatch_status`
- `paymentStatus` -> `jobs.payment_status`
- `partsStatus` -> `jobs.parts_status`
- `communicationStatus` -> `jobs.communication_status`
- `customerUpdated` -> `jobs.customer_updated`
- `etaLabel` -> derived from `jobs.eta_at` with optional `jobs.eta_window_text`
- `latenessLabel` -> derived from `jobs.lateness_minutes` plus workflow state
- `priority` -> `jobs.priority`
- `internalNotes` -> `jobs.internal_notes`

Notes:

- The database no longer stores `jobs.invoice_id`.
  Jobs can have many invoices through `invoices.job_id`.
- The frontend still exposes label-first scheduling fields.
  Repository adapters format those labels from canonical timestamp columns.

## Customer -> `customers`

- `customerId` -> `customers.customer_id`
- `name` -> `customers.name`
- `primaryPhone` -> `customers.primary_phone`
- `secondaryPhone` -> `customers.secondary_phone`
- `email` -> `customers.email`
- `city` -> `customers.city`
- `serviceArea` -> `customers.service_area`
- `customerSegment` -> `customers.customer_segment`
- `communicationStatus` -> `customers.communication_status`
- `lastContactLabel` -> derived from `customers.last_contact_at`
- `lifetimeValue` -> `customers.lifetime_value`
- `notes` -> `customers.notes`

Note:

- `customers.activeJobId` is not a stored column anymore.
  It should be derived from open jobs.

## Technician -> `technicians`

- `techId` -> `technicians.tech_id`
- `name` -> `technicians.name`
- `primaryPhone` -> `technicians.primary_phone`
- `email` -> `technicians.email`
- `serviceArea` -> `technicians.service_area`
- `skills` -> `technicians.skills`
- `availabilityLabel` -> derived from `technicians.availability_notes`
- `statusToday` -> `technicians.status_today`
- `jobsCompletedThisWeek` -> `technicians.jobs_completed_this_week`
- `callbackRatePercent` -> `technicians.callback_rate_percent`
- `payoutTotal` -> `technicians.payout_total`
- `gasReimbursementTotal` -> `technicians.gas_reimbursement_total`
- `score` -> `technicians.score`

## Communication -> `communications`

- `communicationId` -> `communications.communication_id`
- `customerId` -> `communications.customer_id`
- `linkedJobId` -> `communications.job_id`
- `invoiceId` -> `communications.invoice_id`
- `communicationChannel` -> `communications.communication_channel`
- `communicationStatus` -> `communications.communication_status`
- `previewText` -> `communications.preview_text`
- `transcriptText` -> `communications.transcript_text`
- `extractedEventLabel` -> `communications.extracted_event_summary`

Notes:

- `communications.job_id` is intentionally nullable.
- Direction and provider identifiers live only in the database model today; the frontend model does not surface them yet.

## Invoice -> `invoices`

- `invoiceId` -> `invoices.invoice_id`
- `jobId` -> `invoices.job_id`
- `techId` -> `invoices.servicing_tech_id`
- `issuedOn` -> `invoices.issued_on`
- `dueOn` -> `invoices.due_on`
- `totalAmount` -> `invoices.total_amount`
- `collectedAmount` -> `invoices.collected_amount`
- `outstandingBalance` -> `invoices.outstanding_balance`
- `paymentStatus` -> derived from `invoices.payment_status` plus `invoices.invoice_type`
- `invoiceType` -> `invoices.invoice_type`

Notes:

- `invoices.job_id` is required and remains the owning relationship.
- Customer context is derived through `invoices -> jobs -> customers`; there is no `invoices.customer_id`.

## TechnicianPayout -> `technician_payouts` and `technician_payout_invoice_links`

- `payoutId` -> `technician_payouts.payout_id`
- `techId` -> `technician_payouts.tech_id`
- `amount` -> derived from `technician_payouts.net_amount`
- `status` -> `technician_payouts.payout_status`
- `note` -> `technician_payouts.note`
- `invoiceIds` -> hydrated from `technician_payout_invoice_links.invoice_id`

## JobTimelineEvent -> `job_timeline_events`

- `eventId` -> `job_timeline_events.event_id`
- `jobId` -> `job_timeline_events.job_id`
- `actorType` -> `job_timeline_events.actor_type`
- `actorLabel` -> `job_timeline_events.actor_label`
- `eventType` -> `job_timeline_events.event_type`
- `eventAtLabel` -> derived from `job_timeline_events.event_at`
- `summary` -> `job_timeline_events.summary`
- `details` -> `job_timeline_events.details`

Note:

- `job_timeline_events.event_type` is a closed enum in the database.
  Legacy mock-only aliases must be mapped before insert.

## Read-Model Notes

- `JobRecord.invoice` is currently a derived primary invoice selection over the one-to-many `invoices.job_id` relation.
- `JobRecord.communications` and `JobRecord.timelineEvents` are hydrated in the repository/adapter layer, not by pages.
- The Jobs page should only read through the repository contract, never through mock imports or raw Supabase helpers.
