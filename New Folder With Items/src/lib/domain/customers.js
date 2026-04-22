import { formatCurrency } from "./finance";

/** @typedef {import("../../types/models").Communication} Communication */
/** @typedef {import("../../types/models").Customer} Customer */
/** @typedef {import("../../types/models").CustomerRecord} CustomerRecord */
/** @typedef {import("../../types/models").Invoice} Invoice */
/** @typedef {import("../../types/models").JobRecord} JobRecord */

/**
 * @param {JobRecord[]} customerJobs
 * @param {string|null|undefined} [activeJobId]
 * @returns {JobRecord|null}
 */
export function pickActiveCustomerJob(customerJobs, activeJobId = null) {
  if (activeJobId) {
    const matchingJob = customerJobs.find((job) => job.jobId === activeJobId);

    if (matchingJob) {
      return matchingJob;
    }
  }

  return (
    customerJobs.find((job) => !["completed", "canceled"].includes(job.lifecycleStatus)) ||
    customerJobs[0] ||
    null
  );
}

/**
 * @param {Customer} customer
 * @param {JobRecord[]} customerJobs
 * @param {Communication[]} customerComms
 * @param {Invoice[]} customerInvoices
 * @returns {CustomerRecord}
 */
export function buildCustomerRecord(customer, customerJobs, customerComms, customerInvoices) {
  const openBalance = customerInvoices.reduce((sum, invoice) => sum + invoice.outstandingBalance, 0);
  const activeJob = pickActiveCustomerJob(customerJobs, customer.activeJobId);

  return {
    ...customer,
    activeJob,
    communicationRecords: customerComms,
    jobs: customerJobs,
    openBalance,
    unresolvedCount: customerComms.filter((entry) => entry.communicationStatus !== "clear").length,
    latestCommunication:
      customerComms[0]?.callHighlights || customerComms[0]?.previewText || "No recent communication",
  };
}

/**
 * @param {Customer[]} customers
 * @param {JobRecord[]} jobs
 * @param {Communication[]} communications
 * @param {Invoice[]} invoices
 * @returns {CustomerRecord[]}
 */
export function buildCustomerRecords(customers, jobs, communications, invoices) {
  return customers.map((customer) =>
    buildCustomerRecord(
      customer,
      jobs.filter((job) => job.customerId === customer.customerId),
      communications.filter((entry) => entry.customerId === customer.customerId),
      invoices.filter((invoice) => invoice.customerId === customer.customerId),
    ),
  );
}

export { formatCurrency };
