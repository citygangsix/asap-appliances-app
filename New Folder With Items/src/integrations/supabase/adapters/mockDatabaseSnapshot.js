import { communications as mockCommunications } from "../../../data/mock/communications";
import { customers as mockCustomers } from "../../../data/mock/customers";
import { invoices as mockInvoices } from "../../../data/mock/invoices";
import { jobTimelineEvents as mockJobTimelineEvents } from "../../../data/mock/jobTimeline";
import { jobs as mockJobs } from "../../../data/mock/jobs";
import { payoutBatches as mockPayouts } from "../../../data/mock/revenue";
import { technicians as mockTechnicians } from "../../../data/mock/technicians";
import { addMinutes, parseTimeLabelToIso } from "../mappers/shared";
import { mapDomainInvoicePaymentStatusToDb } from "../mappers/invoices";
import { mapTimelineEventTypeToDb } from "../mappers/jobTimelineEvents";

const BASE_DATE = "2026-04-16";
const PREVIOUS_DATE = "2026-04-15";
const DEFAULT_TIMESTAMP = `${BASE_DATE}T08:00:00`;

function toLastContactAt(label) {
  return parseTimeLabelToIso(BASE_DATE, label) || DEFAULT_TIMESTAMP;
}

function toJobEta(job) {
  const minuteMatch = job.etaLabel.match(/(\d+)\s+min/i);
  const scheduledAt = parseTimeLabelToIso(BASE_DATE, job.scheduledStartLabel) || DEFAULT_TIMESTAMP;

  if (minuteMatch) {
    return {
      etaAt: addMinutes(scheduledAt, Number(minuteMatch[1])),
      etaWindowText: null,
    };
  }

  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(job.etaLabel)) {
    return {
      etaAt: parseTimeLabelToIso(BASE_DATE, job.etaLabel),
      etaWindowText: null,
    };
  }

  return {
    etaAt: null,
    etaWindowText: job.etaLabel,
  };
}

function toLatenessMinutes(label) {
  const minuteMatch = label.match(/(\d+)\s+min/i);
  return minuteMatch ? Number(minuteMatch[1]) : null;
}

function toEventAt(label) {
  return parseTimeLabelToIso(BASE_DATE, label) || DEFAULT_TIMESTAMP;
}

function toInvoicePaidAt(invoice) {
  return mapDomainInvoicePaymentStatusToDb(invoice.paymentStatus) === "paid"
    ? `${invoice.issuedOn}T17:00:00`
    : null;
}

function toInvoiceFailedAt(invoice) {
  return invoice.paymentStatus === "failed" ? `${invoice.issuedOn}T10:06:00` : null;
}

function toPayoutPeriodStart() {
  return PREVIOUS_DATE;
}

function toPayoutPeriodEnd() {
  return BASE_DATE;
}

export function getMockDatabaseSnapshot() {
  const customerRows = mockCustomers.map((customer) => ({
    customer_id: customer.customerId,
    name: customer.name,
    primary_phone: customer.primaryPhone,
    secondary_phone: null,
    email: null,
    city: customer.city,
    service_area: customer.serviceArea,
    customer_segment: customer.customerSegment,
    communication_status: customer.communicationStatus,
    last_contact_at: toLastContactAt(customer.lastContactLabel),
    lifetime_value: customer.lifetimeValue,
    notes: null,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
  }));

  const technicianRows = mockTechnicians.map((technician) => ({
    tech_id: technician.techId,
    name: technician.name,
    primary_phone: null,
    email: null,
    service_area: technician.serviceArea,
    skills: technician.skills,
    availability_notes: technician.availabilityLabel,
    status_today: technician.statusToday,
    jobs_completed_this_week: technician.jobsCompletedThisWeek,
    callback_rate_percent: technician.callbackRatePercent,
    payout_total: technician.payoutTotal,
    gas_reimbursement_total: technician.gasReimbursementTotal,
    score: technician.score,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
  }));

  const jobRows = mockJobs.map((job) => {
    const { etaAt, etaWindowText } = toJobEta(job);

    return {
      job_id: job.jobId,
      customer_id: job.customerId,
      tech_id: job.techId,
      appliance_label: job.applianceLabel,
      appliance_brand: job.applianceBrand,
      issue_summary: job.issueSummary,
      service_address: job.serviceAddress,
      scheduled_start_at: parseTimeLabelToIso(BASE_DATE, job.scheduledStartLabel) || DEFAULT_TIMESTAMP,
      eta_at: etaAt,
      eta_window_text: etaWindowText,
      en_route_at: job.lifecycleStatus === "en_route" ? DEFAULT_TIMESTAMP : null,
      onsite_at: job.lifecycleStatus === "onsite" ? DEFAULT_TIMESTAMP : null,
      completed_at: job.lifecycleStatus === "completed" ? `${BASE_DATE}T17:30:00` : null,
      canceled_at: job.lifecycleStatus === "canceled" ? `${BASE_DATE}T11:00:00` : null,
      return_requested_at: job.lifecycleStatus === "return_scheduled" ? `${PREVIOUS_DATE}T16:45:00` : null,
      return_scheduled_at: job.lifecycleStatus === "return_scheduled" ? `${BASE_DATE}T13:15:00` : null,
      lifecycle_status: job.lifecycleStatus,
      dispatch_status: job.dispatchStatus,
      payment_status: job.paymentStatus,
      parts_status: job.partsStatus,
      communication_status: job.communicationStatus,
      customer_updated: job.customerUpdated,
      priority: job.priority,
      lateness_minutes: toLatenessMinutes(job.etaLabel) || toLatenessMinutes(job.latenessLabel),
      internal_notes: job.internalNotes,
      created_at: DEFAULT_TIMESTAMP,
      updated_at: DEFAULT_TIMESTAMP,
    };
  });

  const invoiceRows = mockInvoices.map((invoice) => ({
    invoice_id: invoice.invoiceId,
    invoice_number: invoice.invoiceId,
    job_id: invoice.jobId,
    servicing_tech_id: invoice.techId,
    invoice_type: invoice.invoiceType,
    payment_status: mapDomainInvoicePaymentStatusToDb(invoice.paymentStatus),
    issued_on: invoice.issuedOn,
    due_on: invoice.dueOn,
    paid_at: toInvoicePaidAt(invoice),
    currency_code: "USD",
    total_amount: invoice.totalAmount,
    collected_amount: invoice.collectedAmount,
    outstanding_balance: invoice.outstandingBalance,
    processor_reference: null,
    payment_failed_at: toInvoiceFailedAt(invoice),
    notes: null,
    created_at: `${invoice.issuedOn}T08:00:00`,
    updated_at: `${invoice.issuedOn}T08:00:00`,
  }));

  const communicationRows = mockCommunications.map((entry) => ({
    communication_id: entry.communicationId,
    customer_id: entry.customerId,
    job_id: entry.linkedJobId,
    invoice_id: entry.invoiceId,
    communication_channel: entry.communicationChannel,
    direction: "inbound",
    communication_status: entry.communicationStatus,
    preview_text: entry.previewText,
    transcript_text: entry.transcriptText,
    extracted_event_summary: entry.extractedEventLabel,
    from_number: null,
    to_number: null,
    provider_name: null,
    provider_message_sid: null,
    provider_call_sid: null,
    occurred_at: DEFAULT_TIMESTAMP,
    started_at: null,
    ended_at: null,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
  }));

  const technicianPayoutRows = mockPayouts.map((payout) => ({
    payout_id: payout.payoutId,
    tech_id: payout.techId,
    payout_number: payout.payoutId.toUpperCase(),
    period_start: toPayoutPeriodStart(),
    period_end: toPayoutPeriodEnd(),
    payout_status: payout.status,
    gross_amount: payout.amount,
    gas_reimbursement_amount: 0,
    adjustment_amount: 0,
    net_amount: payout.amount,
    note: payout.note,
    scheduled_for: `${BASE_DATE}T18:00:00`,
    paid_at: payout.status === "ready" ? `${BASE_DATE}T18:30:00` : null,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
  }));

  const technicianPayoutInvoiceLinkRows = mockPayouts.flatMap((payout) =>
    payout.invoiceIds.map((invoiceId) => ({
      payout_id: payout.payoutId,
      invoice_id: invoiceId,
      allocated_amount: Math.max(1, Math.round((payout.amount / payout.invoiceIds.length) * 100) / 100),
      created_at: DEFAULT_TIMESTAMP,
    })),
  );

  const jobTimelineEventRows = mockJobTimelineEvents.map((event) => ({
    event_id: event.eventId,
    job_id: event.jobId,
    actor_type: event.actorType,
    actor_label: event.actorLabel,
    event_type: mapTimelineEventTypeToDb(event.eventType),
    event_at: toEventAt(event.eventAtLabel),
    summary: event.summary,
    details: event.details,
    metadata: {},
    created_at: DEFAULT_TIMESTAMP,
  }));

  return {
    customerRows,
    technicianRows,
    jobRows,
    invoiceRows,
    communicationRows,
    technicianPayoutRows,
    technicianPayoutInvoiceLinkRows,
    jobTimelineEventRows,
  };
}
