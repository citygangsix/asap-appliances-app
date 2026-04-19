import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

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

export async function runCreateInvoiceMutation(client, payload) {
  const result = await client.from("invoices").insert(payload).select("*").single();
  return unwrapMutationResult("invoices.createForJob", result);
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

export async function runUpdateInvoicePaymentMutation(client, invoiceId, payload) {
  const result = await client.from("invoices").update(payload).eq("invoice_id", invoiceId).select("*").single();
  return unwrapMutationResult("invoices.updatePaymentStatus", result);
}
