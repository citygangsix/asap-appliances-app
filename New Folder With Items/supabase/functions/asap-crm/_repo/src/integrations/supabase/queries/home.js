import { createQueryPlaceholder } from "../placeholders";

export function getHomeDashboardQueryPlan() {
  return createQueryPlaceholder({
    key: "home.dashboard",
    table: "jobs",
    operation: "composite_hydrated_select",
    details: "Load the Home dashboard through focused hydrated jobs, communications, invoices, and technicians reads while preserving static hiring candidates in repository page assembly.",
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "jobs.tech_id -> technicians.tech_id",
      "job_timeline_events.job_id -> jobs.job_id",
      "communications.job_id -> jobs.job_id (nullable)",
      "invoices.job_id -> jobs.job_id",
      "invoices.servicing_tech_id -> technicians.tech_id (nullable)",
      "technicians.tech_id -> jobs.tech_id (nullable)",
    ],
    expectedShape: "HomePageData",
  });
}
