import { formatTimeLabelFromIso, stripUndefined, toNullable } from "./shared.js";

/** @typedef {import("../types/schema").CommunicationInsertPayload} CommunicationInsertPayload */
/** @typedef {import("../types/schema").CommunicationRow} CommunicationRow */
/** @typedef {import("../../types/models").Communication} Communication */
/** @typedef {import("../../types/models").CommunicationAttachmentDraft} CommunicationAttachmentDraft */
/** @typedef {import("../../types/models").CommunicationDraft} CommunicationDraft */
/** @typedef {import("../../types/models").CallSummarySections} CallSummarySections */
/** @typedef {import("../../types/models").CommunicationStatusPatch} CommunicationStatusPatch */

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

function mapCallSummarySectionsToDatabase(sections) {
  if (!sections) {
    return null;
  }

  return {
    customer_need: sections.customerNeed || "",
    appliance_or_system: sections.applianceOrSystem || "",
    scheduling_and_location: sections.schedulingAndLocation || "",
    parts_and_warranty: sections.partsAndWarranty || "",
    billing_and_payment: sections.billingAndPayment || "",
    follow_up_actions: sections.followUpActions || "",
  };
}

/**
 * @param {CommunicationRow} row
 * @returns {Communication}
 */
export function mapCommunicationRowToDomain(row) {
  return {
    communicationId: row.communication_id,
    customerId: row.customer_id,
    linkedJobId: row.job_id,
    invoiceId: row.invoice_id,
    communicationChannel: row.communication_channel,
    direction: row.direction,
    communicationStatus: row.communication_status,
    previewText: row.preview_text,
    transcriptText: row.transcript_text || "",
    callHighlights: row.call_highlights || "",
    callSummarySections: mapCallSummarySectionsToDomain(row.call_summary_sections),
    transcriptionStatus: row.transcription_status || null,
    transcriptionError: row.transcription_error || null,
    extractedEventLabel: row.extracted_event_summary || "No extracted event",
    fromNumber: row.from_number,
    toNumber: row.to_number,
    occurredAtLabel: formatTimeLabelFromIso(row.occurred_at, "Recent"),
    occurredAt: row.occurred_at,
  };
}

/**
 * @param {CommunicationDraft} draft
 * @returns {CommunicationInsertPayload}
 */
export function mapCommunicationDraftToInsert(draft) {
  return {
    customer_id: draft.customerId,
    job_id: toNullable(draft.linkedJobId),
    invoice_id: toNullable(draft.invoiceId),
    communication_channel: draft.communicationChannel,
    direction: draft.direction || "inbound",
    communication_status: draft.communicationStatus,
    preview_text: draft.previewText,
    transcript_text: toNullable(draft.transcriptText),
    call_highlights: toNullable(draft.callHighlights),
    call_summary_sections: mapCallSummarySectionsToDatabase(draft.callSummarySections),
    transcription_status: draft.transcriptionStatus || null,
    transcription_error: toNullable(draft.transcriptionError),
    extracted_event_summary: toNullable(draft.extractedEventLabel),
    from_number: toNullable(draft.fromNumber),
    to_number: toNullable(draft.toNumber),
    provider_name: toNullable(draft.providerName),
    provider_message_sid: toNullable(draft.providerMessageSid),
    provider_call_sid: toNullable(draft.providerCallSid),
    occurred_at: draft.occurredAt || new Date().toISOString(),
    started_at: toNullable(draft.startedAt),
    ended_at: toNullable(draft.endedAt),
  };
}

/**
 * @param {CommunicationStatusPatch} patch
 */
export function mapCommunicationStatusPatchToUpdate(patch) {
  return stripUndefined({
    communication_status: patch.communicationStatus,
    preview_text: patch.previewText,
    transcript_text: patch.transcriptText,
    call_highlights: patch.callHighlights,
    call_summary_sections:
      patch.callSummarySections === undefined
        ? undefined
        : mapCallSummarySectionsToDatabase(patch.callSummarySections),
    transcription_status: patch.transcriptionStatus,
    transcription_error: patch.transcriptionError,
    extracted_event_summary: patch.extractedEventLabel,
    job_id: patch.linkedJobId,
    invoice_id: patch.invoiceId,
    started_at: patch.startedAt,
    ended_at: patch.endedAt,
  });
}

/**
 * @param {CommunicationAttachmentDraft} draft
 */
export function mapCommunicationAttachmentToUpdate(draft) {
  return stripUndefined({
    job_id: draft.jobId,
    invoice_id: draft.invoiceId,
    communication_status: draft.communicationStatus,
  });
}
