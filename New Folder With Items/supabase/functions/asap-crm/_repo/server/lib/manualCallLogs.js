import { mapCommunicationDraftToInsert } from "../../src/integrations/supabase/mappers/communications.js";
import { runCreateCommunicationMutation } from "../../src/integrations/supabase/mutations/communications.js";
import { analyzeTranscriptText, isCallIntelligenceConfigured } from "./callIntelligence.js";
import { findCustomerMatchByPhone } from "./twilioCommunications.js";
import { upsertHiringCandidateFromManualLog } from "./hiringCandidates.js";

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizePhoneNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

function normalizeCallOutcome(value, fallback = "connected") {
  const normalized = toNullableString(value)?.toLowerCase() || "";
  const allowed = new Set(["connected", "voicemail_left", "no_answer"]);
  return allowed.has(normalized) ? normalized : fallback;
}

function mapCallOutcomeToStatus(callOutcome) {
  return callOutcome === "connected" ? "unresolved" : "awaiting_callback";
}

function buildManualPreview(callOutcome, analysis, note) {
  if (analysis?.headline) {
    return analysis.headline;
  }

  const notePreview = String(note ?? "").trim();

  if (notePreview) {
    return notePreview.length > 140 ? `${notePreview.slice(0, 137)}...` : notePreview;
  }

  if (callOutcome === "voicemail_left") {
    return "Voicemail left from manual phone call.";
  }

  if (callOutcome === "no_answer") {
    return "Manual phone call attempt with no answer.";
  }

  return "Manual phone call logged.";
}

function buildManualCallHighlights(callOutcome, analysis, note) {
  if (analysis?.callHighlights) {
    return analysis.callHighlights;
  }

  if (callOutcome === "voicemail_left") {
    return toNullableString(note) || "Voicemail left during off-system call.";
  }

  if (callOutcome === "no_answer") {
    return toNullableString(note) || "No answer during off-system call.";
  }

  return toNullableString(note);
}

async function analyzeManualNote(note) {
  const normalizedNote = toNullableString(note);

  if (!normalizedNote || !isCallIntelligenceConfigured()) {
    return null;
  }

  try {
    return await analyzeTranscriptText(normalizedNote);
  } catch (error) {
    console.error("[manual-call-logs] note analysis failed", error);
    return null;
  }
}

export async function logManualCustomerCall(client, payload = {}) {
  const customerId = toNullableString(payload.customerId);
  const customerPhone = normalizePhoneNumber(payload.customerPhone);
  const note = toNullableString(payload.note);
  const agentPhone = normalizePhoneNumber(payload.agentPhone);
  const occurredAt = toNullableString(payload.occurredAt) || new Date().toISOString();
  const callOutcome = normalizeCallOutcome(payload.callOutcome, "connected");

  let resolvedCustomerId = customerId;

  if (!resolvedCustomerId && customerPhone) {
    const customerMatch = await findCustomerMatchByPhone(client, customerPhone);
    resolvedCustomerId = customerMatch.customer?.customer_id || null;
  }

  if (!resolvedCustomerId) {
    return {
      ok: false,
      status: 400,
      message: "Manual customer call log requires a known customer record or matching customer phone.",
    };
  }

  const analysis = await analyzeManualNote(note);
  const record = await runCreateCommunicationMutation(
    client,
    mapCommunicationDraftToInsert({
      customerId: resolvedCustomerId,
      linkedJobId: toNullableString(payload.jobId),
      invoiceId: null,
      communicationChannel: "call",
      direction: "outbound",
      communicationStatus: mapCallOutcomeToStatus(callOutcome),
      previewText: buildManualPreview(callOutcome, analysis, note),
      transcriptText: note,
      callHighlights: buildManualCallHighlights(callOutcome, analysis, note),
      callSummarySections: analysis?.callSummarySections || null,
      transcriptionStatus: note ? "completed" : null,
      transcriptionError: null,
      extractedEventLabel: analysis?.headline || null,
      occurredAt,
      startedAt: occurredAt,
      endedAt: occurredAt,
      fromNumber: agentPhone,
      toNumber: customerPhone,
      providerName: "manual_phone",
      providerMessageSid: null,
      providerCallSid: null,
    }),
  );

  return {
    ok: true,
    status: 201,
    mode: "customer",
    record,
    message:
      callOutcome === "voicemail_left"
        ? "Voicemail log saved to the customer CRM."
        : callOutcome === "no_answer"
          ? "No-answer call attempt saved to the customer CRM."
          : "Manual customer call saved to the CRM.",
  };
}

export async function logManualHiringCall(client, payload = {}) {
  const candidateName = toNullableString(payload.candidateName);
  const candidatePhone = normalizePhoneNumber(payload.candidatePhone);
  const note = toNullableString(payload.note);
  const agentPhone = normalizePhoneNumber(payload.agentPhone);
  const occurredAt = toNullableString(payload.occurredAt) || new Date().toISOString();
  const callOutcome = normalizeCallOutcome(payload.callOutcome, "connected");

  if (!candidateName && !candidatePhone) {
    return {
      ok: false,
      status: 400,
      message: "Manual hiring call log requires a candidate name or phone number.",
    };
  }

  const analysis = await analyzeManualNote(note);
  const result = await upsertHiringCandidateFromManualLog(
    client,
    {
      candidateName,
      candidatePhone,
      email: toNullableString(payload.email),
      agentPhone,
      occurredAt,
      note,
      callOutcome,
      source: "Manual phone log",
    },
    analysis,
  );

  return {
    ok: true,
    status: result.reason === "created" ? 201 : 200,
    mode: "hiring",
    ...result,
    message:
      callOutcome === "voicemail_left"
        ? "Manual candidate voicemail saved to the recruiting CRM."
        : callOutcome === "no_answer"
          ? "Manual no-answer candidate call saved to the recruiting CRM."
          : "Manual candidate call saved to the recruiting CRM.",
  };
}

export async function logManualCall(client, payload = {}) {
  const mode = toNullableString(payload.mode)?.toLowerCase();

  if (mode === "customer") {
    return logManualCustomerCall(client, payload);
  }

  if (mode === "hiring") {
    return logManualHiringCall(client, payload);
  }

  return {
    ok: false,
    status: 400,
    message: "Manual call log mode must be either customer or hiring.",
  };
}
