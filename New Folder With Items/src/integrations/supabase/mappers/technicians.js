import { stripUndefined } from "./shared";

/** @typedef {import("../types/schema").TechnicianInsertPayload} TechnicianInsertPayload */
/** @typedef {import("../types/schema").TechnicianRow} TechnicianRow */
/** @typedef {import("../../types/models").Technician} Technician */

/**
 * @param {TechnicianRow} row
 * @returns {Technician}
 */
export function mapTechnicianRowToDomain(row) {
  return {
    techId: row.tech_id,
    name: row.name,
    serviceArea: row.service_area,
    skills: row.skills,
    availabilityLabel: row.availability_notes || "Availability pending",
    jobsCompletedThisWeek: row.jobs_completed_this_week,
    callbackRatePercent: row.callback_rate_percent,
    payoutTotal: row.payout_total,
    gasReimbursementTotal: row.gas_reimbursement_total,
    statusToday: row.status_today,
    score: row.score,
  };
}

/**
 * @param {Partial<Technician>} patch
 * @returns {Partial<TechnicianInsertPayload>}
 */
export function mapTechnicianPatchToUpdate(patch) {
  return stripUndefined({
    name: patch.name,
    service_area: patch.serviceArea,
    skills: patch.skills,
    availability_notes: patch.availabilityLabel,
    jobs_completed_this_week: patch.jobsCompletedThisWeek,
    callback_rate_percent: patch.callbackRatePercent,
    payout_total: patch.payoutTotal,
    gas_reimbursement_total: patch.gasReimbursementTotal,
    status_today: patch.statusToday,
    score: patch.score,
  });
}
