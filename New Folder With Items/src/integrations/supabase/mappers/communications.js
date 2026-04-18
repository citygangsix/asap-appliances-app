import { formatTimeLabelFromIso, stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema").CommunicationInsertPayload} CommunicationInsertPayload */
/** @typedef {import("../types/schema").CommunicationRow} CommunicationRow */
/** @typedef {import("../../types/models").Communication} Communication */
/** @typedef {import("../../types/models").CommunicationAttachmentDraft} CommunicationAttachmentDraft */
/** @typedef {import("../../types/models").CommunicationDraft} CommunicationDraft */
/** @typedef {import("../../types/models").CommunicationStatusPatch} CommunicationStatusPatch */

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
    extractedEventLabel: row.extracted_event_summary || "No extracted event",
    fromNumber: row.from_number,
    toNumber: row.to_number,
    occurredAtLabel: formatTimeLabelFromIso(row.occurred_at, "Recent"),
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
    extracted_event_summary: toNullable(draft.extractedEventLabel),
    from_number: toNullable(draft.fromNumber),
    to_number: toNullable(draft.toNumber),
    provider_name: null,
    provider_message_sid: null,
    provider_call_sid: null,
    occurred_at: draft.occurredAt || new Date().toISOString(),
    started_at: null,
    ended_at: null,
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
    extracted_event_summary: patch.extractedEventLabel,
    job_id: patch.linkedJobId,
    invoice_id: patch.invoiceId,
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
