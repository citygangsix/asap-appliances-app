import { createMutationPlaceholder } from "../placeholders.js";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function createUnmatchedInboundMutation() {
  return createMutationPlaceholder({
    key: "communications.createUnmatchedInbound",
    table: "unmatched_inbound_communications",
    operation: "insert",
    details: "Persist an inbound Twilio event that cannot yet be linked to a unique customer.",
    expectedPayload: "UnmatchedInboundCommunicationInsertPayload",
    expectedResult: "UnmatchedInboundCommunicationRow",
  });
}

export function resolveUnmatchedInboundMutation() {
  return createMutationPlaceholder({
    key: "communications.resolveUnmatchedInbound",
    table: "unmatched_inbound_communications",
    operation: "resolve_to_customer",
    details:
      "Resolve a pending unmatched inbound event by linking it to a real customer and created communication row.",
    expectedPayload: "UnmatchedInboundCommunicationUpdatePayload",
    expectedResult: "UnmatchedInboundCommunicationRow",
  });
}

export async function runCreateUnmatchedInboundMutation(client, payload) {
  const result = await client
    .from("unmatched_inbound_communications")
    .insert(payload)
    .select("*")
    .single();

  return unwrapMutationResult("communications.createUnmatchedInbound", result);
}

export async function runUpdateUnmatchedInboundMutation(client, unmatchedCommunicationId, payload) {
  const result = await client
    .from("unmatched_inbound_communications")
    .update(payload)
    .eq("unmatched_communication_id", unmatchedCommunicationId)
    .select("*")
    .single();

  return unwrapMutationResult("communications.resolveUnmatchedInbound", result);
}
