import { stripUndefined, toNullable } from "./shared";

/** @typedef {import("../types/schema").TechnicianInsertPayload} TechnicianInsertPayload */
/** @typedef {import("../types/schema").TechnicianRow} TechnicianRow */
/** @typedef {import("../../types/models").Technician} Technician */

function formatDateLabel(dateLike) {
  if (!dateLike) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateLike}T12:00:00`));
}

function buildAvailabilityLabel(row) {
  if (row.availability_notes) {
    return row.availability_notes;
  }

  const parts = [];

  if (row.availability_days?.length) {
    parts.push(`Days: ${row.availability_days.join(", ")}`);
  }

  if (row.availability_time_preferences?.length) {
    parts.push(`Windows: ${row.availability_time_preferences.join(", ")}`);
  }

  return parts.join(" | ") || "Availability pending";
}

/**
 * @param {TechnicianRow} row
 * @returns {Technician}
 */
export function mapTechnicianRowToDomain(row) {
  return {
    techId: row.tech_id,
    name: row.name,
    primaryPhone: row.primary_phone || null,
    email: row.email || null,
    serviceArea: row.service_area,
    serviceZipCodes: row.service_zip_codes || [],
    skills: row.skills,
    hireStartDate: row.hire_start_date || null,
    hireStartDateLabel: formatDateLabel(row.hire_start_date),
    availabilityLabel: buildAvailabilityLabel(row),
    availabilityDays: row.availability_days || [],
    availabilityTimePreferences: row.availability_time_preferences || [],
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
    primary_phone: patch.primaryPhone === undefined ? undefined : toNullable(patch.primaryPhone),
    email: patch.email === undefined ? undefined : toNullable(patch.email),
    service_area: patch.serviceArea,
    service_zip_codes: patch.serviceZipCodes,
    skills: patch.skills,
    hire_start_date: patch.hireStartDate === undefined ? undefined : toNullable(patch.hireStartDate),
    availability_notes: patch.availabilityLabel,
    availability_days: patch.availabilityDays,
    availability_time_preferences: patch.availabilityTimePreferences,
    jobs_completed_this_week: patch.jobsCompletedThisWeek,
    callback_rate_percent: patch.callbackRatePercent,
    payout_total: patch.payoutTotal,
    gas_reimbursement_total: patch.gasReimbursementTotal,
    status_today: patch.statusToday,
    score: patch.score,
  });
}
