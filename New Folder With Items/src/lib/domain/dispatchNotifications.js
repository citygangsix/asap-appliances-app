export const DISPATCH_RESPONSE_WARNING_MINUTES = 10;
export const DISPATCH_RESPONSE_CRITICAL_MINUTES = 15;

const CLOSED_JOB_STATUSES = new Set(["completed", "canceled", "cancelled"]);

function formatStatusLabel(value) {
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getMinutesSince(value, now) {
  const startedAt = parseTimestamp(value);
  const nowTimestamp = now instanceof Date ? now.getTime() : parseTimestamp(now);

  if (!startedAt || !nowTimestamp) {
    return null;
  }

  return Math.max(0, Math.floor((nowTimestamp - startedAt) / 60000));
}

function formatElapsedLabel(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainder} min`;
}

function getTechnicianName(job, techniciansById) {
  if (job.technician?.name) {
    return job.technician.name;
  }

  if (job.techId && techniciansById.has(job.techId)) {
    return techniciansById.get(job.techId).name;
  }

  return "Assigned worker";
}

function getCustomerName(job) {
  return job.customer?.name || "Customer not linked";
}

function getServiceLabel(job) {
  return [job.applianceLabel, job.issueSummary].filter(Boolean).join(" - ") || "Service job";
}

function getStatusLabel(job) {
  const lifecycle = job.lifecycleStatus ? formatStatusLabel(job.lifecycleStatus) : "Open";
  return `${lifecycle}, worker unconfirmed`;
}

/**
 * @param {{
 *   jobRecords?: import("../../types/models").JobRecord[],
 *   technicians?: import("../../types/models").Technician[],
 *   now?: Date|string,
 *   warningMinutes?: number,
 *   criticalMinutes?: number
 * }} input
 */
export function buildDispatchResponseNotifications({
  jobRecords = [],
  technicians = [],
  now = new Date(),
  warningMinutes = DISPATCH_RESPONSE_WARNING_MINUTES,
  criticalMinutes = DISPATCH_RESPONSE_CRITICAL_MINUTES,
} = {}) {
  const techniciansById = new Map(technicians.map((technician) => [technician.techId, technician]));

  return jobRecords
    .map((job) => {
      const ageMinutes = getMinutesSince(job.dispatchConfirmationRequestedAt, now);

      if (
        ageMinutes === null ||
        ageMinutes < warningMinutes ||
        job.dispatchConfirmationReceivedAt ||
        CLOSED_JOB_STATUSES.has(job.lifecycleStatus)
      ) {
        return null;
      }

      const severity = ageMinutes >= criticalMinutes ? "critical" : "warning";
      const technicianName = getTechnicianName(job, techniciansById);
      const elapsedLabel = formatElapsedLabel(ageMinutes);

      return {
        id: `dispatch-no-response:${job.jobId}:${job.dispatchConfirmationRequestedAt}`,
        severity,
        jobId: job.jobId,
        title:
          severity === "critical"
            ? "Worker has not responded"
            : "Worker response due soon",
        message:
          severity === "critical"
            ? `${technicianName} has not confirmed this dispatch after ${elapsedLabel}. Call, text, leave voicemail, or reassign the job.`
            : `${technicianName} has not confirmed this dispatch yet. Keep an eye on this before it becomes late.`,
        ageMinutes,
        ageLabel: `${elapsedLabel} waiting`,
        details: [
          ["Worker", technicianName],
          ["Customer", getCustomerName(job)],
          ["Service", getServiceLabel(job)],
          ["Address", job.serviceAddress || "Address not set"],
          ["Scheduled", job.scheduledStartLabel || "Time not set"],
          ["Status", getStatusLabel(job)],
        ],
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "critical" ? -1 : 1;
      }

      return right.ageMinutes - left.ageMinutes;
    });
}
