const OPT_OUT_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const PLACEHOLDER_CUSTOMER_NAMES = new Set([
  "customer",
  "the customer",
  "unknown",
  "unknown customer",
  "thumbtack customer",
]);
const PLACEHOLDER_TECHNICIAN_NAMES = new Set([
  ...PLACEHOLDER_CUSTOMER_NAMES,
  "technician",
  "the technician",
  "unknown technician",
  "new technician",
]);

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
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

export function normalizePhoneNumber(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return null;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

export function hasMeaningfulCustomerName(customerName, customerPhone = null) {
  const name = toNullableString(customerName);

  if (!name) {
    return false;
  }

  if (PLACEHOLDER_CUSTOMER_NAMES.has(name.toLowerCase())) {
    return false;
  }

  const nameDigits = normalizePhoneLookup(name);
  const phoneDigits = normalizePhoneLookup(customerPhone);

  return !(nameDigits && phoneDigits && nameDigits === phoneDigits);
}

export function hasMeaningfulTechnicianName(technicianName, technicianPhone = null) {
  const name = toNullableString(technicianName);

  if (!name) {
    return false;
  }

  if (PLACEHOLDER_TECHNICIAN_NAMES.has(name.toLowerCase())) {
    return false;
  }

  const nameDigits = normalizePhoneLookup(name);
  const phoneDigits = normalizePhoneLookup(technicianPhone);

  return !(nameDigits && phoneDigits && nameDigits === phoneDigits);
}

function formatPhoneContactName(customerPhone) {
  const normalizedPhone = normalizePhoneNumber(customerPhone);
  const digits = normalizePhoneLookup(normalizedPhone);

  if (digits?.length === 10) {
    return `Phone contact (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return normalizedPhone ? `Phone contact ${normalizedPhone}` : null;
}

function formatTechnicianPhoneContactName(technicianPhone) {
  const normalizedPhone = normalizePhoneNumber(technicianPhone);
  const digits = normalizePhoneLookup(normalizedPhone);

  if (digits?.length === 10) {
    return `Technician (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return normalizedPhone ? `Technician ${normalizedPhone}` : null;
}

function unwrapQueryResult(label, result) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

function sanitizePatch(patch) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
}

async function listCustomerOutreachProfiles(client) {
  const result = await client
    .from("customers")
    .select(
      "customer_id,name,primary_phone,secondary_phone,sms_opted_out_at,voice_opted_out_at,auto_contact_cooldown_until",
    );

  return unwrapQueryResult("customers.listOutreachProfiles", result) || [];
}

async function getCustomerOutreachProfileById(client, customerId) {
  if (!customerId) {
    return null;
  }

  const result = await client
    .from("customers")
    .select(
      "customer_id,name,primary_phone,secondary_phone,sms_opted_out_at,voice_opted_out_at,auto_contact_cooldown_until",
    )
    .eq("customer_id", customerId)
    .maybeSingle();

  return unwrapQueryResult("customers.getOutreachProfileById", result);
}

export async function findCustomerOutreachProfile(client, { customerId = null, customerPhone = null } = {}) {
  if (customerId) {
    const customer = await getCustomerOutreachProfileById(client, customerId);
    return {
      status: customer ? "matched" : "not_found",
      customer,
    };
  }

  const normalizedTarget = normalizePhoneLookup(customerPhone);

  if (!normalizedTarget) {
    return {
      status: "missing_phone",
      customer: null,
    };
  }

  const customers = await listCustomerOutreachProfiles(client);
  const matches = customers.filter((customer) =>
    [customer.primary_phone, customer.secondary_phone]
      .map(normalizePhoneLookup)
      .some((candidate) => candidate && candidate === normalizedTarget),
  );

  if (matches.length === 1) {
    return {
      status: "matched",
      customer: matches[0],
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      customer: null,
    };
  }

  return {
    status: "not_found",
    customer: null,
  };
}

function buildCapturedCustomerNotes({ triggerSource, leadSource, sourceLeadId }) {
  const parts = ["Automatically captured from initial call."];
  const source = toNullableString(leadSource) || toNullableString(triggerSource);
  const leadId = toNullableString(sourceLeadId);

  if (source) {
    parts.push(`Source: ${source}.`);
  }

  if (leadId) {
    parts.push(`Lead ID: ${leadId}.`);
  }

  return parts.join(" ");
}

async function createCapturedCustomerContact(client, payload) {
  const now = new Date().toISOString();
  const result = await client
    .from("customers")
    .insert({
      name: payload.customerName,
      primary_phone: payload.customerPhone,
      secondary_phone: null,
      email: null,
      city: "Unknown",
      service_area: "Unassigned",
      customer_segment: "New customer",
      communication_status: "unresolved",
      last_contact_at: now,
      lifetime_value: 0,
      notes: buildCapturedCustomerNotes(payload),
    })
    .select(
      "customer_id,name,primary_phone,secondary_phone,sms_opted_out_at,voice_opted_out_at,auto_contact_cooldown_until",
    )
    .single();

  return unwrapQueryResult("customers.createCapturedContact", result);
}

export async function ensureCustomerContact(client, payload = {}) {
  const customerPhone = normalizePhoneNumber(payload.customerPhone);

  if (!customerPhone) {
    return {
      status: "skipped",
      customer: null,
    };
  }

  const existingLookup = await findCustomerOutreachProfile(client, { customerPhone });

  if (existingLookup.status === "matched" || existingLookup.status === "ambiguous") {
    return existingLookup;
  }

  const providedCustomerName = toNullableString(payload.customerName);
  const customerName = hasMeaningfulCustomerName(providedCustomerName, customerPhone)
    ? providedCustomerName
    : payload.allowPlaceholderName === true
      ? formatPhoneContactName(customerPhone)
      : null;

  if (!customerName) {
    return {
      status: "skipped",
      customer: null,
    };
  }

  try {
    return {
      status: "created",
      customer: await createCapturedCustomerContact(client, {
        ...payload,
        customerName,
        customerPhone,
      }),
    };
  } catch (error) {
    const retryLookup = await findCustomerOutreachProfile(client, { customerPhone });

    if (retryLookup.status === "matched" || retryLookup.status === "ambiguous") {
      return retryLookup;
    }

    throw error;
  }
}

async function listTechnicianOutreachProfiles(client) {
  const result = await client
    .from("technicians")
    .select("tech_id,name,primary_phone,email,service_area");

  return unwrapQueryResult("technicians.listOutreachProfiles", result) || [];
}

export async function findTechnicianOutreachProfile(client, { technicianPhone = null } = {}) {
  const normalizedTarget = normalizePhoneLookup(technicianPhone);

  if (!normalizedTarget) {
    return {
      status: "missing_phone",
      technician: null,
    };
  }

  const technicians = await listTechnicianOutreachProfiles(client);
  const matches = technicians.filter((technician) => {
    const candidatePhone = normalizePhoneLookup(technician.primary_phone);
    return candidatePhone && candidatePhone === normalizedTarget;
  });

  if (matches.length === 1) {
    return {
      status: "matched",
      technician: matches[0],
    };
  }

  if (matches.length > 1) {
    return {
      status: "ambiguous",
      technician: null,
    };
  }

  return {
    status: "not_found",
    technician: null,
  };
}

function buildCapturedTechnicianNotes({ triggerSource, leadSource, sourceLeadId }) {
  const parts = ["Automatically captured from initial technician call."];
  const source = toNullableString(leadSource) || toNullableString(triggerSource);
  const leadId = toNullableString(sourceLeadId);

  if (source) {
    parts.push(`Source: ${source}.`);
  }

  if (leadId) {
    parts.push(`Lead ID: ${leadId}.`);
  }

  return parts.join(" ");
}

async function createCapturedTechnicianContact(client, payload) {
  const result = await client
    .from("technicians")
    .insert({
      name: payload.technicianName,
      primary_phone: payload.technicianPhone,
      email: null,
      service_area: "Unassigned",
      service_zip_codes: [],
      skills: [],
      availability_notes: buildCapturedTechnicianNotes(payload),
      status_today: "unassigned",
      jobs_completed_this_week: 0,
      callback_rate_percent: 0,
      payout_total: 0,
      gas_reimbursement_total: 0,
      score: 0,
    })
    .select("tech_id,name,primary_phone,email,service_area")
    .single();

  return unwrapQueryResult("technicians.createCapturedContact", result);
}

export async function ensureTechnicianContact(client, payload = {}) {
  const technicianPhone = normalizePhoneNumber(payload.technicianPhone || payload.customerPhone);

  if (!technicianPhone) {
    return {
      status: "skipped",
      technician: null,
    };
  }

  const existingLookup = await findTechnicianOutreachProfile(client, { technicianPhone });

  if (existingLookup.status === "matched" || existingLookup.status === "ambiguous") {
    return existingLookup;
  }

  const providedTechnicianName = toNullableString(payload.technicianName || payload.customerName);
  const technicianName = hasMeaningfulTechnicianName(providedTechnicianName, technicianPhone)
    ? providedTechnicianName
    : payload.allowPlaceholderName === true
      ? formatTechnicianPhoneContactName(technicianPhone)
      : null;

  if (!technicianName) {
    return {
      status: "skipped",
      technician: null,
    };
  }

  try {
    return {
      status: "created",
      technician: await createCapturedTechnicianContact(client, {
        ...payload,
        technicianName,
        technicianPhone,
      }),
    };
  } catch (error) {
    const retryLookup = await findTechnicianOutreachProfile(client, { technicianPhone });

    if (retryLookup.status === "matched" || retryLookup.status === "ambiguous") {
      return retryLookup;
    }

    throw error;
  }
}

export function isGlobalOptOutMessage(messageBody) {
  const normalized = String(messageBody ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  return Boolean(normalized && OPT_OUT_KEYWORDS.has(normalized));
}

export function isCustomerOptedOut(customer) {
  return Boolean(customer?.sms_opted_out_at || customer?.voice_opted_out_at);
}

export function isAutomatedTrigger(triggerSource, manualRetry = false) {
  if (manualRetry === true) {
    return false;
  }

  const normalized = String(triggerSource ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return !normalized.startsWith("manual");
}

export function buildCooldownUntil(hours, now = new Date()) {
  const next = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return next.toISOString();
}

export async function clearCustomerAutoContactCooldown(client, customerId) {
  if (!customerId) {
    return null;
  }

  const result = await client
    .from("customers")
    .update({ auto_contact_cooldown_until: null })
    .eq("customer_id", customerId)
    .select("customer_id,auto_contact_cooldown_until")
    .single();

  return unwrapQueryResult("customers.clearAutoContactCooldown", result);
}

export async function setCustomerAutoContactCooldown(client, customerId, cooldownUntil) {
  if (!customerId || !cooldownUntil) {
    return null;
  }

  const result = await client
    .from("customers")
    .update({ auto_contact_cooldown_until: cooldownUntil })
    .eq("customer_id", customerId)
    .select("customer_id,auto_contact_cooldown_until")
    .single();

  return unwrapQueryResult("customers.setAutoContactCooldown", result);
}

export async function applyGlobalCustomerOptOut(client, customerId, optedOutAt = new Date().toISOString()) {
  if (!customerId) {
    return null;
  }

  const result = await client
    .from("customers")
    .update({
      sms_opted_out_at: optedOutAt,
      voice_opted_out_at: optedOutAt,
      auto_contact_cooldown_until: null,
    })
    .eq("customer_id", customerId)
    .select("customer_id,sms_opted_out_at,voice_opted_out_at")
    .single();

  return unwrapQueryResult("customers.applyGlobalOptOut", result);
}

export async function createOutboundContactAttempt(client, attempt) {
  const result = await client
    .from("outbound_contact_attempts")
    .insert(
      sanitizePatch({
        customer_id: attempt.customerId || null,
        communication_id: attempt.communicationId || null,
        trigger_source: attempt.triggerSource || "unknown",
        is_automated: attempt.isAutomated === true,
        attempt_channel: attempt.attemptChannel,
        customer_number: attempt.customerNumber,
        provider_call_sid: toNullableString(attempt.providerCallSid),
        provider_parent_call_sid: toNullableString(attempt.providerParentCallSid),
        provider_message_sid: toNullableString(attempt.providerMessageSid),
        outcome: attempt.outcome || "created",
        outcome_detail: toNullableString(attempt.outcomeDetail),
        requested_at: attempt.requestedAt || new Date().toISOString(),
        completed_at: attempt.completedAt || null,
        cooldown_applied_until: attempt.cooldownAppliedUntil || null,
        raw_payload: attempt.rawPayload || {},
      }),
    )
    .select("*")
    .single();

  return unwrapQueryResult("outboundContactAttempts.create", result);
}

export async function findLatestOutboundContactAttempt(client, { communicationId, attemptChannel = null } = {}) {
  if (!communicationId) {
    return null;
  }

  let query = client
    .from("outbound_contact_attempts")
    .select("*")
    .eq("communication_id", communicationId)
    .order("requested_at", { ascending: false })
    .limit(1);

  if (attemptChannel) {
    query = query.eq("attempt_channel", attemptChannel);
  }

  const result = await query.maybeSingle();
  return unwrapQueryResult("outboundContactAttempts.findLatest", result);
}

export async function updateOutboundContactAttempt(client, attemptId, patch) {
  if (!attemptId) {
    return null;
  }

  const result = await client
    .from("outbound_contact_attempts")
    .update(
      sanitizePatch({
        provider_call_sid:
          patch.providerCallSid === undefined ? undefined : toNullableString(patch.providerCallSid),
        provider_parent_call_sid:
          patch.providerParentCallSid === undefined
            ? undefined
            : toNullableString(patch.providerParentCallSid),
        provider_message_sid:
          patch.providerMessageSid === undefined
            ? undefined
            : toNullableString(patch.providerMessageSid),
        outcome: patch.outcome,
        outcome_detail:
          patch.outcomeDetail === undefined ? undefined : toNullableString(patch.outcomeDetail),
        completed_at: patch.completedAt,
        cooldown_applied_until: patch.cooldownAppliedUntil,
        raw_payload: patch.rawPayload,
      }),
    )
    .eq("attempt_id", attemptId)
    .select("*")
    .single();

  return unwrapQueryResult("outboundContactAttempts.update", result);
}

export async function findLatestAutomatedCallAttemptByNumber(client, customerNumber) {
  if (!customerNumber) {
    return null;
  }

  const result = await client
    .from("outbound_contact_attempts")
    .select("attempt_id,requested_at,cooldown_applied_until,outcome")
    .eq("attempt_channel", "call")
    .eq("is_automated", true)
    .eq("customer_number", customerNumber)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return unwrapQueryResult("outboundContactAttempts.findLatestAutomatedCallByNumber", result);
}

export function buildMissedCallSmsBody(customerName, template = null) {
  const safeName = toNullableString(customerName);

  if (template) {
    return template.replaceAll("{{customerName}}", safeName || "there");
  }

  return safeName
    ? `Hi ${safeName}, this is ASAP Appliances. I just tried calling about your appliance issue. Reply with your address and appliance details and we'll get you scheduled.`
    : "Hi, this is ASAP Appliances. I just tried calling about your appliance issue. Reply with your address and appliance details and we'll get you scheduled.";
}
