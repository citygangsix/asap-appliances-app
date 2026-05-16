import {
  estimateRoadMiles,
  formatMiles,
  resolveJobCoordinate,
  resolveTechnicianCoordinate,
} from "./dispatchRouting";
import { DISPATCH_RESPONSE_WARNING_MINUTES } from "./dispatchNotifications";
import { isClosedJob } from "./jobs";
import { extractZipCode, getTechnicianCoverageZipCodes } from "./technicianCoverage";

const TECHNICIAN_STATUS_SCORE = {
  unassigned: 24,
  en_route: 12,
  onsite: 4,
  late: -34,
};

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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasWordOverlap(left, right) {
  const leftWords = normalizeText(left).split(" ").filter((word) => word.length >= 4);
  const rightText = ` ${normalizeText(right)} `;

  return leftWords.some((word) => rightText.includes(` ${word} `));
}

function getJobServiceText(job) {
  return [job.applianceLabel, job.applianceBrand, job.issueSummary].filter(Boolean).join(" ");
}

function hasRelevantSkill(technician, job) {
  const jobText = normalizeText(getJobServiceText(job));
  const skills = technician.skills || [];

  if (skills.length === 0) {
    return false;
  }

  return skills.some((skill) => {
    const skillText = normalizeText(skill);
    return skillText && (jobText.includes(skillText) || skillText.includes("appliance"));
  });
}

function getDistanceScore(miles) {
  if (!Number.isFinite(miles)) {
    return -8;
  }

  if (miles <= 25) {
    return 18;
  }

  if (miles <= 50) {
    return 8;
  }

  if (miles <= 85) {
    return -8;
  }

  if (miles <= 115) {
    return -18;
  }

  return -32;
}

function getDistanceLabel(miles) {
  if (!Number.isFinite(miles)) {
    return "Distance unknown";
  }

  if (miles <= 25) {
    return "Close";
  }

  if (miles <= 50) {
    return "Nearby";
  }

  if (miles <= 85) {
    return "Stretch";
  }

  if (miles <= 115) {
    return "Far but possible";
  }

  return "Last-resort distance";
}

function getPendingConfirmations(technician, jobs) {
  return jobs.filter(
    (job) =>
      job.techId === technician.techId &&
      job.dispatchConfirmationRequestedAt &&
      !job.dispatchConfirmationReceivedAt &&
      !isClosedJob(job),
  ).length;
}

function getRoutePlan(technician, routePlans) {
  return routePlans.find((plan) => plan.techId === technician.techId) || null;
}

function compareCandidates(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return String(left.technician.name || "").localeCompare(String(right.technician.name || ""));
}

function buildCandidate({
  job,
  jobs,
  technician,
  technicianIndex,
  routePlans,
  serviceZipCode,
  jobCoordinate,
  currentResponseAgeMinutes,
}) {
  const coverageZipCodes = getTechnicianCoverageZipCodes(technician);
  const exactZipMatch = serviceZipCode ? coverageZipCodes.includes(serviceZipCode) : false;
  const areaMatch = hasWordOverlap(
    [job.serviceAddress, job.customer?.city, job.customer?.serviceArea].filter(Boolean).join(" "),
    technician.serviceArea,
  );
  const skillMatch = hasRelevantSkill(technician, job);
  const routePlan = getRoutePlan(technician, routePlans);
  const technicianCoordinate = resolveTechnicianCoordinate(technician, technicianIndex);
  const directMiles =
    jobCoordinate && technicianCoordinate
      ? estimateRoadMiles(technicianCoordinate, jobCoordinate)
      : null;
  const pendingConfirmations = getPendingConfirmations(technician, jobs);
  const isCurrentWorker = job.techId === technician.techId;
  const isCurrentWorkerUnconfirmed =
    isCurrentWorker &&
    job.dispatchConfirmationRequestedAt &&
    !job.dispatchConfirmationReceivedAt;
  const isCurrentWorkerStale =
    isCurrentWorkerUnconfirmed &&
    Number(currentResponseAgeMinutes) >= DISPATCH_RESPONSE_WARNING_MINUTES;
  const hasPhone = Boolean(technician.primaryPhone);
  const scoreParts = [
    exactZipMatch ? 64 : 0,
    !exactZipMatch && areaMatch ? 24 : 0,
    skillMatch ? 12 : 0,
    TECHNICIAN_STATUS_SCORE[technician.statusToday] ?? 0,
    Math.min(Number(technician.callbackRatePercent || 0) / 6, 14),
    Math.min(Number(technician.score || 0) / 9, 12),
    getDistanceScore(directMiles),
    routePlan?.stopCount ? Math.min(routePlan.stopCount * 4, 14) : 0,
    isCurrentWorker && !isCurrentWorkerStale ? 14 : 0,
    pendingConfirmations > 0 ? pendingConfirmations * -18 : 0,
    hasPhone ? 0 : -24,
    isCurrentWorkerStale ? -220 : 0,
  ];
  const score = Math.round(scoreParts.reduce((total, value) => total + value, 0));
  const reasons = [];

  if (exactZipMatch) {
    reasons.push(`Covers ${serviceZipCode}`);
  } else if (areaMatch) {
    reasons.push("Service area matches the job area");
  } else {
    reasons.push("Outside normal coverage, still eligible as fallback");
  }

  if (Number.isFinite(directMiles)) {
    reasons.push(`${getDistanceLabel(directMiles)} at ${formatMiles(directMiles)}`);
  } else {
    reasons.push("No usable location estimate");
  }

  if (routePlan?.stopCount) {
    reasons.push(`${routePlan.stopCount} active route stop${routePlan.stopCount === 1 ? "" : "s"}`);
  } else {
    reasons.push("No current route load");
  }

  if (pendingConfirmations > 0) {
    reasons.push(`${pendingConfirmations} unconfirmed dispatch${pendingConfirmations === 1 ? "" : "es"}`);
  }

  if (isCurrentWorkerStale) {
    reasons.push(`Current worker has not answered for ${currentResponseAgeMinutes} min`);
  }

  if (!hasPhone) {
    reasons.push("No phone number on file");
  }

  if (skillMatch) {
    reasons.push("Skill match");
  }

  return {
    techId: technician.techId,
    technician,
    score,
    exactZipMatch,
    areaMatch,
    skillMatch,
    directMiles,
    distanceLabel: getDistanceLabel(directMiles),
    pendingConfirmations,
    isCurrentWorker,
    isCurrentWorkerStale,
    hasPhone,
    routeStopCount: routePlan?.stopCount || 0,
    reasons,
  };
}

/**
 * @param {{
 *   job?: import("../../types/models").JobRecord|null,
 *   jobs?: import("../../types/models").JobRecord[],
 *   technicians?: import("../../types/models").Technician[],
 *   routePlans?: Array<{ techId: string, stopCount: number }>,
 *   now?: Date|string
 * }} input
 */
export function buildMasterDispatchRecommendation({
  job,
  jobs = [],
  technicians = [],
  routePlans = [],
  now = new Date(),
} = {}) {
  if (!job || technicians.length === 0) {
    return null;
  }

  const serviceZipCode = extractZipCode(job.serviceAddress);
  const jobCoordinate = resolveJobCoordinate(job, 0);
  const currentResponseAgeMinutes =
    job.dispatchConfirmationRequestedAt && !job.dispatchConfirmationReceivedAt
      ? getMinutesSince(job.dispatchConfirmationRequestedAt, now)
      : null;
  const candidates = technicians
    .map((technician, technicianIndex) =>
      buildCandidate({
        job,
        jobs,
        technician,
        technicianIndex,
        routePlans,
        serviceZipCode,
        jobCoordinate,
        currentResponseAgeMinutes,
      }),
    )
    .sort(compareCandidates);
  const currentWorker = candidates.find((candidate) => candidate.isCurrentWorker) || null;
  const primary =
    currentWorker && !currentWorker.isCurrentWorkerStale
      ? currentWorker
      : candidates.find((candidate) => !candidate.isCurrentWorkerStale && candidate.hasPhone) ||
        candidates.find((candidate) => !candidate.isCurrentWorkerStale) ||
        candidates[0] ||
        null;
  const fallbacks = candidates
    .filter((candidate) => candidate.techId !== primary?.techId)
    .filter((candidate) => !candidate.isCurrentWorkerStale)
    .slice(0, 4);
  const shouldBypassCurrentWorker = Boolean(currentWorker?.isCurrentWorkerStale);
  const uncoveredJob = !candidates.some((candidate) => candidate.exactZipMatch);

  return {
    jobId: job.jobId,
    serviceZipCode,
    currentResponseAgeMinutes,
    currentWorker,
    primary,
    fallbacks,
    candidates,
    shouldBypassCurrentWorker,
    headline: shouldBypassCurrentWorker
      ? `Bypass ${currentWorker?.technician.name || "current worker"} and offer ${primary?.technician.name || "the next worker"}`
      : `Offer ${primary?.technician.name || "the best worker"} first`,
    instruction: shouldBypassCurrentWorker
      ? "The assigned worker is no longer the plan. Move to the next reachable worker now."
      : uncoveredJob
        ? "No exact ZIP owner was found. Use the strongest available fallback instead of stalling."
        : "Keep the bulk of this area's work with the strongest worker, then step down the list if they do not answer.",
  };
}
