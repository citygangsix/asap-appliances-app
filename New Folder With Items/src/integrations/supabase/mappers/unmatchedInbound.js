import { formatTimeLabelFromIso, stripUndefined, toNullable } from "./shared.js";

/** @typedef {import("../types/schema").UnmatchedInboundCommunicationInsertPayload} UnmatchedInboundCommunicationInsertPayload */
/** @typedef {import("../types/schema").UnmatchedInboundCommunicationRow} UnmatchedInboundCommunicationRow */
/** @typedef {import("../../types/models").UnmatchedInboundCommunication} UnmatchedInboundCommunication */

/**
 * @param {UnmatchedInboundCommunicationRow} row
 * @returns {UnmatchedInboundCommunication}
 */
export function mapUnmatchedInboundCommunicationRowToDomain(row) {
  return {
    unmatchedCommunicationId: row.unmatched_communication_id,
    communicationChannel: row.communication_channel,
    direction: row.direction,
    communicationStatus: row.communication_status,
    matchStatus: row.match_status,
    resolutionStatus: row.resolution_status,
    previewText: row.preview_text,
    transcriptText: row.transcript_text || "",
    fromNumber: row.from_number,
    toNumber: row.to_number,
    providerMessageSid: row.provider_message_sid,
    providerCallSid: row.provider_call_sid,
    occurredAtLabel: formatTimeLabelFromIso(row.occurred_at, "Recent"),
  };
}

/**
 * @param {Object} draft
 * @param {"text"|"call"} draft.communicationChannel
 * @param {"inbound"|"outbound"} [draft.direction]
 * @param {"clear"|"awaiting_callback"|"unread_message"|"unresolved"} draft.communicationStatus
 * @param {"missing_phone"|"not_found"|"ambiguous"} draft.matchStatus
 * @param {"pending"|"linked"|"ignored"} [draft.resolutionStatus]
 * @param {string} draft.previewText
 * @param {string|null} [draft.transcriptText]
 * @param {string|null} [draft.fromNumber]
 * @param {string|null} [draft.toNumber]
 * @param {string|null} [draft.providerName]
 * @param {string|null} [draft.providerMessageSid]
 * @param {string|null} [draft.providerCallSid]
 * @param {Record<string, any>|null} [draft.rawPayload]
 * @param {string|null} [draft.occurredAt]
 * @param {string|null} [draft.startedAt]
 * @param {string|null} [draft.endedAt]
 * @returns {UnmatchedInboundCommunicationInsertPayload}
 */
export function mapUnmatchedInboundCommunicationDraftToInsert(draft) {
  return {
    communication_channel: draft.communicationChannel,
    direction: draft.direction || "inbound",
    communication_status: draft.communicationStatus,
    match_status: draft.matchStatus,
    resolution_status: draft.resolutionStatus || "pending",
    from_number: toNullable(draft.fromNumber),
    to_number: toNullable(draft.toNumber),
    preview_text: draft.previewText,
    transcript_text: toNullable(draft.transcriptText),
    provider_name: draft.providerName || "twilio",
    provider_message_sid: toNullable(draft.providerMessageSid),
    provider_call_sid: toNullable(draft.providerCallSid),
    raw_payload: draft.rawPayload || {},
    occurred_at: draft.occurredAt || new Date().toISOString(),
    started_at: toNullable(draft.startedAt),
    ended_at: toNullable(draft.endedAt),
    linked_customer_id: null,
    linked_job_id: null,
    linked_communication_id: null,
    resolution_notes: null,
    resolved_at: null,
  };
}

/**
 * @param {Object} patch
 * @returns {import("../types/schema").UnmatchedInboundCommunicationUpdatePayload}
 */
export function mapUnmatchedInboundCommunicationPatchToUpdate(patch) {
  return stripUndefined({
    communication_status: patch.communicationStatus,
    match_status: patch.matchStatus,
    resolution_status: patch.resolutionStatus,
    from_number: patch.fromNumber,
    to_number: patch.toNumber,
    preview_text: patch.previewText,
    transcript_text: patch.transcriptText,
    raw_payload: patch.rawPayload,
    occurred_at: patch.occurredAt,
    started_at: patch.startedAt,
    ended_at: patch.endedAt,
    linked_customer_id: patch.linkedCustomerId,
    linked_job_id: patch.linkedJobId,
    linked_communication_id: patch.linkedCommunicationId,
    resolution_notes: patch.resolutionNotes,
    resolved_at: patch.resolvedAt,
  });
}
