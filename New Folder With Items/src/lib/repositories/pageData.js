import { hiringCandidates as mockHiringCandidates, settingsGroups } from "../../data/mock";
import { getCommunicationJobContext } from "../domain/communications";
import { formatCurrency, getInvoiceSummary, getRevenueBars } from "../domain/finance";
import {
  buildDispatchTechnicianAvailabilitySummary,
  getDispatchAttentionJobs,
  getDispatchBoardJobs,
  getUnassignedDispatchJobs,
  getWatchListJobs,
} from "../domain/jobs";

function sum(items, selector) {
  return items.reduce((total, item) => total + selector(item), 0);
}

function buildLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIsoOnLocalDate(isoValue, localDateKey) {
  if (!isoValue) {
    return false;
  }

  const parsed = new Date(isoValue);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return buildLocalDateKey(parsed) === localDateKey;
}

function isDateOnlyOnLocalDate(dateValue, localDateKey) {
  return Boolean(dateValue && String(dateValue).slice(0, 10) === localDateKey);
}

function getReferenceDate(invoiceRecords) {
  return invoiceRecords.reduce((latest, invoice) => {
    if (!latest || invoice.issuedOn > latest) {
      return invoice.issuedOn;
    }

    return latest;
  }, "");
}

function formatWeekdayLabel(dateLike) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${dateLike}T12:00:00`));
}

function buildRevenueTrendPoints(invoiceRecords) {
  const byDate = new Map();

  invoiceRecords.forEach((invoice) => {
    const current = byDate.get(invoice.issuedOn) || {
      periodLabel: formatWeekdayLabel(invoice.issuedOn),
      invoicedAmount: 0,
      collectedAmount: 0,
    };

    current.invoicedAmount += invoice.totalAmount;
    current.collectedAmount += invoice.collectedAmount;
    byDate.set(invoice.issuedOn, current);
  });

  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-5)
    .map(([, value]) => value);
}

function buildHomeKpis({ communicationRecords, invoiceRecords, jobRecords, technicians }) {
  const localDateKey = buildLocalDateKey();
  const jobsToday = jobRecords.filter((job) => isIsoOnLocalDate(job.scheduledStartAt, localDateKey));
  const activeJobs = jobsToday.filter((job) => !["completed", "canceled"].includes(job.lifecycleStatus));
  const completedJobsToday = jobsToday.filter((job) => job.lifecycleStatus === "completed");
  const atRiskJobs = jobsToday.filter((job) =>
    ["failed", "partial", "parts_due", "awaiting_payment", "late", "escalated"].some(
      (status) =>
        job.paymentStatus === status ||
        job.partsStatus === status ||
        job.dispatchStatus === status ||
        job.lifecycleStatus === status,
    ),
  );
  const callbacksNeeded = communicationRecords.filter((item) =>
    ["awaiting_callback", "unresolved"].includes(item.communicationStatus),
  );
  const partsAwaitingPayment = jobRecords.filter((job) => job.partsStatus === "awaiting_payment");
  const laborInvoicesDueToday = invoiceRecords.filter(
    (invoice) =>
      invoice.invoiceType === "labor" &&
      ["labor_due", "partial", "failed"].includes(invoice.paymentStatus) &&
      isDateOnlyOnLocalDate(invoice.dueOn || invoice.issuedOn, localDateKey),
  );
  const laborDueToday = sum(
    laborInvoicesDueToday,
    (invoice) => invoice.outstandingBalance,
  );
  const unresolvedCommunications = communicationRecords.filter(
    (item) => item.communicationStatus !== "clear",
  );
  const enRouteTechnicians = technicians.filter((tech) => tech.statusToday === "en_route");
  const lateTechnicians = technicians.filter((tech) => tech.statusToday === "late");

  return [
    {
      label: "Jobs today",
      value: String(jobsToday.length),
      detail: `${activeJobs.length} active, ${completedJobsToday.length} completed, ${atRiskJobs.length} at risk`,
    },
    {
      label: "Callbacks needed",
      value: String(callbacksNeeded.length),
      detail: `${communicationRecords.filter((item) => item.communicationChannel === "call").length} calls and ${communicationRecords.filter((item) => item.communicationChannel === "text").length} texts in queue`,
    },
    {
      label: "Technicians en route",
      value: String(enRouteTechnicians.length),
      detail: `${lateTechnicians.length} late, ${technicians.filter((tech) => tech.statusToday === "onsite").length} onsite`,
    },
    {
      label: "Parts awaiting payment",
      value: String(partsAwaitingPayment.length),
      detail: `${jobRecords.filter((job) => job.priority === "high").length} high-priority jobs on the board`,
    },
    {
      label: "Labor due today",
      value: formatCurrency(laborDueToday),
      detail: `${laborInvoicesDueToday.length} labor invoices due today`,
    },
    {
      label: "Unresolved communications",
      value: String(unresolvedCommunications.length),
      detail: `${communicationRecords.filter((item) => item.communicationChannel === "text" && item.communicationStatus !== "clear").length} text threads and ${communicationRecords.filter((item) => item.communicationChannel === "call" && item.communicationStatus !== "clear").length} calls`,
    },
  ];
}

function buildActivityFeed({ communicationRecords, jobRecords }) {
  const localDateKey = buildLocalDateKey();
  const items = [
    ...jobRecords.flatMap((job) =>
      (job.timelineEvents || []).map((event) => ({
        eventAt: event.eventAt,
        occurredAt: event.eventAtLabel,
        message: `${event.summary}${job.customer?.name ? ` for ${job.customer.name}` : ""}.`,
      })),
    ),
    ...communicationRecords.map((item) => ({
      eventAt: item.occurredAt,
      occurredAt: item.linkedJob?.scheduledStartLabel || item.customer?.lastContactLabel || "Recent",
      message: `${item.customer?.name || "Customer"} · ${getCommunicationJobContext(item)}.`,
    })),
  ];

  return items
    .filter((item) => isIsoOnLocalDate(item.eventAt, localDateKey))
    .slice(0, 5)
    .map((item) => `${item.occurredAt} · ${item.message}`);
}

function buildCallMetrics(communicationRecords) {
  const localDateKey = buildLocalDateKey();
  const todayRecords = communicationRecords.filter((item) => isIsoOnLocalDate(item.occurredAt, localDateKey));
  const calls = todayRecords.filter((item) => item.communicationChannel === "call");
  const texts = todayRecords.filter((item) => item.communicationChannel === "text");
  const unresolved = todayRecords.filter((item) => item.communicationStatus !== "clear");

  return [
    { label: "Calls logged", value: calls.length, detail: `${calls.filter((item) => item.communicationStatus !== "clear").length} still unresolved` },
    { label: "Text threads", value: texts.length, detail: `${texts.filter((item) => item.communicationStatus !== "clear").length} need follow-up` },
    { label: "Missed follow-ups", value: unresolved.filter((item) => item.communicationStatus === "awaiting_callback").length, detail: "Customer callbacks still open" },
    { label: "Resolved contacts", value: communicationRecords.filter((item) => item.communicationStatus === "clear").length, detail: "Closed cleanly in the current dataset" },
  ];
}

function buildUrgentQueues(jobRecords) {
  return [
    {
      label: "Jobs needing assignment",
      count: jobRecords.filter((job) => job.dispatchStatus === "unassigned").length,
      jobIds: jobRecords
        .filter((job) => job.dispatchStatus === "unassigned")
        .slice(0, 2)
        .map((job) => job.jobId),
    },
    {
      label: "Jobs awaiting parts payment",
      count: jobRecords.filter((job) => job.partsStatus === "awaiting_payment").length,
      jobIds: jobRecords
        .filter((job) => job.partsStatus === "awaiting_payment")
        .slice(0, 2)
        .map((job) => job.jobId),
    },
    {
      label: "Return visits to schedule",
      count: jobRecords.filter((job) => job.lifecycleStatus === "return_scheduled").length,
      jobIds: jobRecords
        .filter((job) => job.lifecycleStatus === "return_scheduled")
        .slice(0, 2)
        .map((job) => job.jobId),
    },
    {
      label: "Labor due now",
      count: jobRecords.filter((job) => job.paymentStatus === "labor_due").length,
      jobIds: jobRecords
        .filter((job) => job.paymentStatus === "labor_due")
        .slice(0, 2)
        .map((job) => job.jobId),
    },
    {
      label: "Failed payments",
      count: jobRecords.filter((job) => job.paymentStatus === "failed").length,
      jobIds: jobRecords
        .filter((job) => job.paymentStatus === "failed")
        .slice(0, 2)
        .map((job) => job.jobId),
    },
  ];
}

export function buildHomePageData(readModels) {
  return {
    homeKpis: buildHomeKpis(readModels),
    activityFeed: buildActivityFeed(readModels),
    callMetrics: buildCallMetrics(readModels.communicationRecords),
    urgentQueues: buildUrgentQueues(readModels.jobRecords),
    technicians: readModels.technicians,
    hiringCandidates: readModels.hiringCandidates || mockHiringCandidates,
    watchListJobs: getWatchListJobs(readModels.jobRecords),
  };
}

export function buildJobsPageData(readModels) {
  return { jobRecords: readModels.jobRecords };
}

export function buildCustomersPageData(readModels) {
  return { customerRecords: readModels.customerRecords };
}

export function buildDispatchPageData(readModels) {
  const jobRecords = getDispatchBoardJobs(readModels.jobRecords);
  const technicians = readModels.technicians;

  return {
    jobRecords,
    technicians,
    unassignedJobs: getUnassignedDispatchJobs(jobRecords),
    attentionJobs: getDispatchAttentionJobs(jobRecords),
    technicianAvailabilitySummary: buildDispatchTechnicianAvailabilitySummary(technicians),
  };
}

export function buildCommunicationsPageData(readModels) {
  return {
    communicationRecords: readModels.communicationRecords,
    unmatchedInboundRecords: readModels.unmatchedInboundRecords || [],
  };
}

export function buildInvoicesPageData(readModels) {
  const { invoiceRecords } = readModels;

  return {
    invoiceRecords,
    summaryCards: getInvoiceSummary(invoiceRecords),
    failedInvoices: invoiceRecords.filter((invoice) => invoice.paymentStatus === "failed"),
  };
}

export function buildRevenuePageData(readModels) {
  const { invoiceRecords, payoutRecords } = readModels;
  const referenceDate = getReferenceDate(invoiceRecords);
  const bookedToday = sum(
    invoiceRecords.filter((invoice) => invoice.issuedOn === referenceDate),
    (invoice) => invoice.totalAmount,
  );
  const collectedToday = sum(
    invoiceRecords.filter((invoice) => invoice.issuedOn === referenceDate),
    (invoice) => invoice.collectedAmount,
  );
  const pendingBalance = sum(invoiceRecords, (invoice) => invoice.outstandingBalance);
  const payoutTotal = sum(payoutRecords, (payout) => payout.amount);
  const trendPoints = buildRevenueTrendPoints(invoiceRecords);

  return {
    payoutRecords,
    trendBars: trendPoints.length > 0 ? getRevenueBars(trendPoints) : [],
    pendingBalance,
    revenueCards: [
      {
        label: "Booked today",
        value: formatCurrency(bookedToday),
        detail: referenceDate ? `Based on invoices issued ${referenceDate}` : "No invoice activity yet",
      },
      {
        label: "Collected today",
        value: formatCurrency(collectedToday),
        detail: referenceDate ? `Collections recorded for ${referenceDate}` : "No collections recorded yet",
      },
      {
        label: "Outstanding balance",
        value: formatCurrency(pendingBalance),
        detail: `${invoiceRecords.filter((invoice) => invoice.paymentStatus === "failed").length} failed charges still open`,
      },
      {
        label: "Technician payouts",
        value: formatCurrency(payoutTotal),
        detail: `${payoutRecords.filter((payout) => payout.status !== "ready").length} batches still pending release`,
      },
    ],
  };
}

function toAverageMinutes(responseMinutes = []) {
  if (responseMinutes.length === 0) {
    return null;
  }

  return Math.round(responseMinutes.reduce((total, minutes) => total + minutes, 0) / responseMinutes.length);
}

function buildTechnicianAccountability(technician, jobRecords) {
  const technicianJobs = jobRecords.filter((job) => job.techId === technician.techId);
  const responseJobs = technicianJobs
    .filter((job) => Number.isFinite(job.dispatchResponseMinutes))
    .sort((left, right) =>
      String(right.dispatchConfirmationReceivedAt || "").localeCompare(
        String(left.dispatchConfirmationReceivedAt || ""),
      ),
    );
  const collectionJobs = technicianJobs
    .filter((job) => typeof job.paymentCollectedBeforeTechLeft === "boolean")
    .sort((left, right) =>
      String(right.dispatchConfirmationReceivedAt || "").localeCompare(
        String(left.dispatchConfirmationReceivedAt || ""),
      ),
    );
  const stayedForCollectionCount = collectionJobs.filter(
    (job) => job.paymentCollectedBeforeTechLeft === true,
  ).length;

  return {
    ...technician,
    averageDispatchResponseMinutes: toAverageMinutes(
      responseJobs.map((job) => Number(job.dispatchResponseMinutes)),
    ),
    lastDispatchResponseMinutes:
      responseJobs.length > 0 ? Number(responseJobs[0].dispatchResponseMinutes) : null,
    pendingDispatchConfirmationCount: technicianJobs.filter(
      (job) => job.dispatchConfirmationRequestedAt && !job.dispatchConfirmationReceivedAt,
    ).length,
    stayedForCollectionRatePercent:
      collectionJobs.length > 0
        ? Math.round((stayedForCollectionCount / collectionJobs.length) * 100)
        : null,
    lastCollectionBehavior:
      collectionJobs.length === 0
        ? "unknown"
        : collectionJobs[0].paymentCollectedBeforeTechLeft
          ? "stayed"
          : "left_early",
  };
}

export function buildTechniciansPageData(readModels) {
  return {
    technicians: readModels.technicians.map((technician) =>
      buildTechnicianAccountability(technician, readModels.jobRecords),
    ),
    hiringCandidates: readModels.hiringCandidates || mockHiringCandidates,
  };
}

export function buildSettingsPageData() {
  return { settingsGroups };
}
