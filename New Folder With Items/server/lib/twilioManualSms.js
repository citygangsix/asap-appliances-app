import { mapCommunicationDraftToInsert } from "../../src/integrations/supabase/mappers/communications.js";
import { runCreateCommunicationMutation } from "../../src/integrations/supabase/mutations/communications.js";
import {
  createOutboundContactAttempt,
  ensureCustomerContact,
  ensureTechnicianContact,
  findCustomerOutreachProfile,
  isAutomatedTrigger,
  isCustomerOptedOut,
  normalizePhoneNumber,
} from "./customerOutreach.js";
import { getServerSupabaseClient, getTwilioServerConfig } from "./supabaseAdmin.js";
import { sendOutboundSms } from "./twilioOutboundNotifications.js";

const MAX_MANUAL_SMS_LENGTH = 1600;

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeSmsDestination(value) {
  const rawValue = toNullableString(value);

  if (!rawValue) {
    return null;
  }

  const digits = rawValue.replace(/\D/g, "");

  if (rawValue.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

function resolveContactType(payload) {
  return payload.contactType === "technician" || payload.persistTechnicianContact === true
    ? "technician"
    : "customer";
}

function resolveTriggerSource(payload) {
  return toNullableString(payload.triggerSource) || "manual_phone_sms";
}

function shouldPersistCustomerContact(payload, triggerSource) {
  return (
    payload.persistCustomerContact !== false &&
    (payload.persistCustomerContact === true || triggerSource.startsWith("manual_phone"))
  );
}

function shouldPersistTechnicianContact(payload, triggerSource, contactType) {
  return (
    payload.persistTechnicianContact !== false &&
    (payload.persistTechnicianContact === true ||
      (contactType === "technician" && triggerSource.startsWith("manual_phone")))
  );
}

function buildSmsPreview(body) {
  const trimmed = String(body ?? "").trim();
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function looksLikeLocalAttachmentReference(body) {
  return /^file:\/\//iu.test(body) || /\/var\/mobile\/Library\/SMS\/Attachments\//iu.test(body);
}

async function createManualSmsCommunicationLog(client, config, payload) {
  if (!payload.customerId) {
    return null;
  }

  return runCreateCommunicationMutation(
    client,
    mapCommunicationDraftToInsert({
      customerId: payload.customerId,
      linkedJobId: payload.jobId || null,
      invoiceId: null,
      communicationChannel: "text",
      direction: "outbound",
      communicationStatus: "awaiting_callback",
      previewText: buildSmsPreview(payload.body),
      transcriptText: payload.body,
      callHighlights: null,
      callSummarySections: null,
      transcriptionStatus: null,
      transcriptionError: null,
      extractedEventLabel: "Manual SMS sent from phone CRM.",
      occurredAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      fromNumber: config.phoneNumber,
      toNumber: payload.toNumber,
      providerName: "twilio",
      providerMessageSid: payload.providerMessageSid || null,
      providerCallSid: null,
    }),
  );
}

export async function requestManualOutboundSms(payload = {}) {
  const config = getTwilioServerConfig();
  const toNumber = normalizeSmsDestination(payload.toNumber || payload.customerPhone);
  const body = String(payload.body ?? "").trim();
  const contactType = resolveContactType(payload);
  const contactLabel = contactType === "technician" ? "technician" : "customer";
  const triggerSource = resolveTriggerSource(payload);
  const isAutomated = isAutomatedTrigger(triggerSource, payload.manualRetry === true);
  const dryRun = payload.dryRun === true;

  if (!toNumber) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: `Text message requires a valid ${contactLabel} phone number.`,
    };
  }

  if (!body) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: "Text message body is required.",
    };
  }

  if (looksLikeLocalAttachmentReference(body)) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message:
        "That looks like a phone-local attachment path. The Phone CRM can send text, not local iPhone file links. Paste normal text or a public https link.",
    };
  }

  if (body.length > MAX_MANUAL_SMS_LENGTH) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: `Text message must be ${MAX_MANUAL_SMS_LENGTH} characters or fewer.`,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      status: 200,
      dryRun: true,
      preview: {
        fromNumber: config.phoneNumber,
        toNumber,
        body,
        contactType,
      },
      message: "Dry run prepared manual SMS.",
    };
  }

  const client = getServerSupabaseClient();
  let customerContactStatus = "skipped";
  let technicianContactStatus = "skipped";
  let customerProfile = null;
  let resolvedCustomerId = null;
  let technicianProfile = null;
  let resolvedTechnicianId = null;

  if (contactType === "customer") {
    const customerLookup = await findCustomerOutreachProfile(client, {
      customerId: toNullableString(payload.customerId),
      customerPhone: toNumber,
    });

    customerContactStatus = customerLookup.status;
    customerProfile = customerLookup.customer;
    resolvedCustomerId = toNullableString(payload.customerId) || customerProfile?.customer_id || null;

    if (isCustomerOptedOut(customerProfile)) {
      await createOutboundContactAttempt(client, {
        customerId: resolvedCustomerId,
        communicationId: null,
        triggerSource,
        isAutomated,
        attemptChannel: "text",
        customerNumber: toNumber,
        outcome: "blocked_opt_out",
        outcomeDetail: "Manual SMS blocked because this customer is opted out.",
        completedAt: new Date().toISOString(),
        rawPayload: { ...payload, body },
      });

      return {
        ok: false,
        status: 409,
        dryRun,
        message: "This customer has opted out, so no text was sent.",
      };
    }

    if (!resolvedCustomerId && shouldPersistCustomerContact(payload, triggerSource)) {
      const customerContact = await ensureCustomerContact(client, {
        customerName: payload.customerName,
        customerPhone: toNumber,
        allowPlaceholderName: true,
        triggerSource,
        leadSource: payload.leadSource,
        sourceLeadId: payload.sourceLeadId,
      });

      customerContactStatus = customerContact.status;
      customerProfile = customerContact.customer || customerProfile;
      resolvedCustomerId = customerProfile?.customer_id || null;
    }
  } else if (shouldPersistTechnicianContact(payload, triggerSource, contactType)) {
    const technicianContact = await ensureTechnicianContact(client, {
      technicianName: payload.customerName || payload.technicianName,
      technicianPhone: toNumber,
      allowPlaceholderName: true,
      triggerSource,
      leadSource: payload.leadSource,
      sourceLeadId: payload.sourceLeadId,
    });

    technicianContactStatus = technicianContact.status;
    technicianProfile = technicianContact.technician || null;
    resolvedTechnicianId = technicianProfile?.tech_id || null;
  }

  let smsResult = null;

  try {
    smsResult = await sendOutboundSms({
      toNumber,
      body,
      dryRun: false,
      label: "manual-phone-crm-sms",
    });
  } catch (error) {
    console.error("[manual-sms][provider-send]", {
      contactType,
      toNumber,
      triggerSource,
      message: error?.message || "Manual SMS failed.",
    });
    await createOutboundContactAttempt(client, {
      customerId: resolvedCustomerId,
      communicationId: null,
      triggerSource,
      isAutomated,
      attemptChannel: "text",
      customerNumber: toNumber,
      outcome: "failed",
      outcomeDetail: error?.message || "Manual SMS failed.",
      completedAt: new Date().toISOString(),
      rawPayload: { ...payload, body },
    });

    return {
      ok: false,
      status: 502,
      dryRun: false,
      message: error?.message || "Text message failed.",
    };
  }

  let communicationRecord = null;
  let communicationLogError = null;

  try {
    communicationRecord = await createManualSmsCommunicationLog(client, config, {
      customerId: resolvedCustomerId,
      jobId: payload.jobId,
      toNumber,
      body,
      providerMessageSid: smsResult.providerMessageSid,
    });
  } catch (error) {
    communicationLogError = error?.message || "Text sent, but CRM communication log failed.";
    console.error("[manual-sms][communication-log]", error);
  }

  try {
    await createOutboundContactAttempt(client, {
      customerId: resolvedCustomerId,
      communicationId: communicationRecord?.communication_id || null,
      triggerSource,
      isAutomated,
      attemptChannel: "text",
      customerNumber: normalizePhoneNumber(toNumber) || toNumber,
      providerMessageSid: smsResult.providerMessageSid || null,
      outcome: "sent",
      outcomeDetail: communicationLogError,
      completedAt: new Date().toISOString(),
      rawPayload: {
        ...payload,
        body,
        contactType,
        technicianId: resolvedTechnicianId,
      },
    });
  } catch (error) {
    console.error("[manual-sms][attempt-log]", error);
  }

  return {
    ok: true,
    status: 200,
    dryRun: false,
    providerMessageSid: smsResult.providerMessageSid || null,
    communicationId: communicationRecord?.communication_id || null,
    contactType,
    customerId: resolvedCustomerId,
    customerContactStatus,
    technicianId: resolvedTechnicianId,
    technicianContactStatus,
    savedContactStatus: contactType === "technician" ? technicianContactStatus : customerContactStatus,
    message: communicationLogError
      ? `Text sent, but CRM logging needs attention: ${communicationLogError}`
      : `Text sent to ${toNumber}.`,
  };
}
