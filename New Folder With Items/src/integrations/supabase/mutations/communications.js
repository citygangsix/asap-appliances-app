import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function createCommunicationMutation() {
  return createMutationPlaceholder({
    key: "communications.createLog",
    table: "communications",
    operation: "insert",
    details: "Persist call or text log row from CommunicationDraft -> CommunicationInsertPayload.",
    expectedPayload: "CommunicationInsertPayload",
    expectedResult: "CommunicationRow",
  });
}

export async function runCreateCommunicationMutation(client, payload) {
  const result = await client.from("communications").insert(payload).select("*").single();
  return unwrapMutationResult("communications.createLog", result);
}

export function updateCommunicationStatusMutation() {
  return createMutationPlaceholder({
    key: "communications.updateStatus",
    table: "communications",
    operation: "update_status",
    details: "Resolve, re-open, or re-link communication rows.",
    expectedPayload: "Partial<CommunicationInsertPayload>",
    expectedResult: "CommunicationRow",
  });
}

export function markCommunicationReviewedMutation() {
  return createMutationPlaceholder({
    key: "communications.markReviewed",
    table: "communications",
    operation: "mark_reviewed",
    details:
      "Mark a communication reviewed and optionally pair that update with a job timeline follow-up.",
    expectedPayload: "Partial<CommunicationInsertPayload>",
    expectedResult: "CommunicationRow",
  });
}

export function attachCommunicationToJobMutation() {
  return createMutationPlaceholder({
    key: "communications.attachToJob",
    table: "communications",
    operation: "attach_to_job",
    details:
      "Attach an existing communication to a job and optionally append related job timeline context.",
    expectedPayload: "Partial<CommunicationInsertPayload>",
    expectedResult: "CommunicationRow",
  });
}

export async function runUpdateCommunicationMutation(client, communicationId, payload) {
  const result = await client
    .from("communications")
    .update(payload)
    .eq("communication_id", communicationId)
    .select("*")
    .single();

  return unwrapMutationResult("communications.updateStatus", result);
}
