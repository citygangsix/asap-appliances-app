import { createMutationPlaceholder } from "../placeholders";

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
