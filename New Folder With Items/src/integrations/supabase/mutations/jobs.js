import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

export function createJobMutation() {
  return createMutationPlaceholder({
    key: "jobs.create",
    table: "jobs",
    operation: "insert",
    details: "Create job row from JobDraft -> JobInsertPayload.",
    expectedPayload: "JobInsertPayload",
    expectedResult: "JobRow",
  });
}

export async function runCreateJobMutation(client, payload) {
  const result = await client.from("jobs").insert(payload).select("*").single();
  return unwrapMutationResult("jobs.create", result);
}

export function assignTechnicianToJobMutation() {
  return createMutationPlaceholder({
    key: "jobs.assignTechnician",
    table: "jobs",
    operation: "update_assignment",
    details: "Assign or unassign technician on a job and update dispatch fields.",
    expectedPayload: "JobUpdatePayload",
    expectedResult: "JobRow",
  });
}

export async function runAssignTechnicianToJobMutation(client, jobId, payload) {
  const result = await client.from("jobs").update(payload).eq("job_id", jobId).select("*").single();
  return unwrapMutationResult("jobs.assignTechnician", result);
}

export function updateJobStatusMutation() {
  return createMutationPlaceholder({
    key: "jobs.updateWorkflow",
    table: "jobs",
    operation: "update_status",
    details: "Update lifecycle, dispatch, payment, parts, or communication state.",
    expectedPayload: "JobUpdatePayload",
    expectedResult: "JobRow",
  });
}

export async function runUpdateJobStatusMutation(client, jobId, payload) {
  const result = await client.from("jobs").update(payload).eq("job_id", jobId).select("*").single();
  return unwrapMutationResult("jobs.updateWorkflow", result);
}
