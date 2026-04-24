import { formatTimeLabelFromIso, stripUndefined, toNullable } from "./shared.js";

/** @typedef {import("../types/schema").HiringCandidateInsertPayload} HiringCandidateInsertPayload */
/** @typedef {import("../types/schema").HiringCandidateRow} HiringCandidateRow */
/** @typedef {import("../../types/models").HiringCandidate} HiringCandidate */

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

function normalizeManualOutreach(row) {
  const summary =
    row.raw_analysis && typeof row.raw_analysis === "object" && row.raw_analysis.manualOutreach
      ? row.raw_analysis.manualOutreach
      : null;

  if (!summary || typeof summary !== "object") {
    return {
      totalCalls: 0,
      voicemailLeftCount: 0,
      noAnswerCount: 0,
      connectedCount: 0,
      lastOutcome: null,
      lastAgentPhone: null,
      lastOccurredAtLabel: null,
    };
  }

  return {
    totalCalls: Number(summary.totalCalls || 0),
    voicemailLeftCount: Number(summary.voicemailLeftCount || 0),
    noAnswerCount: Number(summary.noAnswerCount || 0),
    connectedCount: Number(summary.connectedCount || 0),
    lastOutcome: summary.lastOutcome || null,
    lastAgentPhone: summary.lastAgentPhone || null,
    lastOccurredAtLabel: formatTimeLabelFromIso(summary.lastOccurredAt, "Recent"),
  };
}

function normalizeLanguage(row) {
  const language =
    row.raw_analysis && typeof row.raw_analysis === "object" && row.raw_analysis.language
      ? row.raw_analysis.language
      : null;

  return {
    originalLanguage: language?.originalLanguage || language?.original_language || "English",
    containsNonEnglish: Boolean(language?.containsNonEnglish || language?.contains_non_english),
    englishTranslationNote: language?.englishTranslationNote || language?.english_translation_note || null,
    englishKeyDetails: language?.englishKeyDetails || language?.english_key_details || null,
  };
}

function normalizeStarterPacket(row) {
  const starterPacket =
    row.raw_analysis && typeof row.raw_analysis === "object" && row.raw_analysis.starterPacket
      ? row.raw_analysis.starterPacket
      : null;

  return {
    sentAt: starterPacket?.sentAt || null,
    sentAtLabel: formatTimeLabelFromIso(starterPacket?.sentAt, null),
    packetUrl: starterPacket?.packetUrl || null,
    providerMessageSid: starterPacket?.providerMessageSid || null,
    status: starterPacket?.status || null,
  };
}

/**
 * @param {HiringCandidateRow} row
 * @returns {HiringCandidate}
 */
export function mapHiringCandidateRowToDomain(row) {
  const manualOutreach = normalizeManualOutreach(row);
  const language = normalizeLanguage(row);
  const starterPacket = normalizeStarterPacket(row);
  const stage = row.promoted_tech_id && row.stage !== "rejected" ? "onboarded" : row.stage;

  return {
    candidateId: row.candidate_id,
    name: row.name,
    primaryPhone: row.primary_phone || null,
    email: row.email || null,
    source: row.source || null,
    stage,
    trade: row.trade || null,
    city: row.city || null,
    serviceArea: row.service_area || null,
    structuredStartDate: row.structured_start_date || null,
    structuredStartDateLabel: formatDateLabel(row.structured_start_date),
    availabilitySummary: row.availability_summary || null,
    availabilityDays: row.availability_days || [],
    availabilityTimePreferences: row.availability_time_preferences || [],
    currentJobStatus: row.current_job_status || null,
    toolsStatus: row.tools_status || null,
    vehicleStatus: row.vehicle_status || null,
    toolsVehicleSummary: row.tools_vehicle_summary || null,
    payoutExpectationSummary: row.payout_expectation_summary || null,
    experienceSummary: row.experience_summary || null,
    applianceExperienceSummary: row.appliance_experience_summary || null,
    otherWorkExperienceSummary: row.other_work_experience_summary || null,
    nextStep: row.next_step || null,
    callHighlights: row.call_highlights || "",
    transcriptText: row.transcript_text || "",
    linkedCommunicationId: row.linked_communication_id || null,
    providerCallSid: row.provider_call_sid || null,
    promotedTechId: row.promoted_tech_id || null,
    promotedAtLabel: formatDateLabel(row.promoted_at?.slice?.(0, 10) || null),
    lastContactLabel: formatTimeLabelFromIso(row.last_contact_at, "Recent"),
    manualOutreachTotalCalls: manualOutreach.totalCalls,
    manualOutreachVoicemailLeftCount: manualOutreach.voicemailLeftCount,
    manualOutreachNoAnswerCount: manualOutreach.noAnswerCount,
    manualOutreachConnectedCount: manualOutreach.connectedCount,
    manualOutreachLastOutcome: manualOutreach.lastOutcome,
    manualOutreachLastAgentPhone: manualOutreach.lastAgentPhone,
    manualOutreachLastOccurredAtLabel: manualOutreach.lastOccurredAtLabel,
    originalLanguage: language.originalLanguage,
    containsNonEnglish: language.containsNonEnglish,
    englishTranslationNote: language.englishTranslationNote,
    englishKeyDetails: language.englishKeyDetails,
    starterPacketSentAt: starterPacket.sentAt,
    starterPacketSentAtLabel: starterPacket.sentAtLabel,
    starterPacketUrl: starterPacket.packetUrl,
    starterPacketProviderMessageSid: starterPacket.providerMessageSid,
    starterPacketStatus: starterPacket.status,
  };
}

/**
 * @param {Partial<HiringCandidate>} patch
 * @returns {Partial<HiringCandidateInsertPayload>}
 */
export function mapHiringCandidatePatchToUpdate(patch) {
  return stripUndefined({
    name: patch.name,
    primary_phone: patch.primaryPhone === undefined ? undefined : toNullable(patch.primaryPhone),
    email: patch.email === undefined ? undefined : toNullable(patch.email),
    source: patch.source === undefined ? undefined : toNullable(patch.source),
    stage: patch.stage,
    trade: patch.trade === undefined ? undefined : toNullable(patch.trade),
    city: patch.city === undefined ? undefined : toNullable(patch.city),
    service_area: patch.serviceArea === undefined ? undefined : toNullable(patch.serviceArea),
    structured_start_date:
      patch.structuredStartDate === undefined ? undefined : toNullable(patch.structuredStartDate),
    availability_summary:
      patch.availabilitySummary === undefined ? undefined : toNullable(patch.availabilitySummary),
    availability_days: patch.availabilityDays,
    availability_time_preferences: patch.availabilityTimePreferences,
    current_job_status:
      patch.currentJobStatus === undefined ? undefined : toNullable(patch.currentJobStatus),
    tools_status: patch.toolsStatus === undefined ? undefined : toNullable(patch.toolsStatus),
    vehicle_status: patch.vehicleStatus === undefined ? undefined : toNullable(patch.vehicleStatus),
    tools_vehicle_summary:
      patch.toolsVehicleSummary === undefined ? undefined : toNullable(patch.toolsVehicleSummary),
    payout_expectation_summary:
      patch.payoutExpectationSummary === undefined
        ? undefined
        : toNullable(patch.payoutExpectationSummary),
    experience_summary:
      patch.experienceSummary === undefined ? undefined : toNullable(patch.experienceSummary),
    appliance_experience_summary:
      patch.applianceExperienceSummary === undefined
        ? undefined
        : toNullable(patch.applianceExperienceSummary),
    other_work_experience_summary:
      patch.otherWorkExperienceSummary === undefined
        ? undefined
        : toNullable(patch.otherWorkExperienceSummary),
    next_step: patch.nextStep === undefined ? undefined : toNullable(patch.nextStep),
    call_highlights: patch.callHighlights === undefined ? undefined : toNullable(patch.callHighlights),
    transcript_text: patch.transcriptText === undefined ? undefined : toNullable(patch.transcriptText),
    linked_communication_id:
      patch.linkedCommunicationId === undefined ? undefined : toNullable(patch.linkedCommunicationId),
    provider_call_sid:
      patch.providerCallSid === undefined ? undefined : toNullable(patch.providerCallSid),
    promoted_tech_id:
      patch.promotedTechId === undefined ? undefined : toNullable(patch.promotedTechId),
    last_contact_at: patch.lastContactLabel === undefined ? undefined : patch.lastContactLabel,
  });
}
