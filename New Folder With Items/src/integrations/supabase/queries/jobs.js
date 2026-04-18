import { createQueryPlaceholder } from "../placeholders";

export const JOB_COLUMNS = `
  job_id,
  customer_id,
  tech_id,
  appliance_label,
  appliance_brand,
  issue_summary,
  service_address,
  scheduled_start_at,
  eta_at,
  eta_window_text,
  en_route_at,
  onsite_at,
  completed_at,
  canceled_at,
  return_requested_at,
  return_scheduled_at,
  lifecycle_status,
  dispatch_status,
  payment_status,
  parts_status,
  communication_status,
  customer_updated,
  priority,
  lateness_minutes,
  internal_notes,
  created_at,
  updated_at
`;

export const CUSTOMER_COLUMNS = `
  customer_id,
  name,
  primary_phone,
  secondary_phone,
  email,
  city,
  service_area,
  customer_segment,
  communication_status,
  last_contact_at,
  lifetime_value,
  notes,
  created_at,
  updated_at
`;

export const TECHNICIAN_COLUMNS = `
  tech_id,
  name,
  primary_phone,
  email,
  service_area,
  skills,
  availability_notes,
  status_today,
  jobs_completed_this_week,
  callback_rate_percent,
  payout_total,
  gas_reimbursement_total,
  score,
  created_at,
  updated_at
`;

export const INVOICE_COLUMNS = `
  invoice_id,
  invoice_number,
  job_id,
  servicing_tech_id,
  invoice_type,
  payment_status,
  issued_on,
  due_on,
  paid_at,
  currency_code,
  total_amount,
  collected_amount,
  outstanding_balance,
  processor_reference,
  payment_failed_at,
  notes,
  created_at,
  updated_at
`;

export const COMMUNICATION_COLUMNS = `
  communication_id,
  customer_id,
  job_id,
  invoice_id,
  communication_channel,
  direction,
  communication_status,
  preview_text,
  transcript_text,
  extracted_event_summary,
  from_number,
  to_number,
  provider_name,
  provider_message_sid,
  provider_call_sid,
  occurred_at,
  started_at,
  ended_at,
  created_at,
  updated_at
`;

export const TIMELINE_COLUMNS = `
  event_id,
  job_id,
  actor_type,
  actor_label,
  event_type,
  event_at,
  summary,
  details,
  metadata,
  created_at
`;

export const JOB_LIST_SELECT = `
  ${JOB_COLUMNS},
  customer:customers!jobs_customer_id_fkey(${CUSTOMER_COLUMNS}),
  technician:technicians!jobs_tech_id_fkey(${TECHNICIAN_COLUMNS}),
  invoice_rows:invoices(${INVOICE_COLUMNS}),
  communication_rows:communications(${COMMUNICATION_COLUMNS}),
  timeline_rows:job_timeline_events(${TIMELINE_COLUMNS})
`;

const JOB_DETAIL_SELECT = `
  ${JOB_COLUMNS},
  customer:customers!jobs_customer_id_fkey(${CUSTOMER_COLUMNS}),
  technician:technicians!jobs_tech_id_fkey(${TECHNICIAN_COLUMNS})
`;

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function listJobsQuery() {
  return createQueryPlaceholder({
    key: "jobs.list",
    table: "jobs",
    operation: "select",
    details: "List job rows ordered by scheduled_start_at.",
    joins: [],
    expectedShape: "JobRow[]",
  });
}

export async function runListJobsQuery(client) {
  const result = await client
    .from("jobs")
    .select(JOB_LIST_SELECT)
    .order("scheduled_start_at", { ascending: true });

  return unwrapQueryResult("jobs.list", result) || [];
}

export function getJobInvoicesQuery(jobId) {
  return createQueryPlaceholder({
    key: "jobs.invoices",
    table: "invoices",
    operation: "select_by_job",
    details: `Filter by job_id=${jobId}`,
    joins: [],
    expectedShape: "InvoiceRow[]",
  });
}

export async function runJobInvoicesQuery(client, jobId) {
  const result = await client
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("job_id", jobId)
    .order("issued_on", { ascending: false });

  return unwrapQueryResult("jobs.invoices", result) || [];
}

export function getJobTimelineQuery(jobId) {
  return createQueryPlaceholder({
    key: "jobs.timeline",
    table: "job_timeline_events",
    operation: "select_by_job",
    details: `Filter by job_id=${jobId}`,
    joins: [],
    expectedShape: "JobTimelineEventRow[]",
  });
}

export async function runJobTimelineQuery(client, jobId) {
  const result = await client
    .from("job_timeline_events")
    .select(TIMELINE_COLUMNS)
    .eq("job_id", jobId)
    .order("event_at", { ascending: true });

  return unwrapQueryResult("jobs.timeline", result) || [];
}

export function getJobsQueueQueryPlan() {
  return createQueryPlaceholder({
    key: "jobs.queue",
    table: "jobs",
    operation: "hydrated_select",
    details: "Load operations queue with customer, technician, invoice summary, communications, and timeline context.",
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "jobs.tech_id -> technicians.tech_id",
      "invoices.job_id -> jobs.job_id",
      "communications.job_id -> jobs.job_id",
      "job_timeline_events.job_id -> jobs.job_id",
    ],
    expectedShape: "JobsPageData",
  });
}

export function getJobDetailHydrationQueryPlan(jobId) {
  return createQueryPlaceholder({
    key: "jobs.detail",
    table: "jobs",
    operation: "hydrated_select_by_id",
    details: `Load fully hydrated job detail for job_id=${jobId}`,
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "jobs.tech_id -> technicians.tech_id",
      "invoices.job_id -> jobs.job_id",
      "communications.job_id -> jobs.job_id",
      "job_timeline_events.job_id -> jobs.job_id",
    ],
    expectedShape: "JobRecord|null",
  });
}

export async function runJobDetailQuery(client, jobId) {
  const result = await client
    .from("jobs")
    .select(JOB_DETAIL_SELECT)
    .eq("job_id", jobId)
    .maybeSingle();

  return unwrapQueryResult("jobs.detail", result);
}
