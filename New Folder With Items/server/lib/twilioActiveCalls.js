import { getTwilioServerConfig } from "./supabaseAdmin.js";

const ACTIVE_CALL_STATUSES = ["queued", "initiated", "ringing", "in-progress"];
const ACTIVE_CALL_STATUS_SET = new Set(ACTIVE_CALL_STATUSES);

function buildTwilioAuthHeader(accountSid, authToken) {
  return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
}

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function readField(record, ...keys) {
  for (const key of keys) {
    const value = record?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function parseProviderDate(value) {
  const rawValue = toNullableString(value);

  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? rawValue : parsed.toISOString();
}

function normalizeCallRecord(record) {
  const sid = readField(record, "sid", "Sid");
  const status = String(readField(record, "status", "Status") || "unknown").toLowerCase();
  const durationSeconds = Number.parseInt(
    String(readField(record, "duration", "Duration") || "0"),
    10,
  );

  return {
    sid,
    parentCallSid: readField(record, "parent_call_sid", "parentCallSid", "ParentCallSid"),
    status,
    direction: readField(record, "direction", "Direction"),
    from: readField(record, "from", "From"),
    to: readField(record, "to", "To"),
    startTime: parseProviderDate(readField(record, "start_time", "startTime", "StartTime")),
    endTime: parseProviderDate(readField(record, "end_time", "endTime", "EndTime")),
    createdAt: parseProviderDate(readField(record, "date_created", "dateCreated", "DateCreated")),
    updatedAt: parseProviderDate(readField(record, "date_updated", "dateUpdated", "DateUpdated")),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  };
}

async function fetchCallsForStatus(config, status) {
  const url = new URL(`${config.apiBaseUrl}/Accounts/${config.accountSid}/Calls.json`);
  url.searchParams.set("Status", status);
  url.searchParams.set("PageSize", "20");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: buildTwilioAuthHeader(config.accountSid, config.authToken),
    },
  });
  const responseText = await response.text();
  const responseJson = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(
      responseJson?.message ||
        `${config.providerDisplayName} active call lookup failed for ${status} with status ${response.status}.`,
    );
  }

  return Array.isArray(responseJson?.calls) ? responseJson.calls : [];
}

export async function listActiveTwilioCalls() {
  const config = getTwilioServerConfig();
  const callGroups = await Promise.all(
    ACTIVE_CALL_STATUSES.map((status) => fetchCallsForStatus(config, status)),
  );
  const callsBySid = new Map();

  for (const record of callGroups.flat()) {
    const normalized = normalizeCallRecord(record);

    if (normalized.sid && ACTIVE_CALL_STATUS_SET.has(normalized.status)) {
      callsBySid.set(normalized.sid, normalized);
    }
  }

  const calls = Array.from(callsBySid.values()).sort((left, right) => {
    const leftTime = new Date(left.startTime || left.createdAt || 0).getTime();
    const rightTime = new Date(right.startTime || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

  return {
    ok: true,
    status: 200,
    calls,
    activeCount: calls.length,
    fetchedAt: new Date().toISOString(),
    message: calls.length
      ? `${calls.length} active call leg${calls.length === 1 ? "" : "s"} found.`
      : "No active calls right now.",
  };
}
