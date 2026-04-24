import { getServerSupabaseClient, getTwilioServerConfig } from "./supabaseAdmin.js";
import { persistRecordingStatusCallback } from "./twilioVoiceRecordings.js";

const TWILIO_API_BASE_URL = "https://api.twilio.com/2010-04-01";
const DEFAULT_RECOVERY_INTERVAL_SECONDS = 60;
const DEFAULT_RECOVERY_INITIAL_DELAY_SECONDS = 20;
const DEFAULT_RECOVERY_LOOKBACK_MINUTES = 480;
const DEFAULT_RECOVERY_PAGE_SIZE = 50;
const DEFAULT_RECOVERY_MAX_RECORDINGS = 20;
const DEFAULT_FAILED_RETRY_MINUTES = 30;

let activeRecoveryPromise = null;

function readOptionalNumberEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readOptionalBooleanEnv(key, fallback) {
  const value = process.env[key];

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function normalizeOptionalString(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function normalizePhoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function normalizePhoneNumber(value) {
  const digits = normalizePhoneDigits(value);

  if (!digits || digits.length < 10) {
    return null;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return digits.startsWith("1") ? `+${digits}` : `+${digits}`;
}

function isLikelyPhoneNumber(value) {
  return Boolean(normalizePhoneNumber(value)) && !String(value || "").startsWith("client:");
}

function buildTwilioAuthHeader(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function getRecoveryConfig() {
  return {
    enabled: readOptionalBooleanEnv("TWILIO_RECORDING_RECOVERY_ENABLED", true),
    intervalSeconds: readOptionalNumberEnv(
      "TWILIO_RECORDING_RECOVERY_INTERVAL_SECONDS",
      DEFAULT_RECOVERY_INTERVAL_SECONDS,
    ),
    initialDelaySeconds: readOptionalNumberEnv(
      "TWILIO_RECORDING_RECOVERY_INITIAL_DELAY_SECONDS",
      DEFAULT_RECOVERY_INITIAL_DELAY_SECONDS,
    ),
    lookbackMinutes: readOptionalNumberEnv(
      "TWILIO_RECORDING_RECOVERY_LOOKBACK_MINUTES",
      DEFAULT_RECOVERY_LOOKBACK_MINUTES,
    ),
    pageSize: readOptionalNumberEnv("TWILIO_RECORDING_RECOVERY_PAGE_SIZE", DEFAULT_RECOVERY_PAGE_SIZE),
    maxRecordings: readOptionalNumberEnv(
      "TWILIO_RECORDING_RECOVERY_MAX_RECORDINGS",
      DEFAULT_RECOVERY_MAX_RECORDINGS,
    ),
    failedRetryMinutes: readOptionalNumberEnv(
      "TWILIO_RECORDING_RECOVERY_FAILED_RETRY_MINUTES",
      DEFAULT_FAILED_RETRY_MINUTES,
    ),
  };
}

function buildTwilioApiUrl(config, pathname, params = {}) {
  const url = new URL(`${TWILIO_API_BASE_URL}/Accounts/${config.accountSid}${pathname}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function fetchTwilioJson(config, pathname, params = {}) {
  const url = buildTwilioApiUrl(config, pathname, params);
  const response = await fetch(url, {
    headers: {
      Authorization: buildTwilioAuthHeader(config.accountSid, config.authToken),
    },
  });
  const text = await response.text();
  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Twilio returned non-JSON from ${url.pathname}.`);
    }
  }

  if (!response.ok) {
    throw new Error(json?.message || `Twilio API request failed with status ${response.status}.`);
  }

  return json;
}

function parseTwilioDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function buildRecordingUrl(config, recordingSid) {
  return `${TWILIO_API_BASE_URL}/Accounts/${config.accountSid}/Recordings/${recordingSid}`;
}

async function listRecentTwilioRecordings(config, recoveryConfig) {
  const payload = await fetchTwilioJson(config, "/Recordings.json", {
    PageSize: recoveryConfig.pageSize,
  });
  const cutoffMs = Date.now() - recoveryConfig.lookbackMinutes * 60 * 1000;
  const recordings = Array.isArray(payload.recordings) ? payload.recordings : [];

  return recordings
    .filter((recording) => {
      const status = String(recording.status || "").toLowerCase();
      const createdAt = parseTwilioDate(recording.date_created);

      return (
        recording.sid &&
        recording.call_sid &&
        status === "completed" &&
        (!createdAt || createdAt.getTime() >= cutoffMs)
      );
    })
    .slice(0, recoveryConfig.maxRecordings);
}

async function fetchTwilioCall(config, callSid) {
  if (!callSid) {
    return null;
  }

  try {
    return await fetchTwilioJson(config, `/Calls/${encodeURIComponent(callSid)}.json`);
  } catch (error) {
    console.error("[twilio-recording-recovery][call-lookup]", callSid, error.message);
    return null;
  }
}

async function listTwilioChildCalls(config, parentCallSid) {
  if (!parentCallSid) {
    return [];
  }

  try {
    const payload = await fetchTwilioJson(config, "/Calls.json", {
      ParentCallSid: parentCallSid,
      PageSize: 20,
    });

    return Array.isArray(payload.calls) ? payload.calls : [];
  } catch (error) {
    console.error("[twilio-recording-recovery][child-call-lookup]", parentCallSid, error.message);
    return [];
  }
}

function buildExcludedPhoneDigits(config) {
  return new Set(
    [
      ...(Array.isArray(config.managedPhoneNumbers) ? config.managedPhoneNumbers : [config.phoneNumber]),
      config.phoneNumber,
      config.assistantOfficePhoneNumber,
      config.voiceForwardToNumber,
      config.clickToCallAgentNumber,
      config.lumiaInvoicePhoneNumber,
    ]
      .map(normalizePhoneDigits)
      .filter(Boolean),
  );
}

function pickExternalPhoneNumber(config, call, childCalls) {
  const excluded = buildExcludedPhoneDigits(config);
  const candidates = [
    ...childCalls.map((childCall) => childCall.to),
    call?.from,
    call?.to,
    ...childCalls.map((childCall) => childCall.from),
  ];

  for (const candidate of candidates) {
    if (!isLikelyPhoneNumber(candidate)) {
      continue;
    }

    const digits = normalizePhoneDigits(candidate);

    if (!digits || excluded.has(digits)) {
      continue;
    }

    return normalizePhoneNumber(candidate);
  }

  return null;
}

function shouldRetryFailedRecording(existingRecording, recoveryConfig) {
  if (existingRecording?.transcription_status !== "failed") {
    return true;
  }

  const lastAttemptAt = parseTwilioDate(existingRecording.callback_received_at);

  if (!lastAttemptAt) {
    return true;
  }

  return Date.now() - lastAttemptAt.getTime() >= recoveryConfig.failedRetryMinutes * 60 * 1000;
}

async function listExistingRecordings(client, recordingSids) {
  if (!recordingSids.length) {
    return new Map();
  }

  const result = await client
    .from("twilio_voice_recordings")
    .select("provider_recording_sid,transcription_status,callback_received_at")
    .in("provider_recording_sid", recordingSids);

  if (result.error) {
    throw new Error(`twilioVoiceRecordings.recoveryLookup: ${result.error.message}`);
  }

  return new Map((result.data || []).map((recording) => [recording.provider_recording_sid, recording]));
}

async function buildRecoveredRecordingPayload(config, recording) {
  const call = await fetchTwilioCall(config, recording.call_sid);
  const childCalls = await listTwilioChildCalls(config, recording.call_sid);
  const externalPhoneNumber = pickExternalPhoneNumber(config, call, childCalls);

  return {
    AccountSid: recording.account_sid || config.accountSid,
    CallSid: recording.call_sid,
    ParentCallSid: normalizeOptionalString(call?.parent_call_sid),
    From: normalizeOptionalString(call?.from),
    To: normalizeOptionalString(call?.to),
    Direction: normalizeOptionalString(call?.direction),
    CallStatus: normalizeOptionalString(call?.status),
    CallDuration: normalizeOptionalString(call?.duration || recording.duration),
    RecordingSid: recording.sid,
    RecordingStatus: recording.status || "completed",
    RecordingDuration: normalizeOptionalString(recording.duration),
    RecordingChannels: normalizeOptionalString(recording.channels),
    RecordingSource: normalizeOptionalString(recording.source),
    RecordingTrack: normalizeOptionalString(recording.track),
    RecordingUrl: buildRecordingUrl(config, recording.sid),
    browserCallTo: externalPhoneNumber,
    recoveredBy: "twilio_recording_recovery",
  };
}

async function recoverLatestTwilioRecordingsOnce({ client, force = false } = {}) {
  const recoveryConfig = getRecoveryConfig();

  if (!force && !recoveryConfig.enabled) {
    return {
      ok: true,
      status: 200,
      enabled: false,
      message: "Twilio recording recovery is disabled.",
    };
  }

  const supabaseClient = client || getServerSupabaseClient();
  const twilioConfig = getTwilioServerConfig();
  const recordings = await listRecentTwilioRecordings(twilioConfig, recoveryConfig);
  const existingRecordings = await listExistingRecordings(
    supabaseClient,
    recordings.map((recording) => recording.sid),
  );
  const recovered = [];
  const skipped = [];
  const failed = [];

  for (const recording of recordings) {
    const existingRecording = existingRecordings.get(recording.sid);

    if (existingRecording?.transcription_status === "completed") {
      skipped.push({ recordingSid: recording.sid, reason: "already_transcribed" });
      continue;
    }

    if (!shouldRetryFailedRecording(existingRecording, recoveryConfig)) {
      skipped.push({ recordingSid: recording.sid, reason: "failed_retry_cooling_down" });
      continue;
    }

    try {
      const payload = await buildRecoveredRecordingPayload(twilioConfig, recording);
      const result = await persistRecordingStatusCallback(supabaseClient, payload);

      recovered.push({
        recordingSid: recording.sid,
        callSid: recording.call_sid,
        candidatePhone: payload.browserCallTo || null,
        transcriptionStatus: result.record?.transcription_status || null,
        hiringCandidateId: result.hiringCandidate?.candidate_id || null,
        hiringCandidateName: result.hiringCandidate?.name || null,
        reason: result.reason,
      });
    } catch (error) {
      failed.push({
        recordingSid: recording.sid,
        callSid: recording.call_sid,
        message: error?.message || "Recording recovery failed.",
      });
      console.error("[twilio-recording-recovery][recording]", recording.sid, error);
    }
  }

  return {
    ok: failed.length === 0,
    status: failed.length ? 207 : 200,
    enabled: recoveryConfig.enabled,
    checked: recordings.length,
    recovered,
    skipped,
    failed,
    message: `Recording recovery checked ${recordings.length} recent recording(s).`,
  };
}

export async function recoverLatestTwilioRecordings(options = {}) {
  if (activeRecoveryPromise) {
    return {
      ok: true,
      status: 202,
      reason: "already_running",
      message: "Twilio recording recovery is already running.",
    };
  }

  activeRecoveryPromise = recoverLatestTwilioRecordingsOnce(options);

  try {
    return await activeRecoveryPromise;
  } finally {
    activeRecoveryPromise = null;
  }
}

export function startTwilioRecordingRecovery({ client, logger = console } = {}) {
  const recoveryConfig = getRecoveryConfig();

  if (!recoveryConfig.enabled) {
    logger.log("[twilio-recording-recovery] disabled");
    return {
      enabled: false,
      stop: () => {},
    };
  }

  const runRecovery = async (reason) => {
    try {
      const result = await recoverLatestTwilioRecordings({ client });
      const recoveredCount = result.recovered?.length || 0;
      const failedCount = result.failed?.length || 0;

      if (recoveredCount || failedCount) {
        logger.log("[twilio-recording-recovery]", {
          reason,
          checked: result.checked,
          recovered: recoveredCount,
          failed: failedCount,
        });
      }
    } catch (error) {
      logger.error("[twilio-recording-recovery]", error);
    }
  };

  const initialTimer = setTimeout(
    () => runRecovery("startup-delay"),
    recoveryConfig.initialDelaySeconds * 1000,
  );
  const intervalTimer = setInterval(
    () => runRecovery("interval"),
    recoveryConfig.intervalSeconds * 1000,
  );

  initialTimer.unref?.();
  intervalTimer.unref?.();

  logger.log(
    `[twilio-recording-recovery] enabled every ${recoveryConfig.intervalSeconds}s, lookback ${recoveryConfig.lookbackMinutes}m`,
  );

  return {
    enabled: true,
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    },
  };
}
