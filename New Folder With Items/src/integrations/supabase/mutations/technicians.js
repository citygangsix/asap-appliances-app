import { createMutationPlaceholder } from "../placeholders";

export function updateTechnicianMutation() {
  return createMutationPlaceholder({
    key: "technicians.update",
    table: "technicians",
    operation: "update",
    details: "Update technician profile, status, or scorecard fields.",
    expectedPayload: "Partial<TechnicianInsertPayload>",
    expectedResult: "TechnicianRow",
  });
}
