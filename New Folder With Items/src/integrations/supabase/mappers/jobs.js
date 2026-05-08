import { formatTimeLabelFromIso, stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema.js").JobInsertPayload} JobInsertPayload */
/** @typedef {import("../types/schema.js").JobRow} JobRow */
/** @typedef {import("../../../types/models.js").Job} Job */
/** @typedef {import("../../../types/models.js").JobAssignmentDraft} JobAssignmentDraft */
/** @typedef {import("../../../types/models.js").JobDraft} JobDraft */
/** @typedef {import("../../../types/models.js").JobWorkflowPatch} JobWorkflowPatch */

function formatEtaLabel(row) {
  if (row.lifecycle_status === "onsite") {
    return "Onsite";
  }

  if (row.eta_window_text) {
    return row.eta_window_text;
  }

  if (row.eta_at) {
    return formatTimeLabelFromIso(row.eta_at);
  }

  return "Not set";
}

function formatLatenessLabel(row) {
  if (row.lifecycle_status === "onsite") {
    return "Onsite";
  }

  if (row.dispatch_status === "unassigned") {
    return "Needs assignment";
  }

  if (row.dispatch_status === "escalated") {
    return "Escalated";
  }

  if (row.lateness_minutes && row.lateness_minutes > 0) {
    return `${row.lateness_minutes} min late`;
  }

  if (row.dispatch_status === "late") {
    return "Running late";
  }

  return "On time";
}

/**
 * @param {JobRow} row
 * @param {{ primaryInvoiceId?: string|null }} [relations]
 * @returns {Job}
 */
export function mapJobRowToDomain(row, relations = {}) {
  return {
    jobId: row.job_id,
    customerId: row.customer_id,
    techId: row.tech_id,
    invoiceId: relations.primaryInvoiceId ?? null,
    applianceLabel: row.appliance_label,
    applianceBrand: row.appliance_brand || "",
    issueSummary: row.issue_summary,
    scheduledStartLabel: formatTimeLabelFromIso(row.scheduled_start_at),
    serviceAddress: row.service_address,
    lifecycleStatus: row.lifecycle_status,
    dispatchStatus: row.dispatch_status,
    paymentStatus: row.payment_status,
    partsStatus: row.parts_status,
    communicationStatus: row.communication_status,
    customerUpdated: row.customer_updated,
    etaLabel: formatEtaLabel(row),
    latenessLabel: formatLatenessLabel(row),
    priority: row.priority,
    internalNotes: row.internal_notes || "No field notes yet.",
    dispatchConfirmationRequestedAt: row.dispatch_confirmation_requested_at,
    dispatchConfirmationReceivedAt: row.dispatch_confirmation_received_at,
    dispatchResponseMinutes: row.dispatch_response_minutes,
    technicianConfirmationResponse: row.technician_confirmation_response,
    paymentCollectedBeforeTechLeft: row.payment_collected_before_tech_left,
    scheduledStartAt: row.scheduled_start_at,
    onsiteAt: row.onsite_at,
    completedAt: row.completed_at,
  };
}

/**
 * @param {JobDraft} draft
 * @returns {JobInsertPayload}
 */
export function mapJobDraftToInsert(draft) {
  return {
    customer_id: draft.customerId,
    tech_id: toNullable(draft.techId),
    appliance_label: draft.applianceLabel,
    appliance_brand: toNullable(draft.applianceBrand),
    issue_summary: draft.issueSummary,
    service_address: draft.serviceAddress,
    scheduled_start_at: draft.scheduledStartAt,
    eta_at: toNullable(draft.etaAt),
    eta_window_text: toNullable(draft.etaWindowText),
    en_route_at: null,
    onsite_at: null,
    completed_at: null,
    canceled_at: null,
    return_requested_at: null,
    return_scheduled_at: null,
    lifecycle_status: "scheduled",
    dispatch_status: draft.techId ? "assigned" : "unassigned",
    payment_status: "none_due",
    parts_status: "none_needed",
    communication_status: "clear",
    customer_updated: false,
    priority: draft.priority || "normal",
    lateness_minutes: null,
    internal_notes: toNullable(draft.internalNotes),
    dispatch_confirmation_requested_at: null,
    dispatch_confirmation_received_at: null,
    dispatch_response_minutes: null,
    technician_confirmation_response: null,
    payment_collected_before_tech_left: null,
  };
}

/**
 * @param {JobAssignmentDraft} draft
 */
export function mapJobAssignmentToUpdate(draft) {
  return stripUndefined({
    tech_id: draft.techId,
    dispatch_status: draft.dispatchStatus || (draft.techId ? "assigned" : "unassigned"),
    eta_at: draft.etaAt,
    customer_updated: draft.customerUpdated,
  });
}

/**
 * @param {JobWorkflowPatch} patch
 */
export function mapJobWorkflowPatchToUpdate(patch) {
  return stripUndefined({
    scheduled_start_at: patch.scheduledStartAt,
    eta_at: patch.etaAt,
    eta_window_text: patch.etaWindowText,
    lifecycle_status: patch.lifecycleStatus,
    dispatch_status: patch.dispatchStatus,
    payment_status: patch.paymentStatus,
    parts_status: patch.partsStatus,
    communication_status: patch.communicationStatus,
    customer_updated: patch.customerUpdated,
    priority: patch.priority,
    lateness_minutes: patch.latenessMinutes,
    internal_notes: patch.internalNotes,
    en_route_at: patch.enRouteAt,
    onsite_at: patch.onsiteAt,
    completed_at: patch.completedAt,
    canceled_at: patch.canceledAt,
    return_requested_at: patch.returnRequestedAt,
    return_scheduled_at: patch.returnScheduledAt,
  });
}
