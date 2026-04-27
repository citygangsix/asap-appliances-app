import { mapHydratedJobRowToRecord } from "./jobs";
import { mapCommunicationRowToDomain } from "../mappers/communications";
import { mapCustomerRowToDomain } from "../mappers/customers";
import { mapInvoiceRowToDomain } from "../mappers/invoices";

/** @typedef {import("../types/schema.js").CommunicationRow} CommunicationRow */
/** @typedef {import("../types/schema.js").CustomerRow} CustomerRow */
/** @typedef {import("../types/schema.js").InvoiceRow} InvoiceRow */
/** @typedef {import("../types/schema.js").JobRow} JobRow */
/** @typedef {import("../types/schema.js").TechnicianRow} TechnicianRow */
/** @typedef {import("../../../types/models.js").CommunicationRecord} CommunicationRecord */

/**
 * @typedef {JobRow & {
 *   customer?: CustomerRow|null,
 *   technician?: TechnicianRow|null,
 *   invoice_rows?: InvoiceRow[]|null
 * }} HydratedLinkedJobRow
 */

/**
 * @typedef {CommunicationRow & {
 *   customer?: CustomerRow|null,
 *   invoice?: InvoiceRow|null,
 *   linked_job?: HydratedLinkedJobRow|null
 * }} HydratedCommunicationRow
 */

/**
 * @param {HydratedCommunicationRow} row
 * @returns {CommunicationRecord}
 */
export function mapHydratedCommunicationRowToRecord(row) {
  return {
    ...mapCommunicationRowToDomain(row),
    customer: row.customer ? mapCustomerRowToDomain(row.customer) : null,
    linkedJob: row.linked_job ? mapHydratedJobRowToRecord(row.linked_job) : null,
    invoice: row.invoice
      ? mapInvoiceRowToDomain(row.invoice, {
          customerId: row.customer_id,
        })
      : null,
  };
}

/**
 * @param {HydratedCommunicationRow[]} rows
 * @returns {CommunicationRecord[]}
 */
export function mapHydratedCommunicationRowsToRecords(rows = []) {
  return rows.map((row) => mapHydratedCommunicationRowToRecord(row));
}
