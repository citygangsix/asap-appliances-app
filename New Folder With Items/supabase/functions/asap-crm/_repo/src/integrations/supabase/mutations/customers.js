import { createMutationPlaceholder } from "../placeholders";

function unwrapMutationResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

function normalizePhoneDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizePhoneLookup(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return null;
  }

  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function normalizePhoneForStorage(value) {
  const trimmed = String(value ?? "").trim();
  const digits = normalizePhoneDigits(trimmed);

  if (!trimmed || !digits) {
    return trimmed || null;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15
    ? `+${digits}`
    : trimmed;
}

function normalizeCustomerPhonePayload(payload) {
  return {
    ...payload,
    ...(payload.primary_phone === undefined
      ? {}
      : { primary_phone: normalizePhoneForStorage(payload.primary_phone) }),
    ...(payload.secondary_phone === undefined
      ? {}
      : { secondary_phone: normalizePhoneForStorage(payload.secondary_phone) }),
  };
}

async function listCustomerPhoneRows(client) {
  const result = await client
    .from("customers")
    .select("customer_id,name,primary_phone,secondary_phone");

  return unwrapMutationResult("customers.listForDuplicatePhoneCheck", result) || [];
}

async function getCustomerRowById(client, customerId) {
  const result = await client
    .from("customers")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  return unwrapMutationResult("customers.getDuplicatePhoneMatch", result);
}

async function findExistingCustomerByPhone(client, phoneNumbers, exceptCustomerId = null) {
  const targetPhones = new Set(phoneNumbers.map(normalizePhoneLookup).filter(Boolean));

  if (targetPhones.size === 0) {
    return null;
  }

  const customers = await listCustomerPhoneRows(client);

  return (
    customers.find((customer) => {
      if (exceptCustomerId && customer.customer_id === exceptCustomerId) {
        return false;
      }

      return [customer.primary_phone, customer.secondary_phone]
        .map(normalizePhoneLookup)
        .some((phone) => phone && targetPhones.has(phone));
    }) || null
  );
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
  const normalizedPayload = normalizeCustomerPhonePayload(payload);
  const existingCustomer = await findExistingCustomerByPhone(client, [
    normalizedPayload.primary_phone,
    normalizedPayload.secondary_phone,
  ]);

  if (existingCustomer) {
    return (await getCustomerRowById(client, existingCustomer.customer_id)) || existingCustomer;
  }

  const result = await client.from("customers").insert(normalizedPayload).select("*").single();
  return unwrapMutationResult("customers.create", result);
}

export async function runUpdateCustomerMutation(client, customerId, payload) {
  const normalizedPayload = normalizeCustomerPhonePayload(payload);
  const existingCustomer = await findExistingCustomerByPhone(
    client,
    [normalizedPayload.primary_phone, normalizedPayload.secondary_phone],
    customerId,
  );

  if (existingCustomer) {
    throw new Error(
      `customers.update: phone number already belongs to ${existingCustomer.name || "another customer"}.`,
    );
  }

  const result = await client
    .from("customers")
    .update(normalizedPayload)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  return unwrapMutationResult("customers.update", result);
}
