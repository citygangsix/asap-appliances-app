import { createQueryPlaceholder } from "../placeholders";
import { COMMUNICATION_COLUMNS, CUSTOMER_COLUMNS, JOB_LIST_SELECT } from "./jobs";

const CUSTOMER_DIRECTORY_SELECT = `
  ${CUSTOMER_COLUMNS},
  communication_rows:communications(${COMMUNICATION_COLUMNS}),
  job_rows:jobs(${JOB_LIST_SELECT})
`;

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function listCustomersQuery() {
  return createQueryPlaceholder({
    key: "customers.list",
    table: "customers",
    operation: "select",
    details: "List customer rows ordered for CRM directory usage.",
    joins: [],
    expectedShape: "CustomerRow[]",
  });
}

export function getCustomerByIdQuery(customerId) {
  return createQueryPlaceholder({
    key: "customers.getById",
    table: "customers",
    operation: "select_by_id",
    details: `Filter by customer_id=${customerId}`,
    joins: [],
    expectedShape: "CustomerRow|null",
  });
}

export function getCustomerDirectoryQueryPlan() {
  return createQueryPlaceholder({
    key: "customers.directory",
    table: "customers",
    operation: "select",
    details: "Hydrate customer directory with open jobs, unresolved communications, and invoice balances.",
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "communications.customer_id -> customers.customer_id",
      "invoices.job_id -> jobs.job_id",
    ],
    expectedShape: "CustomersPageData",
  });
}

export function getCustomerProfileHydrationQueryPlan(customerId) {
  return createQueryPlaceholder({
    key: "customers.profile",
    table: "customers",
    operation: "hydrated_select_by_id",
    details: `Load customer profile aggregates and linked jobs for customer_id=${customerId}`,
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "communications.customer_id -> customers.customer_id",
      "invoices.job_id -> jobs.job_id",
      "jobs.tech_id -> technicians.tech_id",
    ],
    expectedShape: "CustomerRecord|null",
  });
}

export async function runListCustomerDirectoryQuery(client) {
  const result = await client
    .from("customers")
    .select(CUSTOMER_DIRECTORY_SELECT)
    .order("name", { ascending: true });

  return unwrapQueryResult("customers.directory", result) || [];
}

export async function runCustomerProfileQuery(client, customerId) {
  const result = await client
    .from("customers")
    .select(CUSTOMER_DIRECTORY_SELECT)
    .eq("customer_id", customerId)
    .maybeSingle();

  return unwrapQueryResult("customers.profile", result);
}
