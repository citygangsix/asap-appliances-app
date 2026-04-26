import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function createJobTimelineEventMutation() {
  return createMutationPlaceholder({
    key: "jobTimeline.append",
    table: "job_timeline_events",
    operation: "insert",
    details: "Append immutable timeline event row for a job.",
    expectedPayload: "JobTimelineEventInsertPayload",
    expectedResult: "JobTimelineEventRow",
  });
}

export async function runCreateJobTimelineEventMutation(client, payload) {
  const result = await client.from("job_timeline_events").insert(payload).select("*").single();
  return unwrapMutationResult("jobTimeline.append", result);
}
