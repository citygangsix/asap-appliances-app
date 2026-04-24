import { getTwilioServerConfig } from "./supabaseAdmin.js";
import { sendStarterPacketToHiredCandidate } from "./hiringStarterPacket.js";

const HIRING_CANDIDATE_STAGES = new Set([
  "contacted",
  "interviewed",
  "trial_scheduled",
  "documents_pending",
  "offered",
  "onboarded",
  "rejected",
]);
const HIRING_AVAILABILITY_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const HIRING_AVAILABILITY_TIME_PREFERENCES = new Set([
  "weekdays",
  "weekends",
  "mornings",
  "afternoons",
  "evenings",
  "overnights",
  "anytime",
]);

function normalizeOptionalString(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizeOptionalDate(value) {
  const trimmed = normalizeOptionalString(value);
  return trimmed && /^\d{4}-\d{2}-\d{2}$/u.test(trimmed) ? trimmed : null;
}

function normalizeStringArray(values, allowedValues) {
  const source = Array.isArray(values) ? values : [];
  const normalized = [];
  const seen = new Set();

  source.forEach((value) => {
    const item = normalizeOptionalString(value)?.toLowerCase() || null;

    if (!item || (allowedValues && !allowedValues.has(item)) || seen.has(item)) {
      return;
    }

    normalized.push(item);
    seen.add(item);
  });

  return normalized;
}

function coalesceArray(nextValues, fallbackValues) {
  return Array.isArray(nextValues) && nextValues.length > 0
    ? nextValues
    : Array.isArray(fallbackValues)
      ? fallbackValues
      : [];
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function normalizePhoneNumber(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits) {
    return null;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}

function normalizeCandidateStage(value) {
  return HIRING_CANDIDATE_STAGES.has(value) ? value : "contacted";
}

function getPreferredCallNumbers(target) {
  if (!target) {
    return [];
  }

  if (target.direction === "outbound") {
    return [target.to_number, target.from_number];
  }

  return [target.from_number, target.to_number];
}

function pickCandidatePhone(targets, config) {
  const excludedNumbers = new Set(
    [
      ...(Array.isArray(config.managedPhoneNumbers) ? config.managedPhoneNumbers : [config.phoneNumber]),
      config.assistantOfficePhoneNumber,
      config.voiceForwardToNumber,
      config.clickToCallAgentNumber,
      config.lumiaInvoicePhoneNumber,
    ]
      .map(normalizePhoneDigits)
      .filter(Boolean),
  );

  const orderedNumbers = [
    targets.browserCallTo,
    targets.browser_call_to,
    ...getPreferredCallNumbers(targets.communication),
    ...getPreferredCallNumbers(targets.unmatchedInbound),
    targets.communication?.to_number,
    targets.communication?.from_number,
    targets.unmatchedInbound?.to_number,
    targets.unmatchedInbound?.from_number,
  ];

  for (const value of orderedNumbers) {
    const normalizedDigits = normalizePhoneDigits(value);

    if (!normalizedDigits || excludedNumbers.has(normalizedDigits)) {
      continue;
    }

    return normalizePhoneNumber(value);
  }

  return null;
}

function coalesceString(...values) {
  for (const value of values) {
    const normalized = normalizeOptionalString(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function buildManualOutreachSummary(existingCandidate, payload) {
  const previousSummary =
    existingCandidate?.raw_analysis &&
    typeof existingCandidate.raw_analysis === "object" &&
    existingCandidate.raw_analysis.manualOutreach &&
    typeof existingCandidate.raw_analysis.manualOutreach === "object"
      ? existingCandidate.raw_analysis.manualOutreach
      : {};
  const callOutcome = normalizeOptionalString(payload.callOutcome) || "connected";
  const occurredAt = normalizeOptionalString(payload.occurredAt) || new Date().toISOString();

  return {
    totalCalls: Number(previousSummary.totalCalls || 0) + 1,
    voicemailLeftCount:
      Number(previousSummary.voicemailLeftCount || 0) + (callOutcome === "voicemail_left" ? 1 : 0),
    noAnswerCount:
      Number(previousSummary.noAnswerCount || 0) + (callOutcome === "no_answer" ? 1 : 0),
    connectedCount:
      Number(previousSummary.connectedCount || 0) + (callOutcome === "connected" ? 1 : 0),
    lastOutcome: callOutcome,
    lastAgentPhone: normalizeOptionalString(payload.agentPhone),
    lastNote: normalizeOptionalString(payload.note),
    lastOccurredAt: occurredAt,
  };
}

function buildAvailabilityNotes(candidate, existingTechnician = null) {
  const parts = [];

  if (candidate.availability_summary) {
    parts.push(candidate.availability_summary);
  }

  if (candidate.structured_start_date) {
    parts.push(`Start date ${candidate.structured_start_date}`);
  }

  if (candidate.availability_days?.length) {
    parts.push(`Days: ${candidate.availability_days.join(", ")}`);
  }

  if (candidate.availability_time_preferences?.length) {
    parts.push(`Windows: ${candidate.availability_time_preferences.join(", ")}`);
  }

  return coalesceString(parts.join(" | "), existingTechnician?.availability_notes, "Availability pending");
}

function buildSkillList(candidate, existingTechnician = null) {
  const nextSkills = [];
  const seen = new Set();

  const pushSkill = (value) => {
    const skill = normalizeOptionalString(value);

    if (!skill) {
      return;
    }

    const key = skill.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    nextSkills.push(skill);
  };

  String(candidate.trade || "")
    .split(/[,&/]/u)
    .forEach(pushSkill);

  (existingTechnician?.skills || []).forEach(pushSkill);

  return nextSkills;
}

async function findExistingCandidateByField(client, field, value) {
  if (!value) {
    return null;
  }

  const result = await client
    .from("hiring_candidates")
    .select("*")
    .eq(field, value)
    .maybeSingle();

  if (result.error) {
    throw new Error(`hiringCandidates.lookupBy${field}: ${result.error.message}`);
  }

  return result.data || null;
}

async function findExistingTechnicianByField(client, field, value) {
  if (!value) {
    return null;
  }

  const result = await client
    .from("technicians")
    .select("*")
    .eq(field, value)
    .maybeSingle();

  if (result.error) {
    throw new Error(`technicians.lookupBy${field}: ${result.error.message}`);
  }

  return result.data || null;
}

function buildCandidatePromotionPreview(candidateRecord, existingTechnician = null) {
  return {
    name: candidateRecord.name,
    primary_phone: candidateRecord.primary_phone || existingTechnician?.primary_phone || null,
    email: candidateRecord.email || existingTechnician?.email || null,
    service_area:
      candidateRecord.service_area ||
      candidateRecord.city ||
      existingTechnician?.service_area ||
      "Pending service area",
    service_zip_codes: existingTechnician?.service_zip_codes || [],
    skills: buildSkillList(candidateRecord, existingTechnician),
    availability_notes: buildAvailabilityNotes(candidateRecord, existingTechnician),
    availability_days: coalesceArray(
      candidateRecord.availability_days,
      existingTechnician?.availability_days,
    ),
    availability_time_preferences: coalesceArray(
      candidateRecord.availability_time_preferences,
      existingTechnician?.availability_time_preferences,
    ),
    hire_start_date:
      candidateRecord.structured_start_date || existingTechnician?.hire_start_date || null,
    status_today: existingTechnician?.status_today || "unassigned",
    jobs_completed_this_week: existingTechnician?.jobs_completed_this_week || 0,
    callback_rate_percent: existingTechnician?.callback_rate_percent || 0,
    payout_total: existingTechnician?.payout_total || 0,
    gas_reimbursement_total: existingTechnician?.gas_reimbursement_total || 0,
    score: existingTechnician?.score || 0,
  };
}

function shouldPromoteHiringCandidate(candidateRecord) {
  const hasAvailabilityDetails =
    Boolean(candidateRecord.availability_summary) ||
    (candidateRecord.availability_days || []).length > 0 ||
    (candidateRecord.availability_time_preferences || []).length > 0;

  return candidateRecord.stage === "onboarded" && hasAvailabilityDetails;
}

async function findExistingTechnicianForCandidate(client, candidateRecord) {
  if (candidateRecord.promoted_tech_id) {
    const byLinkedTechId = await findExistingTechnicianByField(
      client,
      "tech_id",
      candidateRecord.promoted_tech_id,
    );

    if (byLinkedTechId) {
      return byLinkedTechId;
    }
  }

  const byPhone = await findExistingTechnicianByField(
    client,
    "primary_phone",
    candidateRecord.primary_phone,
  );

  if (byPhone) {
    return byPhone;
  }

  const byEmail = await findExistingTechnicianByField(client, "email", candidateRecord.email);

  if (byEmail) {
    return byEmail;
  }

  return findExistingTechnicianByField(client, "name", candidateRecord.name);
}

async function promoteCandidateToTechnician(client, candidateRecord) {
  if (!shouldPromoteHiringCandidate(candidateRecord)) {
    return {
      skipped: true,
      reason: "candidate_not_ready_for_roster",
      record: null,
    };
  }

  const existingTechnician = await findExistingTechnicianForCandidate(client, candidateRecord);
  const technicianPayload = buildCandidatePromotionPreview(candidateRecord, existingTechnician);

  if (existingTechnician) {
    const result = await client
      .from("technicians")
      .update(technicianPayload)
      .eq("tech_id", existingTechnician.tech_id)
      .select("*")
      .single();

    if (result.error) {
      throw new Error(`technicians.updateFromHiringCandidate: ${result.error.message}`);
    }

    return {
      skipped: false,
      reason: "updated_existing_technician",
      record: result.data,
    };
  }

  const result = await client
    .from("technicians")
    .insert(technicianPayload)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`technicians.insertFromHiringCandidate: ${result.error.message}`);
  }

  return {
    skipped: false,
    reason: "created_technician",
    record: result.data,
  };
}

async function linkCandidateToTechnician(client, candidateRecord, technicianRecord) {
  if (!candidateRecord || !technicianRecord) {
    return candidateRecord;
  }

  if (candidateRecord.promoted_tech_id === technicianRecord.tech_id && candidateRecord.promoted_at) {
    const starterPacketResult = await sendStarterPacketToHiredCandidate(
      client,
      getTwilioServerConfig(),
      candidateRecord,
      technicianRecord,
    );

    return starterPacketResult.candidate || candidateRecord;
  }

  const result = await client
    .from("hiring_candidates")
    .update({
      promoted_tech_id: technicianRecord.tech_id,
      promoted_at: candidateRecord.promoted_at || new Date().toISOString(),
    })
    .eq("candidate_id", candidateRecord.candidate_id)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`hiringCandidates.linkPromotedTechnician: ${result.error.message}`);
  }

  const starterPacketResult = await sendStarterPacketToHiredCandidate(
    client,
    getTwilioServerConfig(),
    result.data,
    technicianRecord,
  );

  return starterPacketResult.candidate || result.data;
}

function buildCandidatePayload({ existingCandidate, intelligence, targets, payload, candidatePhone }) {
  const hiringCandidate = intelligence?.hiringCandidate || {};
  const candidateName = coalesceString(hiringCandidate.candidateName, existingCandidate?.name);
  const providerCallSid =
    normalizeOptionalString(payload.CallSid) ||
    normalizeOptionalString(payload.ParentCallSid) ||
    normalizeOptionalString(existingCandidate?.provider_call_sid);

  return {
    name:
      coalesceString(
        candidateName && !["mike", "michael"].includes(candidateName.toLowerCase())
          ? candidateName
          : null,
        candidatePhone,
        "Hiring candidate",
      ) || "Hiring candidate",
    primary_phone: candidatePhone || existingCandidate?.primary_phone || null,
    email: coalesceString(hiringCandidate.email, existingCandidate?.email),
    source: coalesceString(hiringCandidate.source, existingCandidate?.source, "Call transcript"),
    stage: normalizeCandidateStage(hiringCandidate.stage || existingCandidate?.stage),
    trade: coalesceString(hiringCandidate.trade, existingCandidate?.trade),
    city: coalesceString(hiringCandidate.city, existingCandidate?.city),
    service_area: coalesceString(hiringCandidate.serviceArea, existingCandidate?.service_area),
    structured_start_date: normalizeOptionalDate(
      hiringCandidate.startDate || existingCandidate?.structured_start_date,
    ),
    availability_summary: coalesceString(
      hiringCandidate.availabilitySummary,
      existingCandidate?.availability_summary,
    ),
    availability_days: coalesceArray(
      normalizeStringArray(hiringCandidate.availabilityDays, HIRING_AVAILABILITY_DAYS),
      existingCandidate?.availability_days,
    ),
    availability_time_preferences: coalesceArray(
      normalizeStringArray(
        hiringCandidate.availabilityTimePreferences,
        HIRING_AVAILABILITY_TIME_PREFERENCES,
      ),
      existingCandidate?.availability_time_preferences,
    ),
    payout_expectation_summary: coalesceString(
      hiringCandidate.payoutExpectationSummary,
      existingCandidate?.payout_expectation_summary,
    ),
    experience_summary: coalesceString(
      hiringCandidate.experienceSummary,
      existingCandidate?.experience_summary,
    ),
    next_step: coalesceString(hiringCandidate.nextStep, existingCandidate?.next_step),
    call_highlights: coalesceString(intelligence?.callHighlights, existingCandidate?.call_highlights),
    transcript_text: coalesceString(intelligence?.transcriptText, existingCandidate?.transcript_text),
    linked_communication_id:
      targets.communication?.communication_id || existingCandidate?.linked_communication_id || null,
    provider_call_sid: providerCallSid,
    promoted_tech_id: existingCandidate?.promoted_tech_id || null,
    promoted_at: existingCandidate?.promoted_at || null,
    raw_analysis: {
      conversationType: intelligence?.conversationType || null,
      classification: intelligence?.classification || null,
      language: intelligence?.language || null,
      hiringCandidate: hiringCandidate,
      recordingSid: normalizeOptionalString(payload.RecordingSid),
      callSid: normalizeOptionalString(payload.CallSid),
      parentCallSid: normalizeOptionalString(payload.ParentCallSid),
      browserCallTo: normalizeOptionalString(payload.browserCallTo),
      hiredCriteria: hiringCandidate.hiredCriteria || [],
    },
    last_contact_at: intelligence?.transcribedAt || new Date().toISOString(),
  };
}

export async function upsertHiringCandidateFromCall(client, payload, intelligence, targets) {
  if (!intelligence?.hiringCandidate?.isHiringConversation) {
    return {
      skipped: true,
      reason: "not_hiring_conversation",
      record: null,
    };
  }

  const candidatePhone = pickCandidatePhone(targets, getTwilioServerConfig());
  const existingByCallSid = await findExistingCandidateByField(
    client,
    "provider_call_sid",
    normalizeOptionalString(payload.CallSid) || normalizeOptionalString(payload.ParentCallSid),
  );
  const existingByPhone =
    existingByCallSid || !candidatePhone
      ? null
      : await findExistingCandidateByField(client, "primary_phone", candidatePhone);
  const existingCandidate = existingByCallSid || existingByPhone;
  const candidatePayload = buildCandidatePayload({
    existingCandidate,
    intelligence,
    targets,
    payload,
    candidatePhone,
  });

  if (existingCandidate) {
    const result = await client
      .from("hiring_candidates")
      .update(candidatePayload)
      .eq("candidate_id", existingCandidate.candidate_id)
      .select("*")
      .single();

    if (result.error) {
      throw new Error(`hiringCandidates.update: ${result.error.message}`);
    }

    const promotionResult = await promoteCandidateToTechnician(client, result.data);
    const linkedCandidate = await linkCandidateToTechnician(
      client,
      result.data,
      promotionResult.record,
    );

    return {
      skipped: false,
      reason: "updated",
      record: linkedCandidate,
      promotedTechnician: promotionResult.record || null,
      promotionReason: promotionResult.reason,
    };
  }

  const result = await client
    .from("hiring_candidates")
    .insert(candidatePayload)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`hiringCandidates.insert: ${result.error.message}`);
  }

  const promotionResult = await promoteCandidateToTechnician(client, result.data);
  const linkedCandidate = await linkCandidateToTechnician(
    client,
    result.data,
    promotionResult.record,
  );

  return {
    skipped: false,
    reason: "created",
    record: linkedCandidate,
    promotedTechnician: promotionResult.record || null,
    promotionReason: promotionResult.reason,
  };
}

export async function upsertHiringCandidateFromManualLog(client, payload = {}, intelligence = null) {
  const candidatePhone = normalizePhoneNumber(payload.candidatePhone);
  const candidateName = coalesceString(payload.candidateName, candidatePhone, "Hiring candidate");
  const existingByPhone = candidatePhone
    ? await findExistingCandidateByField(client, "primary_phone", candidatePhone)
    : null;
  const existingByEmail =
    existingByPhone || !payload.email
      ? null
      : await findExistingCandidateByField(client, "email", normalizeOptionalString(payload.email));
  const existingByName =
    existingByPhone || existingByEmail || !candidateName
      ? null
      : await findExistingCandidateByField(client, "name", candidateName);
  const existingCandidate = existingByPhone || existingByEmail || existingByName;
  const hiringCandidate = intelligence?.hiringCandidate || {};
  const occurredAt = normalizeOptionalString(payload.occurredAt) || new Date().toISOString();
  const callOutcome = normalizeOptionalString(payload.callOutcome) || "connected";
  const note = normalizeOptionalString(payload.note);
  const baseStage =
    callOutcome === "connected"
      ? hiringCandidate.stage || existingCandidate?.stage || "contacted"
      : existingCandidate?.stage || "contacted";
  const nextStep =
    normalizeOptionalString(payload.nextStep) ||
    hiringCandidate.nextStep ||
    (callOutcome === "voicemail_left"
      ? "Follow up after voicemail."
      : callOutcome === "no_answer"
        ? "Retry outreach."
        : null);
  const manualOutreach = buildManualOutreachSummary(existingCandidate, payload);
  const candidatePayload = {
    name: candidateName,
    primary_phone: candidatePhone || existingCandidate?.primary_phone || null,
    email: coalesceString(payload.email, hiringCandidate.email, existingCandidate?.email),
    source: coalesceString(payload.source, hiringCandidate.source, existingCandidate?.source, "Manual phone log"),
    stage: normalizeCandidateStage(baseStage),
    trade: coalesceString(hiringCandidate.trade, existingCandidate?.trade),
    city: coalesceString(hiringCandidate.city, existingCandidate?.city),
    service_area: coalesceString(hiringCandidate.serviceArea, existingCandidate?.service_area),
    structured_start_date: normalizeOptionalDate(
      hiringCandidate.startDate || existingCandidate?.structured_start_date,
    ),
    availability_summary: coalesceString(
      hiringCandidate.availabilitySummary,
      existingCandidate?.availability_summary,
    ),
    availability_days: coalesceArray(
      normalizeStringArray(hiringCandidate.availabilityDays, HIRING_AVAILABILITY_DAYS),
      existingCandidate?.availability_days,
    ),
    availability_time_preferences: coalesceArray(
      normalizeStringArray(
        hiringCandidate.availabilityTimePreferences,
        HIRING_AVAILABILITY_TIME_PREFERENCES,
      ),
      existingCandidate?.availability_time_preferences,
    ),
    payout_expectation_summary: coalesceString(
      hiringCandidate.payoutExpectationSummary,
      existingCandidate?.payout_expectation_summary,
    ),
    experience_summary: coalesceString(
      hiringCandidate.experienceSummary,
      existingCandidate?.experience_summary,
    ),
    next_step: nextStep,
    call_highlights: coalesceString(
      intelligence?.callHighlights,
      note,
      existingCandidate?.call_highlights,
    ),
    transcript_text: coalesceString(note, intelligence?.transcriptText, existingCandidate?.transcript_text),
    linked_communication_id: existingCandidate?.linked_communication_id || null,
    provider_call_sid: existingCandidate?.provider_call_sid || null,
    promoted_tech_id: existingCandidate?.promoted_tech_id || null,
    promoted_at: existingCandidate?.promoted_at || null,
    raw_analysis: {
      ...(existingCandidate?.raw_analysis && typeof existingCandidate.raw_analysis === "object"
        ? existingCandidate.raw_analysis
        : {}),
      conversationType: intelligence?.conversationType || null,
      hiringCandidate,
      manualOutreach,
      manualLog: {
        occurredAt,
        agentPhone: normalizeOptionalString(payload.agentPhone),
        callOutcome,
      },
    },
    last_contact_at: occurredAt,
  };

  if (existingCandidate) {
    const result = await client
      .from("hiring_candidates")
      .update(candidatePayload)
      .eq("candidate_id", existingCandidate.candidate_id)
      .select("*")
      .single();

    if (result.error) {
      throw new Error(`hiringCandidates.updateManualLog: ${result.error.message}`);
    }

    const promotionResult = await promoteCandidateToTechnician(client, result.data);
    const linkedCandidate = await linkCandidateToTechnician(
      client,
      result.data,
      promotionResult.record,
    );

    return {
      skipped: false,
      reason: "updated",
      record: linkedCandidate,
      promotedTechnician: promotionResult.record || null,
      promotionReason: promotionResult.reason,
    };
  }

  const result = await client
    .from("hiring_candidates")
    .insert(candidatePayload)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`hiringCandidates.insertManualLog: ${result.error.message}`);
  }

  const promotionResult = await promoteCandidateToTechnician(client, result.data);
  const linkedCandidate = await linkCandidateToTechnician(
    client,
    result.data,
    promotionResult.record,
  );

  return {
    skipped: false,
    reason: "created",
    record: linkedCandidate,
    promotedTechnician: promotionResult.record || null,
    promotionReason: promotionResult.reason,
  };
}
