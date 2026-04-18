import { hiringCandidates, settingsGroups } from "../../data/mock";
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
  const activeJobs = jobRecords.filter((job) => !["completed", "canceled"].includes(job.lifecycleStatus));
  const atRiskJobs = jobRecords.filter((job) =>
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
  const laborDueToday = sum(
    invoiceRecords.filter(
      (invoice) =>
        invoice.invoiceType === "labor" &&
        ["labor_due", "partial", "failed"].includes(invoice.paymentStatus),
    ),
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
      value: String(jobRecords.length),
      detail: `${activeJobs.length} active, ${jobRecords.filter((job) => job.lifecycleStatus === "completed").length} completed, ${atRiskJobs.length} at risk`,
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
      detail: `${invoiceRecords.filter((invoice) => invoice.invoiceType === "labor").length} labor invoices in the current cycle`,
    },
    {
      label: "Unresolved communications",
      value: String(unresolvedCommunications.length),
      detail: `${communicationRecords.filter((item) => item.communicationChannel === "text" && item.communicationStatus !== "clear").length} text threads and ${communicationRecords.filter((item) => item.communicationChannel === "call" && item.communicationStatus !== "clear").length} calls`,
    },
  ];
}

function buildActivityFeed({ communicationRecords, jobRecords }) {
  const items = [
    ...jobRecords.flatMap((job) =>
      (job.timelineEvents || []).map((event) => ({
        occurredAt: event.eventAtLabel,
        message: `${event.summary}${job.customer?.name ? ` for ${job.customer.name}` : ""}.`,
      })),
    ),
    ...communicationRecords.map((item) => ({
      occurredAt: item.linkedJob?.scheduledStartLabel || item.customer?.lastContactLabel || "Recent",
      message: `${item.customer?.name || "Customer"} · ${getCommunicationJobContext(item)}.`,
    })),
  ];

  return items.slice(0, 5).map((item) => `${item.occurredAt} · ${item.message}`);
}

function buildCallMetrics(communicationRecords) {
  const calls = communicationRecords.filter((item) => item.communicationChannel === "call");
  const texts = communicationRecords.filter((item) => item.communicationChannel === "text");
  const unresolved = communicationRecords.filter((item) => item.communicationStatus !== "clear");

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
    hiringCandidates,
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
  return { communicationRecords: readModels.communicationRecords };
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

export function buildTechniciansPageData(readModels) {
  return { technicians: readModels.technicians };
}

export function buildSettingsPageData() {
  return { settingsGroups };
}
