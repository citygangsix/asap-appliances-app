import {
  mapCommunicationDraftToInsert,
  mapCommunicationStatusPatchToUpdate,
} from "../../src/integrations/supabase/mappers/communications.js";
import {
  mapUnmatchedInboundCommunicationDraftToInsert,
  mapUnmatchedInboundCommunicationPatchToUpdate,
} from "../../src/integrations/supabase/mappers/unmatchedInbound.js";
import {
  runCreateCommunicationMutation,
  runUpdateCommunicationMutation,
} from "../../src/integrations/supabase/mutations/communications.js";
import {
  runCreateUnmatchedInboundMutation,
  runUpdateUnmatchedInboundMutation,
} from "../../src/integrations/supabase/mutations/unmatchedInbound.js";
import { runFindPendingUnmatchedInboundByField } from "../../src/integrations/supabase/queries/unmatchedInbound.js";
import { findLatestRecordingIntelligenceByCallSid } from "./twilioVoiceRecordings.js";
import {
  applyGlobalCustomerOptOut,
  clearCustomerAutoContactCooldown,
  isGlobalOptOutMessage,
} from "./customerOutreach.js";

function normalizePhoneNumber(value) {
  if (!value) {
    return null;
  }

  const digits = String(value).replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function buildSmsPreview(body) {
  const trimmed = (body || "").trim();

  if (!trimmed) {
    return "Inbound SMS received with no message body.";
  }

  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function formatCallStatus(callStatus) {
  return (callStatus || "received").replace(/-/g, " ");
}

function buildCallPreview(callStatus, durationSeconds) {
  const normalizedStatus = formatCallStatus(callStatus);

  if (durationSeconds) {
    return `Inbound call ${normalizedStatus}. Duration ${durationSeconds} seconds.`;
  }

  return `Inbound call ${normalizedStatus}.`;
}

function mapCallStatusToCommunicationStatus(callStatus) {
  if (["busy", "no-answer", "failed", "canceled"].includes(callStatus)) {
    return "awaiting_callback";
  }

  return "unresolved";
}

function mapCallSummarySectionsToDomain(sections) {
  if (!sections || typeof sections !== "object") {
    return null;
  }

  return {
    customerNeed: String(sections.customer_need || ""),
    applianceOrSystem: String(sections.appliance_or_system || ""),
    schedulingAndLocation: String(sections.scheduling_and_location || ""),
    partsAndWarranty: String(sections.parts_and_warranty || ""),
    billingAndPayment: String(sections.billing_and_payment || ""),
    followUpActions: String(sections.follow_up_actions || ""),
  };
}

async function listCustomerContacts(client) {
  const result = await client
    .from("customers")
    .select(
      "customer_id,name,primary_phone,secondary_phone,sms_opted_out_at,voice_opted_out_at,auto_contact_cooldown_until",
    );

  if (result.error) {
    throw new Error(`customers.listForPhoneMatch: ${result.error.message}`);
  }

  return result.data || [];
}

export async function findCustomerMatchByPhone(client, phoneNumber) {
  const normalizedTarget = normalizePhoneNumber(phoneNumber);

  if (!normalizedTarget) {
    return { status: "missing_phone", customer: null };
  }

  const customers = await listCustomerContacts(client);
  const matches = customers.filter((customer) => {
    return [customer.primary_phone, customer.secondary_phone]
      .map(normalizePhoneNumber)
      .some((candidate) => candidate && candidate === normalizedTarget);
  });

  if (matches.length === 1) {
    return { status: "matched", customer: matches[0] };
  }

  if (matches.length > 1) {
    return { status: "ambiguous", customer: null };
  }

  return { status: "not_found", customer: null };
}

async function findExistingCommunicationByField(client, field, value) {
  const result = await client
    .from("communications")
    .select("*")
    .eq(field, value)
    .maybeSingle();

  if (result.error) {
    throw new Error(`communications.lookupByProviderSid: ${result.error.message}`);
  }

  return result.data || null;
}

function buildSmsDraft(customerId, payload) {
  return {
    customerId,
    communicationChannel: "text",
    communicationStatus: "unread_message",
    previewText: buildSmsPreview(payload.Body),
    direction: "inbound",
    linkedJobId: null,
    invoiceId: null,
    transcriptText: payload.Body || null,
    extractedEventLabel: null,
    occurredAt: new Date().toISOString(),
    fromNumber: payload.From || null,
    toNumber: payload.To || null,
    providerName: "twilio",
    providerMessageSid: payload.MessageSid || payload.SmsSid || null,
    providerCallSid: null,
    startedAt: null,
    endedAt: null,
  };
}

function buildCallDraft(customerId, payload, recordingIntelligence = null) {
  const occurredAt = new Date().toISOString();
  const terminal = ["completed", "busy", "no-answer", "failed", "canceled"].includes(payload.CallStatus);

  return {
    customerId,
    communicationChannel: "call",
    communicationStatus: mapCallStatusToCommunicationStatus(payload.CallStatus),
    previewText:
      recordingIntelligence?.headline || buildCallPreview(payload.CallStatus, payload.CallDuration),
    direction: "inbound",
    linkedJobId: null,
    invoiceId: null,
    transcriptText: recordingIntelligence?.transcriptText || null,
    callHighlights: recordingIntelligence?.callHighlights || null,
    callSummarySections: mapCallSummarySectionsToDomain(recordingIntelligence?.callSummarySections),
    transcriptionStatus: recordingIntelligence?.transcriptionStatus || "pending",
    transcriptionError: recordingIntelligence?.transcriptionError || null,
    extractedEventLabel: recordingIntelligence?.headline || null,
    occurredAt,
    fromNumber: payload.From || null,
    toNumber: payload.To || null,
    providerName: "twilio",
    providerMessageSid: null,
    providerCallSid: payload.CallSid || null,
    startedAt: occurredAt,
    endedAt: terminal ? occurredAt : null,
  };
}

function buildCallUpdate(existingCommunication, payload, recordingIntelligence = null) {
  const terminal = ["completed", "busy", "no-answer", "failed", "canceled"].includes(payload.CallStatus);

  return {
    communicationStatus: mapCallStatusToCommunicationStatus(payload.CallStatus),
    previewText:
      recordingIntelligence?.headline || buildCallPreview(payload.CallStatus, payload.CallDuration),
    transcriptText: recordingIntelligence?.transcriptText || existingCommunication.transcript_text,
    callHighlights: recordingIntelligence?.callHighlights || existingCommunication.call_highlights,
    callSummarySections: mapCallSummarySectionsToDomain(
      recordingIntelligence?.callSummarySections || existingCommunication.call_summary_sections,
    ),
    transcriptionStatus:
      recordingIntelligence?.transcriptionStatus || existingCommunication.transcription_status,
    transcriptionError:
      recordingIntelligence?.transcriptionError || existingCommunication.transcription_error,
    extractedEventLabel:
      recordingIntelligence?.headline || existingCommunication.extracted_event_summary,
    linkedJobId: existingCommunication.job_id,
    invoiceId: existingCommunication.invoice_id,
    startedAt: existingCommunication.started_at || new Date().toISOString(),
    endedAt: terminal ? new Date().toISOString() : existingCommunication.ended_at,
  };
}

function buildUnmatchedSmsDraft(matchStatus, payload) {
  return {
    communicationChannel: "text",
    direction: "inbound",
    communicationStatus: "unread_message",
    matchStatus,
    previewText: buildSmsPreview(payload.Body),
    transcriptText: payload.Body || null,
    fromNumber: payload.From || null,
    toNumber: payload.To || null,
    providerName: "twilio",
    providerMessageSid: payload.MessageSid || payload.SmsSid || null,
    providerCallSid: null,
    rawPayload: payload,
    occurredAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
  };
}

function buildUnmatchedCallDraft(matchStatus, payload, recordingIntelligence = null) {
  const occurredAt = new Date().toISOString();
  const terminal = ["completed", "busy", "no-answer", "failed", "canceled"].includes(payload.CallStatus);

  return {
    communicationChannel: "call",
    direction: "inbound",
    communicationStatus: mapCallStatusToCommunicationStatus(payload.CallStatus),
    matchStatus,
    previewText:
      recordingIntelligence?.headline || buildCallPreview(payload.CallStatus, payload.CallDuration),
    transcriptText: recordingIntelligence?.transcriptText || null,
    callHighlights: recordingIntelligence?.callHighlights || null,
    callSummarySections: mapCallSummarySectionsToDomain(recordingIntelligence?.callSummarySections),
    transcriptionStatus: recordingIntelligence?.transcriptionStatus || "pending",
    transcriptionError: recordingIntelligence?.transcriptionError || null,
    fromNumber: payload.From || null,
    toNumber: payload.To || null,
    providerName: "twilio",
    providerMessageSid: null,
    providerCallSid: payload.CallSid || null,
    rawPayload: payload,
    occurredAt,
    startedAt: occurredAt,
    endedAt: terminal ? occurredAt : null,
  };
}

function buildUnmatchedCallUpdate(existingRecord, matchStatus, payload, recordingIntelligence = null) {
  const terminal = ["completed", "busy", "no-answer", "failed", "canceled"].includes(payload.CallStatus);

  return {
    communicationStatus: mapCallStatusToCommunicationStatus(payload.CallStatus),
    matchStatus,
    previewText:
      recordingIntelligence?.headline || buildCallPreview(payload.CallStatus, payload.CallDuration),
    transcriptText: recordingIntelligence?.transcriptText || existingRecord.transcript_text,
    callHighlights: recordingIntelligence?.callHighlights || existingRecord.call_highlights,
    callSummarySections: mapCallSummarySectionsToDomain(
      recordingIntelligence?.callSummarySections || existingRecord.call_summary_sections,
    ),
    transcriptionStatus:
      recordingIntelligence?.transcriptionStatus || existingRecord.transcription_status,
    transcriptionError:
      recordingIntelligence?.transcriptionError || existingRecord.transcription_error,
    rawPayload: payload,
    occurredAt: existingRecord.occurred_at || new Date().toISOString(),
    startedAt: existingRecord.started_at || new Date().toISOString(),
    endedAt: terminal ? new Date().toISOString() : existingRecord.ended_at,
  };
}

async function findPendingUnmatchedInboundByField(client, field, value) {
  if (!value) {
    return null;
  }

  return runFindPendingUnmatchedInboundByField(client, field, value);
}

async function queueUnmatchedInboundSms(client, payload, matchStatus) {
  const providerMessageSid = payload.MessageSid || payload.SmsSid || null;
  const existingRecord = await findPendingUnmatchedInboundByField(client, "provider_message_sid", providerMessageSid);

  if (existingRecord) {
    return {
      ok: true,
      status: 202,
      reason: "duplicate_unmatched",
      message: "Inbound SMS is already queued for unmatched contact triage.",
      record: existingRecord,
    };
  }

  const record = await runCreateUnmatchedInboundMutation(
    client,
    mapUnmatchedInboundCommunicationDraftToInsert(buildUnmatchedSmsDraft(matchStatus, payload)),
  );

  return {
    ok: true,
    status: 202,
    reason: matchStatus,
    message: "Inbound SMS accepted and queued for unmatched contact triage.",
    record,
  };
}

async function queueUnmatchedInboundCall(client, payload, matchStatus, recordingIntelligence = null) {
  const existingRecord = await findPendingUnmatchedInboundByField(
    client,
    "provider_call_sid",
    payload.CallSid,
  );

  if (existingRecord) {
    const record = await runUpdateUnmatchedInboundMutation(
      client,
      existingRecord.unmatched_communication_id,
      mapUnmatchedInboundCommunicationPatchToUpdate(
        buildUnmatchedCallUpdate(existingRecord, matchStatus, payload, recordingIntelligence),
      ),
    );

    return {
      ok: true,
      status: 202,
      reason: "updated_unmatched",
      message: "Inbound call is already queued for unmatched contact triage and was updated.",
      record,
    };
  }

  const record = await runCreateUnmatchedInboundMutation(
    client,
    mapUnmatchedInboundCommunicationDraftToInsert(
      buildUnmatchedCallDraft(matchStatus, payload, recordingIntelligence),
    ),
  );

  return {
    ok: true,
    status: 202,
    reason: matchStatus,
    message: "Inbound call accepted and queued for unmatched contact triage.",
    record,
  };
}

export async function persistInboundSms(client, payload) {
  const providerMessageSid = payload.MessageSid || payload.SmsSid;
  const existingCommunication = providerMessageSid
    ? await findExistingCommunicationByField(client, "provider_message_sid", providerMessageSid)
    : null;

  if (existingCommunication) {
    return {
      ok: true,
      status: 200,
      reason: "duplicate",
      message: "Inbound SMS was already logged.",
      record: existingCommunication,
    };
  }

  const customerMatch = await findCustomerMatchByPhone(client, payload.From);

  if (customerMatch.status !== "matched") {
    return queueUnmatchedInboundSms(client, payload, customerMatch.status);
  }

  if (isGlobalOptOutMessage(payload.Body)) {
    await applyGlobalCustomerOptOut(client, customerMatch.customer.customer_id);
  } else {
    await clearCustomerAutoContactCooldown(client, customerMatch.customer.customer_id);
  }

  const record = await runCreateCommunicationMutation(
    client,
    mapCommunicationDraftToInsert(buildSmsDraft(customerMatch.customer.customer_id, payload)),
  );

  return {
    ok: true,
    status: 201,
    reason: "created",
    message: "Inbound SMS logged to communications.",
    record,
  };
}

export async function persistInboundCallEvent(client, payload) {
  const direction = String(payload.Direction || "").toLowerCase();

  if (!direction.startsWith("inbound")) {
    return {
      ok: true,
      status: 200,
      reason: "ignored_direction",
      message: "Outbound or non-inbound call callback ignored.",
    };
  }

  const recordingIntelligence = payload.CallSid
    ? await findLatestRecordingIntelligenceByCallSid(client, payload.CallSid)
    : null;

  const existingCommunication = payload.CallSid
    ? await findExistingCommunicationByField(client, "provider_call_sid", payload.CallSid)
    : null;

  if (existingCommunication) {
    const record = await runUpdateCommunicationMutation(
      client,
      existingCommunication.communication_id,
      mapCommunicationStatusPatchToUpdate(
        buildCallUpdate(existingCommunication, payload, recordingIntelligence),
      ),
    );

    return {
      ok: true,
      status: 200,
      reason: "updated",
      message: "Inbound call event updated an existing communication log.",
      record,
    };
  }

  const customerMatch = await findCustomerMatchByPhone(client, payload.From);

  if (customerMatch.status !== "matched") {
    return queueUnmatchedInboundCall(client, payload, customerMatch.status, recordingIntelligence);
  }

  await clearCustomerAutoContactCooldown(client, customerMatch.customer.customer_id);

  const record = await runCreateCommunicationMutation(
    client,
    mapCommunicationDraftToInsert(
      buildCallDraft(customerMatch.customer.customer_id, payload, recordingIntelligence),
    ),
  );

  return {
    ok: true,
    status: 201,
    reason: "created",
    message: "Inbound call event logged to communications.",
    record,
  };
}

export function matchesConfiguredTwilioNumber(configuredPhoneNumber, requestPhoneNumber) {
  const requestValue = normalizePhoneNumber(requestPhoneNumber);

  if (!requestValue) {
    return false;
  }

  const configuredPhoneNumbers = Array.isArray(configuredPhoneNumber)
    ? configuredPhoneNumber
    : [configuredPhoneNumber];

  return configuredPhoneNumbers
    .map(normalizePhoneNumber)
    .some((configuredValue) => configuredValue && configuredValue === requestValue);
}
