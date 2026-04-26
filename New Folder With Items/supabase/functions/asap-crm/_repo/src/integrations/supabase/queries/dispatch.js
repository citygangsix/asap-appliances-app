import { createQueryPlaceholder } from "../placeholders";
import { JOB_LIST_SELECT } from "./jobs";
import { TECHNICIAN_LIST_COLUMNS } from "./technicians";

export function getDispatchQueueQueryPlan() {
  return createQueryPlaceholder({
    key: "dispatch.queue",
    table: "jobs",
    operation: "hydrated_select",
    details: "Load active dispatch-board jobs with customer, technician, invoice, communication, and timeline context.",
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "jobs.tech_id -> technicians.tech_id",
      "invoices.job_id -> jobs.job_id",
      "communications.job_id -> jobs.job_id",
      "job_timeline_events.job_id -> jobs.job_id",
    ],
    expectedShape: "DispatchPageData",
  });
}

export function getDispatchUnassignedJobsQueryPlan() {
  return createQueryPlaceholder({
    key: "dispatch.unassigned",
    table: "jobs",
    operation: "hydrated_select",
    details: "Load active unassigned jobs for the dispatch queue.",
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "jobs.tech_id -> technicians.tech_id",
      "invoices.job_id -> jobs.job_id",
      "communications.job_id -> jobs.job_id",
      "job_timeline_events.job_id -> jobs.job_id",
    ],
    expectedShape: "JobRecord[]",
  });
}

export function getDispatchAttentionJobsQueryPlan() {
  return createQueryPlaceholder({
    key: "dispatch.attention",
    table: "jobs",
    operation: "hydrated_select",
    details: "Load active late or escalated jobs for dispatch review.",
    joins: [
      "jobs.customer_id -> customers.customer_id",
      "jobs.tech_id -> technicians.tech_id",
      "invoices.job_id -> jobs.job_id",
      "communications.job_id -> jobs.job_id",
      "job_timeline_events.job_id -> jobs.job_id",
    ],
    expectedShape: "JobRecord[]",
  });
}

export function getDispatchTechnicianAvailabilityQueryPlan() {
  return createQueryPlaceholder({
    key: "dispatch.technicians",
    table: "technicians",
    operation: "select",
    details: "Load technicians used by the Dispatch availability board.",
    joins: [],
    expectedShape: "Technician[]",
  });
}

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? [];
}

function buildDispatchJobsQuery(client) {
  return client
    .from("jobs")
    .select(JOB_LIST_SELECT)
    .neq("lifecycle_status", "completed")
    .neq("lifecycle_status", "canceled");
}

export async function runListDispatchBoardJobsQuery(client) {
  const result = await buildDispatchJobsQuery(client).order("scheduled_start_at", { ascending: true });
  return unwrapQueryResult("dispatch.queue", result);
}

export async function runListDispatchUnassignedJobsQuery(client) {
  const result = await buildDispatchJobsQuery(client)
    .eq("dispatch_status", "unassigned")
    .order("scheduled_start_at", { ascending: true });

  return unwrapQueryResult("dispatch.unassigned", result);
}

export async function runListDispatchAttentionJobsQuery(client) {
  const result = await buildDispatchJobsQuery(client)
    .or("dispatch_status.eq.late,dispatch_status.eq.escalated,priority.eq.escalated")
    .order("scheduled_start_at", { ascending: true });

  return unwrapQueryResult("dispatch.attention", result);
}

export async function runListDispatchTechniciansQuery(client) {
  const result = await client
    .from("technicians")
    .select(TECHNICIAN_LIST_COLUMNS)
    .order("name", { ascending: true });

  return unwrapQueryResult("dispatch.technicians", result);
}
