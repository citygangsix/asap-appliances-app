import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function createTechnicianPayoutMutation() {
  return createMutationPlaceholder({
    key: "technicianPayouts.create",
    table: "technician_payouts",
    operation: "insert",
    details: "Create technician payout batch row.",
    expectedPayload: "TechnicianPayoutInsertPayload",
    expectedResult: "TechnicianPayoutRow",
  });
}

export async function runCreateTechnicianPayoutMutation(client, payload) {
  const result = await client.from("technician_payouts").insert(payload).select("*").single();
  return unwrapMutationResult("technicianPayouts.create", result);
}

export function linkPayoutInvoicesMutation() {
  return createMutationPlaceholder({
    key: "technicianPayouts.linkInvoices",
    table: "technician_payout_invoice_links",
    operation: "insert_many",
    details: "Create payout-to-invoice link rows.",
    expectedPayload: "TechnicianPayoutInvoiceLinkInsertPayload[]",
    expectedResult: "TechnicianPayoutInvoiceLinkRow[]",
  });
}

export async function runLinkPayoutInvoicesMutation(client, payload) {
  if (!payload.length) {
    return [];
  }

  const result = await client
    .from("technician_payout_invoice_links")
    .upsert(payload, { onConflict: "payout_id,invoice_id" })
    .select("*");

  return unwrapMutationResult("technicianPayouts.linkInvoices", result) || [];
}
