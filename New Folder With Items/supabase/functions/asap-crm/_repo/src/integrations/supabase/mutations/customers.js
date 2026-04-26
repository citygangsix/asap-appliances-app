import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

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

export async function runCreateCustomerMutation(client, payload) {
  const result = await client.from("customers").insert(payload).select("*").single();
  return unwrapMutationResult("customers.create", result);
}

export async function runUpdateCustomerMutation(client, customerId, payload) {
  const result = await client
    .from("customers")
    .update(payload)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  return unwrapMutationResult("customers.update", result);
}
