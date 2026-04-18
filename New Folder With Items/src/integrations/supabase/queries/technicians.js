import { createQueryPlaceholder } from "../placeholders";

export const TECHNICIAN_LIST_COLUMNS = `
  tech_id,
  name,
  primary_phone,
  email,
  service_area,
  skills,
  availability_notes,
  status_today,
  jobs_completed_this_week,
  callback_rate_percent,
  payout_total,
  gas_reimbursement_total,
  score,
  created_at,
  updated_at
`;

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? [];
}

export function listTechniciansQuery() {
  return createQueryPlaceholder({
    key: "technicians.list",
    table: "technicians",
    operation: "select",
    details: "List technician rows for roster and dispatch views.",
    joins: [],
    expectedShape: "TechnicianRow[]",
  });
}

export async function runListTechniciansQuery(client) {
  const result = await client
    .from("technicians")
    .select(TECHNICIAN_LIST_COLUMNS)
    .order("name", { ascending: true });

  return unwrapQueryResult("technicians.list", result);
}

export function getTechnicianRosterQueryPlan() {
  return createQueryPlaceholder({
    key: "technicians.roster",
    table: "technicians",
    operation: "hydrated_select",
    details: "Load technician roster with payout summary and current dispatch-facing metrics.",
    joins: [
      "technician_payouts.tech_id -> technicians.tech_id",
      "jobs.tech_id -> technicians.tech_id",
    ],
    expectedShape: "TechniciansPageData",
  });
}
