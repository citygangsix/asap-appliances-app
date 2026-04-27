import { mapCommunicationRowToDomain } from "../mappers/communications";
import { mapCustomerRowToDomain } from "../mappers/customers";
import { mapInvoiceRowToDomain } from "../mappers/invoices";
import { mapJobRowToDomain } from "../mappers/jobs";
import { mapJobTimelineEventRowToDomain } from "../mappers/jobTimelineEvents";
import { mapTechnicianRowToDomain } from "../mappers/technicians";

/** @typedef {import("../types/schema.js").CommunicationRow} CommunicationRow */
/** @typedef {import("../types/schema.js").CustomerRow} CustomerRow */
/** @typedef {import("../types/schema.js").InvoiceRow} InvoiceRow */
/** @typedef {import("../types/schema.js").JobRow} JobRow */
/** @typedef {import("../types/schema.js").JobTimelineEventRow} JobTimelineEventRow */
/** @typedef {import("../types/schema.js").TechnicianRow} TechnicianRow */
/** @typedef {import("../../../types/models.js").JobRecord} JobRecord */

/**
 * @typedef {JobRow & {
 *   customer?: CustomerRow|null,
 *   technician?: TechnicianRow|null,
 *   invoice_rows?: InvoiceRow[]|null,
 *   timeline_rows?: JobTimelineEventRow[]|null,
 *   communication_rows?: CommunicationRow[]|null
 * }} HydratedJobRow
 */

function sortInvoiceRows(invoiceRows = []) {
  return [...invoiceRows].sort((left, right) => {
    const issuedOnComparison = String(right.issued_on || "").localeCompare(String(left.issued_on || ""));

    if (issuedOnComparison !== 0) {
      return issuedOnComparison;
    }

    return String(right.created_at || "").localeCompare(String(left.created_at || ""));
  });
}

function sortTimelineRows(timelineRows = []) {
  return [...timelineRows].sort((left, right) =>
    String(left.event_at || "").localeCompare(String(right.event_at || "")),
  );
}

function sortCommunicationRows(communicationRows = []) {
  return [...communicationRows].sort((left, right) =>
    String(right.occurred_at || "").localeCompare(String(left.occurred_at || "")),
  );
}

/**
 * Temporary selector until the schema gets an explicit primary-invoice view or selector.
 *
 * @param {InvoiceRow[]} invoiceRows
 * @returns {InvoiceRow|null}
 */
export function pickPrimaryInvoiceRow(invoiceRows = []) {
  return sortInvoiceRows(invoiceRows)[0] || null;
}

/**
 * @param {HydratedJobRow} row
 * @param {{
 *   invoiceRows?: InvoiceRow[]|null,
 *   communicationRows?: CommunicationRow[]|null,
 *   timelineRows?: JobTimelineEventRow[]|null
 * }} [relations]
 * @returns {JobRecord}
 */
export function mapHydratedJobRowToRecord(row, relations = {}) {
  const invoiceRows = sortInvoiceRows(relations.invoiceRows ?? row.invoice_rows ?? []);
  const communicationRows = sortCommunicationRows(
    relations.communicationRows ?? row.communication_rows ?? [],
  );
  const timelineRows = sortTimelineRows(relations.timelineRows ?? row.timeline_rows ?? []);
  const primaryInvoiceRow = pickPrimaryInvoiceRow(invoiceRows);

  return {
    ...mapJobRowToDomain(row, {
      primaryInvoiceId: primaryInvoiceRow?.invoice_id || null,
    }),
    customer: row.customer ? mapCustomerRowToDomain(row.customer) : null,
    technician: row.technician ? mapTechnicianRowToDomain(row.technician) : null,
    invoice: primaryInvoiceRow
      ? mapInvoiceRowToDomain(primaryInvoiceRow, {
          customerId: row.customer_id,
        })
      : null,
    communications: communicationRows.map(mapCommunicationRowToDomain),
    timelineEvents: timelineRows.map(mapJobTimelineEventRowToDomain),
  };
}

/**
 * @param {HydratedJobRow[]} rows
 * @returns {JobRecord[]}
 */
export function mapHydratedJobRowsToRecords(rows = []) {
  return rows.map((row) => mapHydratedJobRowToRecord(row));
}
