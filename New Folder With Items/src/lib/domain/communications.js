import { formatStatusLabel } from "./jobs";
import { indexBy } from "./relations";

/** @typedef {import("../../types/models").Communication} Communication */
/** @typedef {import("../../types/models").CommunicationRecord} CommunicationRecord */
/** @typedef {import("../../types/models").Customer} Customer */
/** @typedef {import("../../types/models").Invoice} Invoice */
/** @typedef {import("../../types/models").JobRecord} JobRecord */

/**
 * @param {Communication[]} communications
 * @param {Customer[]} customers
 * @param {JobRecord[]} jobs
 * @param {Invoice[]} invoices
 * @returns {CommunicationRecord[]}
 */
export function buildCommunicationRecords(communications, customers, jobs, invoices) {
  const customersById = indexBy(customers, "customerId");
  const jobsById = indexBy(jobs, "jobId");
  const invoicesById = indexBy(invoices, "invoiceId");

  return communications.map((entry) => ({
    ...entry,
    customer: customersById.get(entry.customerId) || null,
    linkedJob: entry.linkedJobId ? jobsById.get(entry.linkedJobId) || null : null,
    invoice: entry.invoiceId ? invoicesById.get(entry.invoiceId) || null : null,
  }));
}

/**
 * @param {CommunicationRecord[]} records
 * @param {import("../../types/models").CommunicationFeedFilters} [filters]
 */
export function filterCommunicationRecords(records, filters = {}) {
  return records.filter((entry) => {
    if (filters.direction && entry.direction !== filters.direction) {
      return false;
    }

    if (
      filters.communicationStatus &&
      entry.communicationStatus !== filters.communicationStatus
    ) {
      return false;
    }

    if (
      filters.communicationChannel &&
      entry.communicationChannel !== filters.communicationChannel
    ) {
      return false;
    }

    return true;
  });
}

/**
 * @param {CommunicationRecord} entry
 */
export function getCommunicationJobContext(entry) {
  if (!entry.linkedJob) {
    return "No linked job";
  }

  return `${entry.linkedJob.applianceLabel} · ${formatStatusLabel(entry.linkedJob.paymentStatus)} · ${formatStatusLabel(entry.linkedJob.partsStatus)}`;
}
