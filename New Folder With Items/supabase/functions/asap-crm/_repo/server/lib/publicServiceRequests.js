import { getServerSupabaseClient } from "./supabaseAdmin.js";

const CONSENT_COPY =
  "I agree to receive SMS messages from ASAP Appliance at the phone number I provided about scheduling, appointment updates, technician ETA, estimates, invoices, and service follow-ups. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";

function toCleanString(value, maxLength) {
  const cleaned = String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();

  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function normalizePhoneNumber(value) {
  const cleaned = toCleanString(value, 32);
  const digits = cleaned.replace(/\D/gu, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (cleaned.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return "";
}

function inferCityFromAddress(serviceAddress) {
  const parts = serviceAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[1] || parts[0] || "South Florida";
}

function buildScheduledStartAt() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

function buildLeadNote(request, metadata) {
  return [
    "Public website service request.",
    `Preferred timing: ${request.preferredTiming}.`,
    `Appliance: ${request.applianceType}.`,
    `SMS consent captured: yes.`,
    `Consent copy: ${CONSENT_COPY}`,
    metadata?.userAgent ? `User agent: ${metadata.userAgent}.` : null,
    metadata?.receivedAt ? `Submitted at: ${metadata.receivedAt}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function appendNotes(existingNotes, nextNote) {
  return [toCleanString(existingNotes, 3000), nextNote]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

function createReferenceId() {
  return `web-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
}

export function validatePublicServiceRequest(payload = {}) {
  const request = {
    name: toCleanString(payload.name, 120),
    phone: normalizePhoneNumber(payload.phone),
    serviceAddress: toCleanString(payload.serviceAddress, 240),
    applianceType: toCleanString(payload.applianceType, 80),
    issueSummary: toCleanString(payload.issueSummary, 1000),
    preferredTiming: toCleanString(payload.preferredTiming, 120),
    smsConsent: payload.smsConsent === true,
  };
  const fieldErrors = {};

  if (!request.name) {
    fieldErrors.name = "Name is required.";
  }

  if (!request.phone) {
    fieldErrors.phone = "Enter a valid phone number.";
  }

  if (!request.serviceAddress) {
    fieldErrors.serviceAddress = "Service address is required.";
  }

  if (!request.applianceType) {
    fieldErrors.applianceType = "Appliance type is required.";
  }

  if (!request.issueSummary) {
    fieldErrors.issueSummary = "Issue summary is required.";
  }

  if (!request.preferredTiming) {
    fieldErrors.preferredTiming = "Preferred timing is required.";
  }

  if (!request.smsConsent) {
    fieldErrors.smsConsent = "SMS consent is required before submitting.";
  }

  return {
    ok: Object.keys(fieldErrors).length === 0,
    request,
    fieldErrors,
  };
}

export async function handlePublicServiceRequestSubmission(payload = {}, metadata = {}) {
  const validation = validatePublicServiceRequest(payload);

  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      message: "Please complete the required service request fields.",
      fieldErrors: validation.fieldErrors,
    };
  }

  const request = validation.request;
  const receivedAt = metadata.receivedAt || new Date().toISOString();
  const leadNote = buildLeadNote(request, { ...metadata, receivedAt });

  if (payload.dryRun === true) {
    return {
      ok: true,
      status: 200,
      dryRun: true,
      message: "Dry run accepted. No customer or job was created.",
      referenceId: createReferenceId(),
      lead: {
        ...request,
        receivedAt,
      },
    };
  }

  const supabase = getServerSupabaseClient();
  const existingCustomerResult = await supabase
    .from("customers")
    .select("customer_id,notes")
    .eq("primary_phone", request.phone)
    .limit(1)
    .maybeSingle();

  if (existingCustomerResult.error) {
    throw existingCustomerResult.error;
  }

  let customerId = existingCustomerResult.data?.customer_id || null;

  if (customerId) {
    const updateResult = await supabase
      .from("customers")
      .update({
        name: request.name,
        city: inferCityFromAddress(request.serviceAddress),
        service_area: "South Florida",
        customer_segment: "web_service_request",
        last_contact_at: receivedAt,
        notes: appendNotes(existingCustomerResult.data?.notes, leadNote),
      })
      .eq("customer_id", customerId);

    if (updateResult.error) {
      throw updateResult.error;
    }
  } else {
    const customerInsertResult = await supabase
      .from("customers")
      .insert({
        name: request.name,
        primary_phone: request.phone,
        city: inferCityFromAddress(request.serviceAddress),
        service_area: "South Florida",
        customer_segment: "web_service_request",
        communication_status: "unread_message",
        last_contact_at: receivedAt,
        notes: leadNote,
      })
      .select("customer_id")
      .single();

    if (customerInsertResult.error) {
      throw customerInsertResult.error;
    }

    customerId = customerInsertResult.data.customer_id;
  }

  const jobInsertResult = await supabase
    .from("jobs")
    .insert({
      customer_id: customerId,
      appliance_label: request.applianceType,
      issue_summary: request.issueSummary,
      service_address: request.serviceAddress,
      scheduled_start_at: buildScheduledStartAt(),
      eta_window_text: request.preferredTiming,
      lifecycle_status: "new",
      dispatch_status: "unassigned",
      communication_status: "unread_message",
      priority: "normal",
      internal_notes: leadNote,
    })
    .select("job_id")
    .single();

  if (jobInsertResult.error) {
    throw jobInsertResult.error;
  }

  return {
    ok: true,
    status: 201,
    message: "Service request received.",
    customerId,
    jobId: jobInsertResult.data.job_id,
  };
}
