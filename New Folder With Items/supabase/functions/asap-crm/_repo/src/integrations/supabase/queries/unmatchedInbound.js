import { createQueryPlaceholder } from "../placeholders.js";

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function getUnmatchedInboundQueueQueryPlan() {
  return createQueryPlaceholder({
    key: "communications.unmatchedInboundQueue",
    table: "unmatched_inbound_communications",
    operation: "select_pending",
    details:
      "List pending unmatched inbound Twilio calls and texts that still need manual customer triage.",
    joins: [],
    expectedShape: "UnmatchedInboundCommunication[]",
  });
}

export async function runListPendingUnmatchedInboundQuery(client) {
  const result = await client
    .from("unmatched_inbound_communications")
    .select("*")
    .eq("resolution_status", "pending")
    .order("occurred_at", { ascending: false });

  return unwrapQueryResult("communications.unmatchedInboundQueue", result) || [];
}

export async function runGetUnmatchedInboundQuery(client, unmatchedCommunicationId) {
  const result = await client
    .from("unmatched_inbound_communications")
    .select("*")
    .eq("unmatched_communication_id", unmatchedCommunicationId)
    .maybeSingle();

  return unwrapQueryResult("communications.getUnmatchedInbound", result);
}

export async function runFindPendingUnmatchedInboundByField(client, field, value) {
  const result = await client
    .from("unmatched_inbound_communications")
    .select("*")
    .eq(field, value)
    .eq("resolution_status", "pending")
    .maybeSingle();

  return unwrapQueryResult("communications.findPendingUnmatchedInbound", result);
}
