import { createQueryPlaceholder } from "../placeholders";

export function getRevenuePageQueryPlan() {
  return createQueryPlaceholder({
    key: "revenue.page",
    table: "invoices",
    operation: "composite_hydrated_select",
    details: "Load the Revenue page through focused invoice hydration plus focused technician payout hydration instead of the broad read-model snapshot.",
    joins: [
      "invoices.job_id -> jobs.job_id",
      "jobs.customer_id -> customers.customer_id",
      "invoices.servicing_tech_id -> technicians.tech_id (nullable)",
      "technician_payouts.tech_id -> technicians.tech_id",
      "technician_payout_invoice_links.invoice_id -> invoices.invoice_id",
    ],
    expectedShape: "RevenuePageData",
  });
}
