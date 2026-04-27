import { stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema.js").DbTimelineEventType} DbTimelineEventType */
/** @typedef {import("../types/schema.js").JobTimelineEventInsertPayload} JobTimelineEventInsertPayload */
/** @typedef {import("../types/schema.js").JobTimelineEventRow} JobTimelineEventRow */
/** @typedef {import("../../../types/models.js").JobTimelineEvent} JobTimelineEvent */
/** @typedef {import("../../../types/models.js").JobTimelineEventDraft} JobTimelineEventDraft */

const TIMELINE_EVENT_TO_DB = {
  quote_sent: "parts_requested",
  availability_update: "scheduled",
  late_flag: "dispatch_updated",
  payment_failed: "payment_requested",
  escalated: "dispatch_updated",
  job_created: "job_created",
  scheduled: "scheduled",
  tech_assigned: "tech_assigned",
  dispatch_updated: "dispatch_updated",
  communication_logged: "communication_logged",
  eta_updated: "eta_updated",
  en_route: "en_route",
  onsite: "onsite",
  parts_requested: "parts_requested",
  parts_ordered: "parts_ordered",
  payment_requested: "payment_requested",
  payment_received: "payment_received",
  return_scheduled: "return_scheduled",
  completed: "completed",
  canceled: "canceled",
  note_added: "note_added",
};

/**
 * @param {string} eventType
 * @returns {DbTimelineEventType}
 */
export function mapTimelineEventTypeToDb(eventType) {
  return TIMELINE_EVENT_TO_DB[eventType] || "note_added";
}

/**
 * @param {JobTimelineEventRow} row
 * @returns {JobTimelineEvent}
 */
export function mapJobTimelineEventRowToDomain(row) {
  return {
    eventId: row.event_id,
    jobId: row.job_id,
    actorType: row.actor_type,
    actorLabel: row.actor_label,
    eventType: row.event_type,
    eventAtLabel: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(row.event_at)),
    eventAt: row.event_at,
    summary: row.summary,
    details: row.details || "",
  };
}

/**
 * @param {JobTimelineEventDraft} draft
 * @returns {JobTimelineEventInsertPayload}
 */
export function mapJobTimelineEventDraftToInsert(draft) {
  return {
    job_id: draft.jobId,
    actor_type: draft.actorType,
    actor_label: draft.actorLabel,
    event_type: mapTimelineEventTypeToDb(draft.eventType),
    event_at: draft.eventAt,
    summary: draft.summary,
    details: toNullable(draft.details),
    metadata: {},
  };
}

/**
 * @param {Partial<JobTimelineEventDraft>} patch
 */
export function mapJobTimelineEventPatchToUpdate(patch) {
  return stripUndefined({
    actor_type: patch.actorType,
    actor_label: patch.actorLabel,
    event_type: patch.eventType ? mapTimelineEventTypeToDb(patch.eventType) : undefined,
    event_at: patch.eventAt,
    summary: patch.summary,
    details: patch.details,
  });
}
