import { stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema.js").TechnicianPayoutInsertPayload} TechnicianPayoutInsertPayload */
/** @typedef {import("../types/schema.js").TechnicianPayoutInvoiceLinkInsertPayload} TechnicianPayoutInvoiceLinkInsertPayload */
/** @typedef {import("../types/schema.js").TechnicianPayoutRow} TechnicianPayoutRow */
/** @typedef {import("../../../types/models.js").TechnicianPayout} TechnicianPayout */
/** @typedef {import("../../../types/models.js").TechnicianPayoutDraft} TechnicianPayoutDraft */
/** @typedef {import("../../../types/models.js").PayoutInvoiceLinkDraft} PayoutInvoiceLinkDraft */

/**
 * @param {TechnicianPayoutRow} row
 * @param {{ invoiceIds?: string[] }} [relations]
 * @returns {TechnicianPayout}
 */
export function mapTechnicianPayoutRowToDomain(row, relations = {}) {
  return {
    payoutId: row.payout_id,
    techId: row.tech_id,
    amount: row.net_amount,
    status: row.payout_status,
    note: row.note || "",
    invoiceIds: relations.invoiceIds || [],
  };
}

/**
 * @param {TechnicianPayoutDraft} draft
 * @returns {TechnicianPayoutInsertPayload}
 */
export function mapTechnicianPayoutDraftToInsert(draft) {
  return {
    tech_id: draft.techId,
    payout_number: null,
    period_start: draft.periodStart,
    period_end: draft.periodEnd,
    payout_status: draft.status,
    gross_amount: draft.amount,
    gas_reimbursement_amount: 0,
    adjustment_amount: 0,
    note: toNullable(draft.note),
    scheduled_for: null,
    paid_at: null,
  };
}

function getUniqueInvoiceIds(invoiceIds = []) {
  return Array.from(new Set(invoiceIds.map((invoiceId) => String(invoiceId || "").trim()).filter(Boolean)));
}

function splitAmountAcrossInvoices(totalAmount, invoiceCount) {
  const totalCents = Math.round(Number(totalAmount || 0) * 100);

  if (!Number.isFinite(totalCents) || totalCents <= 0 || invoiceCount <= 0) {
    return [];
  }

  const baseCents = Math.floor(totalCents / invoiceCount);
  const remainder = totalCents % invoiceCount;

  return Array.from({ length: invoiceCount }, (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100);
}

/**
 * @param {PayoutInvoiceLinkDraft} draft
 * @param {number} [allocatedAmount]
 * @returns {TechnicianPayoutInvoiceLinkInsertPayload[]}
 */
export function mapPayoutInvoiceLinksToInsert(draft, allocatedAmount) {
  const invoiceIds = getUniqueInvoiceIds(draft.invoiceIds);

  if (invoiceIds.length === 0) {
    return [];
  }

  const allocatedAmounts =
    allocatedAmount !== undefined
      ? invoiceIds.map(() => allocatedAmount)
      : splitAmountAcrossInvoices(draft.amount ?? invoiceIds.length, invoiceIds.length);

  return invoiceIds.map((invoiceId, index) => ({
    payout_id: draft.payoutId,
    invoice_id: invoiceId,
    allocated_amount: allocatedAmounts[index],
  }));
}

/**
 * @param {Partial<TechnicianPayoutDraft>} patch
 */
export function mapTechnicianPayoutPatchToUpdate(patch) {
  return stripUndefined({
    tech_id: patch.techId,
    payout_status: patch.status,
    gross_amount: patch.amount,
    note: patch.note,
    period_start: patch.periodStart,
    period_end: patch.periodEnd,
  });
}
