import { formatTimeLabelFromIso, stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema").CustomerInsertPayload} CustomerInsertPayload */
/** @typedef {import("../types/schema").CustomerRow} CustomerRow */
/** @typedef {import("../../types/models").Customer} Customer */
/** @typedef {import("../../types/models").CustomerDraft} CustomerDraft */

/**
 * @param {CustomerRow} row
 * @param {{ activeJobId?: string|null }} [relations]
 * @returns {Customer}
 */
export function mapCustomerRowToDomain(row, relations = {}) {
  return {
    customerId: row.customer_id,
    name: row.name,
    city: row.city,
    serviceArea: row.service_area,
    primaryPhone: row.primary_phone,
    customerSegment: row.customer_segment,
    lifetimeValue: row.lifetime_value,
    lastContactLabel: formatTimeLabelFromIso(row.last_contact_at, "No recent contact"),
    communicationStatus: row.communication_status,
    activeJobId: relations.activeJobId ?? null,
  };
}

/**
 * @param {CustomerDraft} draft
 * @returns {CustomerInsertPayload}
 */
export function mapCustomerDraftToInsert(draft) {
  return {
    name: draft.name,
    primary_phone: draft.primaryPhone,
    secondary_phone: toNullable(draft.secondaryPhone),
    email: toNullable(draft.email),
    city: draft.city,
    service_area: draft.serviceArea,
    customer_segment: draft.customerSegment,
    communication_status: draft.communicationStatus || "clear",
    last_contact_at: toNullable(draft.lastContactAt),
    lifetime_value: 0,
    notes: toNullable(draft.notes),
  };
}

/**
 * @param {Partial<CustomerDraft>} patch
 */
export function mapCustomerPatchToUpdate(patch) {
  return stripUndefined({
    name: patch.name,
    primary_phone: patch.primaryPhone,
    secondary_phone: patch.secondaryPhone,
    email: patch.email,
    city: patch.city,
    service_area: patch.serviceArea,
    customer_segment: patch.customerSegment,
    communication_status: patch.communicationStatus,
    last_contact_at: patch.lastContactAt,
    notes: patch.notes,
  });
}
