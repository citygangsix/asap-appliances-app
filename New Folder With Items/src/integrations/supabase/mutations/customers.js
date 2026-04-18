import { createMutationPlaceholder } from "../placeholders";

export function createCustomerMutation() {
  return createMutationPlaceholder({
    key: "customers.create",
    table: "customers",
    operation: "insert",
    details: "Create customer row from CustomerDraft -> CustomerInsertPayload.",
    expectedPayload: "CustomerInsertPayload",
    expectedResult: "CustomerRow",
  });
}

export function updateCustomerMutation() {
  return createMutationPlaceholder({
    key: "customers.update",
    table: "customers",
    operation: "update",
    details: "Update mutable customer profile fields.",
    expectedPayload: "CustomerUpdatePayload",
    expectedResult: "CustomerRow",
  });
}
