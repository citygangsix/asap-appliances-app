import { getTwilioServerConfig } from "./supabaseAdmin.js";

const BROWSER_CALL_TOKEN_TTL_SECONDS = 3600;
const BROWSER_CALL_STATUS_EVENTS = ["initiated", "ringing", "answered", "completed"];
const BROWSER_CALL_STATUS_CALLBACK_PATH = "/api/twilio/browser-call/status";

function normalizePhoneNumber(value) {
  const rawValue = String(value || "").trim();
  const digits = rawValue.replace(/\D/g, "");

  if (/^\+1\d{10}$/u.test(rawValue)) {
    return rawValue;
  }

  if (/^\d{10}$/u.test(digits)) {
    return `+1${digits}`;
  }

  if (/^1\d{10}$/u.test(digits)) {
    return `+${digits}`;
  }

  return "";
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array
    ? value
    : new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = base64UrlEncode(
    new Uint8Array(
      await globalThis.crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signingInput)),
    ),
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function requireBrowserVoiceConfig(config) {
  const missing = [];

  if (!config.apiKeySid) missing.push("TWILIO_API_KEY_SID");
  if (!config.apiKeySecret) missing.push("TWILIO_API_KEY_SECRET");
  if (!config.twimlAppSid) missing.push("TWILIO_TWIML_APP_SID or SIGNALWIRE_CXML_APP_SID");

  if (missing.length) {
    return {
      ok: false,
      status: 501,
      missing,
      message: `Browser calling needs server env: ${missing.join(", ")}.`,
    };
  }

  return { ok: true };
}

function buildWebhookUrl(baseUrl, pathname) {
  return `${baseUrl}${pathname}`;
}

export function normalizeBrowserCallNumber(value) {
  return normalizePhoneNumber(value);
}

export function buildBrowserCallTwiml(config, payload) {
  const to = normalizePhoneNumber(payload?.To || payload?.to);

  if (!to) {
    return [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<Response>",
      "<Say>That phone number is not valid.</Say>",
      "</Response>",
    ].join("");
  }

  const statusCallbackUrl = buildWebhookUrl(config.webhookBaseUrl, BROWSER_CALL_STATUS_CALLBACK_PATH);
  const recordingParams = new URLSearchParams({ browserCallTo: to });
  const recordingStatusCallbackUrl = `${buildWebhookUrl(
    config.webhookBaseUrl,
    "/api/twilio/recordings/status",
  )}?${recordingParams.toString()}`;
  const statusEvents = BROWSER_CALL_STATUS_EVENTS.join(" ");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<Response>",
    `<Dial callerId="${escapeXml(config.phoneNumber)}" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(
      recordingStatusCallbackUrl,
    )}" recordingStatusCallbackMethod="POST">`,
    `<Number statusCallback="${escapeXml(
      statusCallbackUrl,
    )}" statusCallbackMethod="POST" statusCallbackEvent="${escapeXml(statusEvents)}">${escapeXml(
      to,
    )}</Number>`,
    "</Dial>",
    "</Response>",
  ].join("");
}

export async function requestBrowserCall(payload) {
  const config = getTwilioServerConfig();
  const voiceConfig = requireBrowserVoiceConfig(config);
  const to = normalizePhoneNumber(payload?.to);

  if (!to) {
    return {
      ok: false,
      status: 400,
      callStatus: "Failed",
      message: "A valid US destination phone number is required.",
    };
  }

  if (!voiceConfig.ok) {
    return {
      ...voiceConfig,
      ok: false,
      callStatus: "Failed",
      to,
    };
  }

  return {
    ok: true,
    status: 200,
    callStatus: "Ready",
    to,
    message: "Number validated. Browser client can connect through Twilio Voice SDK.",
  };
}

export async function requestBrowserHangup() {
  return {
    ok: true,
    status: 202,
    callStatus: "Ended",
    message: "Hangup accepted.",
  };
}

export async function requestBrowserVoiceToken() {
  const config = getTwilioServerConfig();
  const voiceConfig = requireBrowserVoiceConfig(config);

  if (!voiceConfig.ok) {
    return voiceConfig;
  }

  const now = Math.floor(Date.now() / 1000);
  const identity = "asap-crm-browser";
  const payload = {
    jti: `${config.apiKeySid}-${now}`,
    iss: config.apiKeySid,
    sub: config.accountSid,
    iat: now,
    exp: now + BROWSER_CALL_TOKEN_TTL_SECONDS,
    grants: {
      identity,
      voice: {
        incoming: { allow: false },
        outgoing: {
          application_sid: config.twimlAppSid,
        },
      },
    },
  };

  return {
    ok: true,
    status: 200,
    token: await signJwt(payload, config.apiKeySecret),
    identity,
    expiresAt: new Date((now + BROWSER_CALL_TOKEN_TTL_SECONDS) * 1000).toISOString(),
    twimlAppSid: config.twimlAppSid,
  };
}
