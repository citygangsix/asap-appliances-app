import { createQueryPlaceholder } from "../placeholders";
import {
  CUSTOMER_COLUMNS,
  INVOICE_COLUMNS,
  JOB_COLUMNS,
  TECHNICIAN_COLUMNS,
} from "./jobs";

const HYDRATED_INVOICE_JOB_SELECT = `
  ${JOB_COLUMNS},
  customer:customers!jobs_customer_id_fkey(${CUSTOMER_COLUMNS})
`;

const HYDRATED_INVOICE_SELECT = `
  ${INVOICE_COLUMNS},
  job:jobs!invoices_job_id_fkey(
    ${HYDRATED_INVOICE_JOB_SELECT}
  ),
  technician:technicians!invoices_servicing_tech_id_fkey(${TECHNICIAN_COLUMNS})
`;

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function listInvoicesQuery() {
  return createQueryPlaceholder({
    key: "invoices.list",
    table: "invoices",
    operation: "select",
    details: "List invoice rows ordered by issued_on desc.",
    joins: [],
    expectedShape: "InvoiceRow[]",
  });
}

export function getInvoicesCollectionsQueryPlan() {
  return createQueryPlaceholder({
    key: "invoices.collections",
    table: "invoices",
    operation: "hydrated_select",
    details: "Load invoices page with job, customer, and technician context for collections and retry views.",
    joins: [
      "invoices.job_id -> jobs.job_id",
      "jobs.customer_id -> customers.customer_id",
      "invoices.servicing_tech_id -> technicians.tech_id (nullable)",
    ],
    expectedShape: "InvoicesPageData",
  });
}

export function getInvoiceDetailQueryPlan(invoiceId) {
  return createQueryPlaceholder({
    key: "invoices.detail",
    table: "invoices",
    operation: "hydrated_select_by_id",
    details: `Load invoice detail with owning job, derived customer context, and invoice technician for invoice_id=${invoiceId}`,
    joins: [
      "invoices.job_id -> jobs.job_id",
      "jobs.customer_id -> customers.customer_id",
      "invoices.servicing_tech_id -> technicians.tech_id (nullable)",
    ],
    expectedShape: "InvoiceRecord|null",
  });
}

export async function runListInvoicesCollectionsQuery(client) {
  const result = await client
    .from("invoices")
    .select(HYDRATED_INVOICE_SELECT)
    .order("issued_on", { ascending: false })
    .order("created_at", { ascending: false });

  return unwrapQueryResult("invoices.collections", result) || [];
}

export async function runInvoiceDetailQuery(client, invoiceId) {
  const result = await client
    .from("invoices")
    .select(HYDRATED_INVOICE_SELECT)
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  return unwrapQueryResult("invoices.detail", result);
}
