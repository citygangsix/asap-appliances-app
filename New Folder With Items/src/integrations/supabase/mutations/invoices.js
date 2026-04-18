import { createMutationPlaceholder } from "../placeholders";

export function createInvoiceMutation() {
  return createMutationPlaceholder({
    key: "invoices.createForJob",
    table: "invoices",
    operation: "insert",
    details: "Create invoice row for a job from InvoiceDraft -> InvoiceInsertPayload.",
    expectedPayload: "InvoiceInsertPayload",
    expectedResult: "InvoiceRow",
  });
}

export function updateInvoicePaymentMutation() {
  return createMutationPlaceholder({
    key: "invoices.updatePaymentStatus",
    table: "invoices",
    operation: "update_payment",
    details: "Update invoice payment state, collected amount, and outstanding balance.",
    expectedPayload: "InvoicePaymentUpdatePayload",
    expectedResult: "InvoiceRow",
  });
}
