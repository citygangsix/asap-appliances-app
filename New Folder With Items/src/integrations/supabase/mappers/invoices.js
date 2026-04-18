import { formatDateOnly, stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema").DbInvoicePaymentStatus} DbInvoicePaymentStatus */
/** @typedef {import("../types/schema").InvoiceInsertPayload} InvoiceInsertPayload */
/** @typedef {import("../types/schema").InvoicePaymentUpdatePayload} InvoicePaymentUpdatePayload */
/** @typedef {import("../types/schema").InvoiceRow} InvoiceRow */
/** @typedef {import("../../types/models").Invoice} Invoice */
/** @typedef {import("../../types/models").InvoiceDraft} InvoiceDraft */
/** @typedef {import("../../types/models").InvoicePaymentPatch} InvoicePaymentPatch */
/** @typedef {import("../../types/models").PaymentStatus} PaymentStatus */

/**
 * @param {DbInvoicePaymentStatus} status
 * @param {InvoiceRow["invoice_type"]} invoiceType
 * @returns {PaymentStatus}
 */
export function mapDbInvoicePaymentStatusToDomain(status, invoiceType) {
  if (status === "failed") {
    return "failed";
  }

  if (status === "partial") {
    return "partial";
  }

  if (status === "paid") {
    return invoiceType === "labor" ? "labor_paid" : "parts_paid";
  }

  if (status === "open") {
    return invoiceType === "labor" ? "labor_due" : "parts_due";
  }

  return "none_due";
}

/**
 * @param {PaymentStatus} status
 * @returns {DbInvoicePaymentStatus}
 */
export function mapDomainInvoicePaymentStatusToDb(status) {
  if (status === "failed") {
    return "failed";
  }

  if (status === "partial") {
    return "partial";
  }

  if (status === "parts_paid" || status === "labor_paid") {
    return "paid";
  }

  if (status === "parts_due" || status === "labor_due") {
    return "open";
  }

  return "draft";
}

/**
 * @param {InvoiceRow} row
 * @param {{ customerId: string }} relations
 * @returns {Invoice}
 */
export function mapInvoiceRowToDomain(row, relations) {
  return {
    invoiceId: row.invoice_id,
    customerId: relations.customerId,
    jobId: row.job_id,
    techId: row.servicing_tech_id,
    issuedOn: formatDateOnly(row.issued_on),
    dueOn: formatDateOnly(row.due_on || row.issued_on),
    totalAmount: row.total_amount,
    collectedAmount: row.collected_amount,
    outstandingBalance: row.outstanding_balance,
    paymentStatus: mapDbInvoicePaymentStatusToDomain(row.payment_status, row.invoice_type),
    invoiceType: row.invoice_type,
  };
}

/**
 * @param {InvoiceDraft} draft
 * @returns {InvoiceInsertPayload}
 */
export function mapInvoiceDraftToInsert(draft) {
  const collectedAmount = draft.collectedAmount || 0;
  const outstandingBalance =
    draft.outstandingBalance !== undefined ? draft.outstandingBalance : draft.totalAmount - collectedAmount;

  return {
    invoice_number: draft.invoiceNumber,
    job_id: draft.jobId,
    servicing_tech_id: toNullable(draft.techId),
    invoice_type: draft.invoiceType,
    payment_status: mapDomainInvoicePaymentStatusToDb(draft.paymentStatus),
    issued_on: draft.issuedOn,
    due_on: toNullable(draft.dueOn),
    paid_at:
      draft.paymentStatus === "parts_paid" || draft.paymentStatus === "labor_paid"
        ? `${draft.issuedOn}T17:00:00Z`
        : null,
    currency_code: "USD",
    total_amount: draft.totalAmount,
    collected_amount: collectedAmount,
    outstanding_balance: outstandingBalance,
    processor_reference: toNullable(draft.processorReference),
    payment_failed_at: draft.paymentStatus === "failed" ? `${draft.issuedOn}T17:00:00Z` : null,
    notes: toNullable(draft.notes),
  };
}

/**
 * @param {InvoicePaymentPatch} patch
 * @returns {InvoicePaymentUpdatePayload}
 */
export function mapInvoicePaymentPatchToUpdate(patch) {
  return stripUndefined({
    payment_status: mapDomainInvoicePaymentStatusToDb(patch.paymentStatus),
    collected_amount: patch.collectedAmount,
    outstanding_balance: patch.outstandingBalance,
    paid_at: patch.paidAt,
    payment_failed_at: patch.paymentFailedAt,
  });
}
