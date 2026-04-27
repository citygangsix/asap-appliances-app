import { mapCustomerRowToDomain } from "../mappers/customers";
import { mapInvoiceRowToDomain } from "../mappers/invoices";
import { mapTechnicianRowToDomain } from "../mappers/technicians";

/** @typedef {import("../types/schema.js").CustomerRow} CustomerRow */
/** @typedef {import("../types/schema.js").InvoiceRow} InvoiceRow */
/** @typedef {import("../types/schema.js").JobRow} JobRow */
/** @typedef {import("../types/schema.js").TechnicianRow} TechnicianRow */
/** @typedef {import("../../../types/models.js").InvoiceRecord} InvoiceRecord */

/**
 * @typedef {JobRow & {
 *   customer?: CustomerRow|null
 * }} HydratedInvoiceJobRow
 */

/**
 * @typedef {InvoiceRow & {
 *   job?: HydratedInvoiceJobRow|null,
 *   technician?: TechnicianRow|null
 * }} HydratedInvoiceRow
 */

/**
 * @param {HydratedInvoiceRow} row
 * @returns {InvoiceRecord}
 */
export function mapHydratedInvoiceRowToRecord(row) {
  if (!row.job?.customer_id) {
    throw new Error(`Invoice ${row.invoice_id} is missing owning job/customer context.`);
  }

  return {
    ...mapInvoiceRowToDomain(row, {
      customerId: row.job.customer_id,
    }),
    customer: row.job.customer ? mapCustomerRowToDomain(row.job.customer) : null,
    technician: row.technician ? mapTechnicianRowToDomain(row.technician) : null,
  };
}

/**
 * @param {HydratedInvoiceRow[]} rows
 * @returns {InvoiceRecord[]}
 */
export function mapHydratedInvoiceRowsToRecords(rows = []) {
  return rows.map((row) => mapHydratedInvoiceRowToRecord(row));
}
