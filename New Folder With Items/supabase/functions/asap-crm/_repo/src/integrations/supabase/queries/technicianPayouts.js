import { createQueryPlaceholder } from "../placeholders";
import { TECHNICIAN_COLUMNS } from "./jobs";

export const TECHNICIAN_PAYOUT_COLUMNS = `
  payout_id,
  tech_id,
  payout_number,
  period_start,
  period_end,
  payout_status,
  gross_amount,
  gas_reimbursement_amount,
  adjustment_amount,
  net_amount,
  note,
  scheduled_for,
  paid_at,
  created_at,
  updated_at
`;

const HYDRATED_TECHNICIAN_PAYOUT_SELECT = `
  ${TECHNICIAN_PAYOUT_COLUMNS},
  technician:technicians!technician_payouts_tech_id_fkey(${TECHNICIAN_COLUMNS}),
  invoice_links:technician_payout_invoice_links(invoice_id)
`;

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? [];
}

export function listTechnicianPayoutsQuery() {
  return createQueryPlaceholder({
    key: "technicianPayouts.list",
    table: "technician_payouts",
    operation: "select",
    details: "List payout rows plus linked invoice rows for low-level repository hydration.",
    joins: ["technician_payout_invoice_links.payout_id -> technician_payouts.payout_id"],
    expectedShape: "TechnicianPayoutRow[]",
  });
}

export function getTechnicianPayoutsHydrationQueryPlan() {
  return createQueryPlaceholder({
    key: "technicianPayouts.hydratedList",
    table: "technician_payouts",
    operation: "hydrated_select",
    details: "Load payout batches with linked technician context and invoice links for revenue and payout readiness views.",
    joins: [
      "technician_payouts.tech_id -> technicians.tech_id",
      "technician_payout_invoice_links.payout_id -> technician_payouts.payout_id",
    ],
    expectedShape: "TechnicianPayoutRecord[]",
  });
}

export async function runListTechnicianPayoutsQuery(client) {
  const result = await client
    .from("technician_payouts")
    .select(HYDRATED_TECHNICIAN_PAYOUT_SELECT)
    .order("created_at", { ascending: false });

  return unwrapQueryResult("technicianPayouts.hydratedList", result);
}
