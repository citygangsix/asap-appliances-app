import { DISPATCH_GROUPS, STATUS_TONES } from "../constants/status";
import { groupBy, indexBy } from "./relations";

/** @typedef {import("../../types/models").Communication} Communication */
/** @typedef {import("../../types/models").Customer} Customer */
/** @typedef {import("../../types/models").Invoice} Invoice */
/** @typedef {import("../../types/models").Job} Job */
/** @typedef {import("../../types/models").JobRecord} JobRecord */
/** @typedef {import("../../types/models").JobTimelineEvent} JobTimelineEvent */
/** @typedef {import("../../types/models").Technician} Technician */

export const CLOSED_JOB_LIFECYCLE_STATUSES = new Set([
  "completed",
  "canceled",
  "cancelled",
  "declined",
  "diagnostic_paid_declined_repair",
  "closed",
  "no_work_needed",
  "paid_closed",
]);

export const CLOSED_JOB_DISPATCH_STATUSES = new Set([
  "completed",
  "canceled",
  "cancelled",
  "declined",
  "closed",
  "paid_closed",
]);

function normalizeStatus(value) {
  return String(value || "").toLowerCase();
}

/**
 * @param {JobRecord|Job|null|undefined} job
 */
export function isClosedJob(job) {
  if (!job) {
    return true;
  }

  const lifecycleStatus = normalizeStatus(job.lifecycleStatus);
  const dispatchStatus = normalizeStatus(job.dispatchStatus);
  const paymentStatus = normalizeStatus(job.paymentStatus);
  const partsStatus = normalizeStatus(job.partsStatus);
  const invoiceStatus = normalizeStatus(job.invoice?.paymentStatus);

  return (
    CLOSED_JOB_LIFECYCLE_STATUSES.has(lifecycleStatus) ||
    CLOSED_JOB_DISPATCH_STATUSES.has(dispatchStatus) ||
    paymentStatus === "paid_closed" ||
    paymentStatus === "diagnostic_paid_declined_repair" ||
    invoiceStatus === "void" ||
    partsStatus === "declined"
  );
}

export function formatStatusLabel(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getStatusTone(status) {
  return STATUS_TONES[status] || "slate";
}

export function getPriorityTone(priority) {
  const tones = {
    normal: "blue",
    high: "amber",
    escalated: "rose",
  };

  return tones[priority] || "slate";
}

/**
 * @param {Job[]} jobs
 * @param {Customer[]} customers
 * @param {Technician[]} technicians
 * @param {Invoice[]} invoices
 * @param {Communication[]} communications
 * @param {JobTimelineEvent[]} [jobTimelineEvents]
 * @returns {JobRecord[]}
 */
export function buildJobRecords(
  jobs,
  customers,
  technicians,
  invoices,
  communications,
  jobTimelineEvents = [],
) {
  const customersById = indexBy(customers, "customerId");
  const techniciansById = indexBy(technicians, "techId");
  const invoicesById = indexBy(invoices, "invoiceId");
  const communicationsByJobId = groupBy(communications, "linkedJobId");
  const timelinesByJobId = groupBy(jobTimelineEvents, "jobId");

  return jobs.map((job) => ({
    ...job,
    customer: customersById.get(job.customerId) || null,
    technician: job.techId ? techniciansById.get(job.techId) || null : null,
    invoice: job.invoiceId ? invoicesById.get(job.invoiceId) || null : null,
    communications: communicationsByJobId.get(job.jobId) || [],
    timelineEvents: timelinesByJobId.get(job.jobId) || [],
  }));
}

/**
 * @param {JobRecord[]} jobs
 */
export function getJobFilterOptions(jobs) {
  const unique = (selector) => Array.from(new Set(jobs.map(selector)));

  return {
    technicians: ["All technicians", ...unique((job) => job.technician?.name || "Unassigned")],
    lifecycleStatuses: ["All lifecycle", ...unique((job) => job.lifecycleStatus)],
    paymentStatuses: ["All payment", ...unique((job) => job.paymentStatus)],
    partsStatuses: ["All parts", ...unique((job) => job.partsStatus)],
  };
}

/**
 * @param {JobRecord[]} jobs
 * @param {{ search: string, technician: string, lifecycle: string, payment: string, parts: string }} filters
 */
export function filterJobs(jobs, filters) {
  return jobs.filter((job) => {
    const searchMatch =
      filters.search.trim() === "" ||
      `${job.customer?.name || ""} ${job.applianceLabel} ${job.issueSummary} ${job.jobId}`
        .toLowerCase()
        .includes(filters.search.toLowerCase());

    return (
      searchMatch &&
      (filters.technician === "All technicians" || (job.technician?.name || "Unassigned") === filters.technician) &&
      (filters.lifecycle === "All lifecycle" || job.lifecycleStatus === filters.lifecycle) &&
      (filters.payment === "All payment" || job.paymentStatus === filters.payment) &&
      (filters.parts === "All parts" || job.partsStatus === filters.parts)
    );
  });
}

/**
 * @param {JobRecord[]} jobs
 * @param {string} group
 */
export function getJobsForDispatchGroup(jobs, group) {
  if (!DISPATCH_GROUPS.includes(group)) {
    return [];
  }

  return jobs.filter((job) => job.dispatchStatus === group || job.lifecycleStatus === group);
}

/**
 * @param {JobRecord} job
 */
export function getJobDetailRows(job) {
  return [
    ["Appliance", job.applianceLabel],
    ["Issue", job.issueSummary],
    ["Scheduled", job.scheduledStartLabel],
    ["Technician", job.technician?.name || "Unassigned"],
    ["Address", job.serviceAddress],
    ["ETA", job.etaLabel],
  ];
}

/**
 * @param {JobRecord[]} jobs
 */
export function getWatchListJobs(jobs) {
  return jobs.filter((job) => !isClosedJob(job) && ["failed", "parts_due", "partial"].includes(job.paymentStatus));
}

/**
 * @param {JobRecord[]} jobs
 */
export function getDispatchBoardJobs(jobs) {
  return jobs.filter((job) => !isClosedJob(job));
}

/**
 * @param {JobRecord[]} jobs
 */
export function getUnassignedDispatchJobs(jobs) {
  return getDispatchBoardJobs(jobs).filter((job) => job.dispatchStatus === "unassigned");
}

/**
 * @param {JobRecord[]} jobs
 */
export function getDispatchAttentionJobs(jobs) {
  return getDispatchBoardJobs(jobs).filter(
    (job) => ["late", "escalated"].includes(job.dispatchStatus) || job.priority === "escalated",
  );
}

/**
 * @param {Technician[]} technicians
 */
export function buildDispatchTechnicianAvailabilitySummary(technicians) {
  return {
    totalTechnicians: technicians.length,
    unassignedCount: technicians.filter((tech) => tech.statusToday === "unassigned").length,
    enRouteCount: technicians.filter((tech) => tech.statusToday === "en_route").length,
    onsiteCount: technicians.filter((tech) => tech.statusToday === "onsite").length,
    lateCount: technicians.filter((tech) => tech.statusToday === "late").length,
  };
}
