import { createQueryPlaceholder } from "../placeholders";

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? [];
}

export function listJobTimelineEventsQuery(jobId) {
  return createQueryPlaceholder({
    key: "jobTimeline.list",
    table: "job_timeline_events",
    operation: "select",
    details: `List timeline events ordered by event_at desc for job_id=${jobId || "<all>"}`,
    joins: [],
    expectedShape: "JobTimelineEventRow[]",
  });
}

export async function runListJobTimelineEventsQuery(client, jobId = null) {
  let query = client
    .from("job_timeline_events")
    .select("*")
    .order("event_at", { ascending: false });

  if (jobId) {
    query = query.eq("job_id", jobId);
  }

  return unwrapQueryResult("jobTimeline.list", await query);
}
