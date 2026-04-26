import { mapTechnicianPayoutRowToDomain } from "../mappers/technicianPayouts";
import { mapTechnicianRowToDomain } from "../mappers/technicians";

/** @typedef {import("../types/schema").TechnicianPayoutInvoiceLinkRow} TechnicianPayoutInvoiceLinkRow */
/** @typedef {import("../types/schema").TechnicianPayoutRow} TechnicianPayoutRow */
/** @typedef {import("../types/schema").TechnicianRow} TechnicianRow */
/** @typedef {import("../../../types/models").TechnicianPayoutRecord} TechnicianPayoutRecord */

/**
 * @typedef {Pick<TechnicianPayoutInvoiceLinkRow, "invoice_id">} HydratedTechnicianPayoutInvoiceLinkRow
 */

/**
 * @typedef {TechnicianPayoutRow & {
 *   technician?: TechnicianRow|null,
 *   invoice_links?: HydratedTechnicianPayoutInvoiceLinkRow[]|null
 * }} HydratedTechnicianPayoutRow
 */

/**
 * @param {HydratedTechnicianPayoutRow} row
 * @returns {TechnicianPayoutRecord}
 */
export function mapHydratedTechnicianPayoutRowToRecord(row) {
  return {
    ...mapTechnicianPayoutRowToDomain(row, {
      invoiceIds: (row.invoice_links || []).map((link) => link.invoice_id),
    }),
    technician: row.technician ? mapTechnicianRowToDomain(row.technician) : null,
  };
}

/**
 * @param {HydratedTechnicianPayoutRow[]} rows
 * @returns {TechnicianPayoutRecord[]}
 */
export function mapHydratedTechnicianPayoutRowsToRecords(rows = []) {
  return rows.map((row) => mapHydratedTechnicianPayoutRowToRecord(row));
}
