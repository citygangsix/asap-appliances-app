import { buildCustomerRecord } from "../../../lib/domain/customers";
import { mapHydratedJobRowToRecord } from "./jobs";
import { mapCommunicationRowToDomain } from "../mappers/communications";
import { mapCustomerRowToDomain } from "../mappers/customers";
import { mapInvoiceRowToDomain } from "../mappers/invoices";

/** @typedef {import("../types/schema").CommunicationRow} CommunicationRow */
/** @typedef {import("../types/schema").CustomerRow} CustomerRow */
/** @typedef {import("../types/schema").InvoiceRow} InvoiceRow */
/** @typedef {import("../types/schema").JobRow} JobRow */
/** @typedef {import("../types/schema").JobTimelineEventRow} JobTimelineEventRow */
/** @typedef {import("../types/schema").TechnicianRow} TechnicianRow */
/** @typedef {import("../../../types/models").CustomerRecord} CustomerRecord */

/**
 * @typedef {JobRow & {
 *   customer?: CustomerRow|null,
 *   technician?: TechnicianRow|null,
 *   invoice_rows?: InvoiceRow[]|null,
 *   timeline_rows?: JobTimelineEventRow[]|null,
 *   communication_rows?: CommunicationRow[]|null
 * }} HydratedCustomerJobRow
 */

/**
 * @typedef {CustomerRow & {
 *   job_rows?: HydratedCustomerJobRow[]|null,
 *   communication_rows?: CommunicationRow[]|null
 * }} HydratedCustomerRow
 */

function sortJobRows(jobRows = []) {
  return [...jobRows].sort((left, right) => {
    const scheduleComparison = String(left.scheduled_start_at || "").localeCompare(
      String(right.scheduled_start_at || ""),
    );

    if (scheduleComparison !== 0) {
      return scheduleComparison;
    }

    return String(left.created_at || "").localeCompare(String(right.created_at || ""));
  });
}

function sortCommunicationRows(communicationRows = []) {
  return [...communicationRows].sort((left, right) =>
    String(right.occurred_at || "").localeCompare(String(left.occurred_at || "")),
  );
}

/**
 * @param {HydratedCustomerRow} row
 * @returns {CustomerRecord}
 */
export function mapHydratedCustomerRowToRecord(row) {
  const jobRows = sortJobRows(row.job_rows ?? []);
  const communicationRows = sortCommunicationRows(row.communication_rows ?? []);
  const jobRecords = jobRows.map((jobRow) => mapHydratedJobRowToRecord(jobRow));
  const communicationRecords = communicationRows.map(mapCommunicationRowToDomain);
  const invoiceRecords = jobRows.flatMap((jobRow) =>
    (jobRow.invoice_rows ?? []).map((invoiceRow) =>
      mapInvoiceRowToDomain(invoiceRow, {
        customerId: row.customer_id,
      }),
    ),
  );
  const activeJobId =
    jobRecords.find((job) => !["completed", "canceled"].includes(job.lifecycleStatus))?.jobId ||
    jobRecords[0]?.jobId ||
    null;

  return buildCustomerRecord(
    mapCustomerRowToDomain(row, { activeJobId }),
    jobRecords,
    communicationRecords,
    invoiceRecords,
  );
}

/**
 * @param {HydratedCustomerRow[]} rows
 * @returns {CustomerRecord[]}
 */
export function mapHydratedCustomerRowsToRecords(rows = []) {
  return rows.map((row) => mapHydratedCustomerRowToRecord(row));
}
