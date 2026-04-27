import { getTwilioServerConfig } from "./supabaseAdmin.js";
import { requestClickToCall } from "./twilioClickToCall.js";

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizePhoneNumber(value) {
  const trimmed = toNullableString(value);

  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/[^\d+]/g, "");

  if (!digits) {
    return null;
  }

  return digits.startsWith("+") ? digits : `+${digits.replace(/[^\d]/g, "")}`;
}

function readFirstString(...values) {
  for (const value of values) {
    const trimmed = toNullableString(value);

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function inferLeadPayload(payload = {}) {
  const customerName = readFirstString(
    payload.customerName,
    payload.customer_name,
    payload.name,
    payload.contactName,
    payload.contact_name,
    payload["customer.name"],
    payload["contact.name"],
    payload["lead.name"],
    payload.customer?.name,
    payload.customer?.fullName,
    payload.contact?.name,
    payload.lead?.name,
  );
  const customerPhone = normalizePhoneNumber(
    readFirstString(
      payload.customerPhone,
      payload.customer_phone,
      payload.phone,
      payload.phoneNumber,
      payload.contactPhone,
      payload.contact_phone,
      payload["customer.phone"],
      payload["contact.phone"],
      payload["lead.phone"],
      payload.customer?.phone,
      payload.customer?.phoneNumber,
      payload.contact?.phone,
      payload.lead?.phone,
    ),
  );
  const leadId = readFirstString(
    payload.leadId,
    payload.lead_id,
    payload.customerId,
    payload.customer_id,
    payload.conversationId,
    payload.conversation_id,
    payload.threadId,
    payload.thread_id,
    payload["lead.id"],
    payload["customer.id"],
    payload.lead?.id,
    payload.customer?.id,
  );

  return {
    customerName: customerName || "Thumbtack customer",
    customerPhone,
    leadId,
  };
}

function readProvidedSecret(headers = {}, payload = {}) {
  const authorization = toNullableString(headers.authorization);

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return toNullableString(authorization.slice(7));
  }

  return readFirstString(
    headers["x-thumbtack-secret"],
    headers["x-asap-webhook-secret"],
    payload.webhookSecret,
    payload.secret,
  );
}

function secureEquals(expected, provided) {
  const left = String(expected);
  const right = String(provided);

  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function authorizeThumbtackRequest(config, headers, payload) {
  const expectedSecret = toNullableString(config.thumbtackWebhookSecret);

  if (!expectedSecret) {
    return {
      ok: false,
      status: 500,
      message:
        "THUMBTACK_WEBHOOK_SECRET must be configured before the Thumbtack lead route can place calls.",
    };
  }

  const providedSecret = readProvidedSecret(headers, payload);

  if (!providedSecret) {
    return {
      ok: false,
      status: 401,
      message:
        "Thumbtack lead route requires a Bearer token, x-thumbtack-secret header, or webhookSecret field.",
    };
  }

  if (!secureEquals(expectedSecret, providedSecret)) {
    return {
      ok: false,
      status: 403,
      message: "Thumbtack lead secret is invalid.",
    };
  }

  return { ok: true };
}

export async function handleThumbtackLeadRequest(payload = {}, headers = {}) {
  const config = getTwilioServerConfig();
  const authorization = authorizeThumbtackRequest(config, headers, payload);

  if (!authorization.ok) {
    return authorization;
  }

  const lead = inferLeadPayload(payload);

  if (!lead.customerPhone) {
    return {
      ok: false,
      status: 400,
      message:
        "Thumbtack lead route requires a customer phone number. Supported fields include customerPhone, phone, contactPhone, and customer.phone.",
    };
  }

  const result = await requestClickToCall({
    customerName: lead.customerName,
    customerPhone: lead.customerPhone,
    agentPhone: config.thumbtackAssistantPhoneNumber || config.clickToCallAgentNumber,
    dryRun: payload.dryRun === true,
    triggerSource: "thumbtack_lead",
    leadSource: "thumbtack",
    sourceLeadId: lead.leadId,
    rawLeadPayload: payload,
  });

  return {
    ...result,
    source: "thumbtack",
    lead: {
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      leadId: lead.leadId,
    },
  };
}
