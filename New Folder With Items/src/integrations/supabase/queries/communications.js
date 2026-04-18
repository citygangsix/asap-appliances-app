import { createQueryPlaceholder } from "../placeholders";
import {
  COMMUNICATION_COLUMNS,
  CUSTOMER_COLUMNS,
  INVOICE_COLUMNS,
  JOB_COLUMNS,
  TECHNICIAN_COLUMNS,
} from "./jobs";

const HYDRATED_LINKED_JOB_SELECT = `
  ${JOB_COLUMNS},
  customer:customers!jobs_customer_id_fkey(${CUSTOMER_COLUMNS}),
  technician:technicians!jobs_tech_id_fkey(${TECHNICIAN_COLUMNS}),
  invoice_rows:invoices(${INVOICE_COLUMNS})
`;

const COMMUNICATION_FEED_SELECT = `
  ${COMMUNICATION_COLUMNS},
  customer:customers!communications_customer_id_fkey(${CUSTOMER_COLUMNS}),
  invoice:invoices(${INVOICE_COLUMNS}),
  linked_job:jobs(
    ${HYDRATED_LINKED_JOB_SELECT}
  )
`;

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

function applyCommunicationFeedFilters(query, filters = {}) {
  let nextQuery = query;

  if (filters.direction) {
    nextQuery = nextQuery.eq("direction", filters.direction);
  }

  if (filters.communicationStatus) {
    nextQuery = nextQuery.eq("communication_status", filters.communicationStatus);
  }

  if (filters.communicationChannel) {
    nextQuery = nextQuery.eq("communication_channel", filters.communicationChannel);
  }

  return nextQuery;
}

export function listCommunicationsQuery() {
  return createQueryPlaceholder({
    key: "communications.list",
    table: "communications",
    operation: "select",
    details: "List communication rows ordered by occurred_at desc with nullable job linkage.",
    joins: [],
    expectedShape: "CommunicationRow[]",
  });
}

export function getCommunicationsByJobQuery(jobId) {
  return createQueryPlaceholder({
    key: "communications.byJob",
    table: "communications",
    operation: "select_by_job",
    details: `Filter by job_id=${jobId}`,
    joins: [],
    expectedShape: "CommunicationRow[]",
  });
}

export async function runCommunicationsByJobQuery(client, jobId) {
  const result = await client
    .from("communications")
    .select(COMMUNICATION_COLUMNS)
    .eq("job_id", jobId)
    .order("occurred_at", { ascending: false });

  return unwrapQueryResult("communications.byJob", result) || [];
}

export function getCommunicationsFeedQueryPlan() {
  return createQueryPlaceholder({
    key: "communications.feed",
    table: "communications",
    operation: "hydrated_select",
    details:
      "Load call/text feed with linked customer, nullable job, linked technician, and optional invoice context for the communications page.",
    joins: [
      "communications.customer_id -> customers.customer_id",
      "communications.job_id -> jobs.job_id (nullable)",
      "communications.invoice_id -> invoices.invoice_id (nullable)",
      "jobs.tech_id -> technicians.tech_id",
    ],
    expectedShape: "CommunicationsPageData",
  });
}

export async function runListCommunicationsFeedQuery(client, filters = {}) {
  const result = await applyCommunicationFeedFilters(
    client.from("communications").select(COMMUNICATION_FEED_SELECT),
    filters,
  ).order("occurred_at", { ascending: false });

  return unwrapQueryResult("communications.feed", result) || [];
}

export function getCommunicationDetailQueryPlan(communicationId) {
  return createQueryPlaceholder({
    key: "communications.detail",
    table: "communications",
    operation: "hydrated_select_by_id",
    details: `Load communication detail with related customer, nullable job, technician, and invoice context for communication_id=${communicationId}`,
    joins: [
      "communications.customer_id -> customers.customer_id",
      "communications.job_id -> jobs.job_id (nullable)",
      "communications.invoice_id -> invoices.invoice_id (nullable)",
      "jobs.tech_id -> technicians.tech_id",
    ],
    expectedShape: "CommunicationRecord|null",
  });
}

export async function runCommunicationDetailQuery(client, communicationId) {
  const result = await client
    .from("communications")
    .select(COMMUNICATION_FEED_SELECT)
    .eq("communication_id", communicationId)
    .maybeSingle();

  return unwrapQueryResult("communications.detail", result);
}
