import { buildOperationsReadModels } from "./adapters/readModels";
import { getSupabaseClient, isSupabaseConfigured } from "./client";

let cachedReadModels = null;
let inflightReadModelsPromise = null;

function createQuery(client, table, orderColumn, ascending = true) {
  let query = client.from(table).select("*");

  if (orderColumn) {
    query = query.order(orderColumn, { ascending });
  }

  return query;
}

function unwrapResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data || [];
}

async function fetchSupabaseSnapshot() {
  if (!isSupabaseConfigured()) {
    throw new Error("Missing Supabase credentials.");
  }

  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase client was not created.");
  }

  const [
    customerResult,
    technicianResult,
    jobResult,
    invoiceResult,
    communicationResult,
    technicianPayoutResult,
    technicianPayoutInvoiceLinkResult,
    jobTimelineEventResult,
  ] = await Promise.all([
    createQuery(client, "customers", "name"),
    createQuery(client, "technicians", "name"),
    createQuery(client, "jobs", "scheduled_start_at"),
    createQuery(client, "invoices", "issued_on", false),
    createQuery(client, "communications", "occurred_at", false),
    createQuery(client, "technician_payouts", "created_at", false),
    createQuery(client, "technician_payout_invoice_links", "created_at"),
    createQuery(client, "job_timeline_events", "event_at", false),
  ]);

  return {
    customerRows: unwrapResult("customers", customerResult),
    technicianRows: unwrapResult("technicians", technicianResult),
    jobRows: unwrapResult("jobs", jobResult),
    invoiceRows: unwrapResult("invoices", invoiceResult),
    communicationRows: unwrapResult("communications", communicationResult),
    technicianPayoutRows: unwrapResult("technician_payouts", technicianPayoutResult),
    technicianPayoutInvoiceLinkRows: unwrapResult(
      "technician_payout_invoice_links",
      technicianPayoutInvoiceLinkResult,
    ),
    jobTimelineEventRows: unwrapResult("job_timeline_events", jobTimelineEventResult),
  };
}

export async function loadSupabaseReadModels(options = {}) {
  const { force = false } = options;

  if (!force && cachedReadModels) {
    return cachedReadModels;
  }

  if (!force && inflightReadModelsPromise) {
    return inflightReadModelsPromise;
  }

  inflightReadModelsPromise = fetchSupabaseSnapshot()
    .then((snapshot) => {
      const readModels = buildOperationsReadModels(snapshot);
      cachedReadModels = readModels;
      return readModels;
    })
    .finally(() => {
      inflightReadModelsPromise = null;
    });

  return inflightReadModelsPromise;
}

export function clearSupabaseReadModelsCache() {
  cachedReadModels = null;
  inflightReadModelsPromise = null;
}
