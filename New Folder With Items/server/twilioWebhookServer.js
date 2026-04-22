import http from "node:http";
import { URL } from "node:url";
import { getServerSupabaseClient, getTwilioServerConfig } from "./lib/supabaseAdmin.js";
import {
  runDispatchWorkflow,
  runFinalWorkWorkflow,
  runInvoiceGenerationWorkflow,
  runInvoicePaidWorkflow,
} from "./lib/opsWorkflowManager.js";
import { notifyDispatchEtaUpdate } from "./lib/twilioOutboundNotifications.js";
import { notifyLumiaAboutInvoice } from "./lib/lumiaInvoiceSms.js";
import { isValidTwilioSignature } from "./lib/twilioSignature.js";
import {
  matchesConfiguredTwilioNumber,
  persistInboundCallEvent,
  persistInboundSms,
} from "./lib/twilioCommunications.js";
import {
  buildClickToCallBridgeTwiml,
  handleClickToCallStatusCallback,
  requestClickToCall,
} from "./lib/twilioClickToCall.js";
import { handleThumbtackLeadRequest } from "./lib/thumbtackLeadBridge.js";
import { logManualCall } from "./lib/manualCallLogs.js";
import { persistRecordingStatusCallback } from "./lib/twilioVoiceRecordings.js";

const SMS_WEBHOOK_PATH = "/api/twilio/sms";
const VOICE_WEBHOOK_PATH = "/api/twilio/voice";
const CALL_STATUS_WEBHOOK_PATH = "/api/twilio/calls/status";
const RECORDING_STATUS_WEBHOOK_PATH = "/api/twilio/recordings/status";
const CLICK_TO_CALL_PATH = "/api/twilio/outbound/calls";
const CLICK_TO_CALL_BRIDGE_PATH = "/api/twilio/outbound/bridge";
const CLICK_TO_CALL_STATUS_PATH = "/api/twilio/outbound/calls/status";
const THUMBTACK_LEAD_PATH = "/api/thumbtack/lead";
const MANUAL_CALL_LOG_PATH = "/api/manual/calls/log";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Twilio-Signature, X-Thumbtack-Secret, X-ASAP-Webhook-Secret",
};

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function parseFormBody(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

function parseJsonBody(body) {
  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON request body.");
  }
}

function getLocalOperationsServerPort() {
  const configuredPort = Number(process.env.TWILIO_WEBHOOK_PORT || 8787);
  return Number.isFinite(configuredPort) ? configuredPort : 8787;
}

function respondJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function buildEmptyTwiml() {
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;");
}

function buildInboundVoiceForwardTwiml(config) {
  const recordingStatusCallbackUrl = buildWebhookUrl(
    config.webhookBaseUrl,
    RECORDING_STATUS_WEBHOOK_PATH,
  );

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<Response>",
    `<Dial answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(
      recordingStatusCallbackUrl,
    )}" recordingStatusCallbackMethod="POST">${escapeXml(config.voiceForwardToNumber)}</Dial>`,
    "</Response>",
  ].join("");
}

function respondTwiml(response, twiml = buildEmptyTwiml(), statusCode = 200) {
  response.writeHead(statusCode, {
    ...CORS_HEADERS,
    "Content-Type": "text/xml; charset=utf-8",
  });
  response.end(twiml);
}

function respondNoContent(response, statusCode = 204) {
  response.writeHead(statusCode, CORS_HEADERS);
  response.end();
}

function buildWebhookUrl(baseUrl, pathname) {
  return `${baseUrl}${pathname}`;
}

async function validateTwilioWebhookRequest(request, response, options = {}) {
  const { requireMatchingTo = true } = options;
  const config = getTwilioServerConfig();
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const body = request.method === "POST" ? await readRequestBody(request) : "";
  const formPayload = parseFormBody(body);
  const payload =
    request.method === "GET" ? Object.fromEntries(requestUrl.searchParams.entries()) : formPayload;
  const signatureParams = request.method === "GET" ? {} : formPayload;
  const signature = request.headers["x-twilio-signature"];

  if (payload.AccountSid !== config.accountSid) {
    respondJson(response, 403, { ok: false, message: "Twilio AccountSid mismatch." });
    return;
  }

  if (
    requireMatchingTo &&
    !matchesConfiguredTwilioNumber(config.managedPhoneNumbers || config.phoneNumber, payload.To)
  ) {
    respondJson(response, 202, {
      ok: false,
      message:
        "Webhook accepted but ignored because the destination number does not match TWILIO_PHONE_NUMBER or TWILIO_MANAGED_PHONE_NUMBERS.",
    });
    return null;
  }

  if (
    !isValidTwilioSignature({
      authToken: config.authToken,
      signature,
      url: buildWebhookUrl(config.webhookBaseUrl, request.url || requestUrl.pathname),
      params: signatureParams,
    })
  ) {
    respondJson(response, 403, { ok: false, message: "Invalid Twilio webhook signature." });
    return null;
  }

  return { config, payload };
}

async function handleTwilioWebhook(request, response, pathname, persistEvent) {
  const validatedRequest = await validateTwilioWebhookRequest(request, response);

  if (!validatedRequest) {
    return;
  }

  const { payload } = validatedRequest;

  const result = await persistEvent(getServerSupabaseClient(), payload);

  if (pathname === SMS_WEBHOOK_PATH) {
    respondTwiml(response, buildEmptyTwiml(), result.status || 200);
    return;
  }

  respondJson(response, result.status || 200, result);
}

async function handleTwilioVoiceWebhook(request, response, pathname) {
  const validatedRequest = await validateTwilioWebhookRequest(request, response);

  if (!validatedRequest) {
    return;
  }

  const { config } = validatedRequest;

  if (!config.voiceForwardToNumber) {
    respondJson(response, 500, {
      ok: false,
      message:
        "TWILIO_VOICE_FORWARD_TO or LUMIA_INVOICE_SMS_PHONE_NUMBER must be configured on the server.",
    });
    return;
  }

  respondTwiml(response, buildInboundVoiceForwardTwiml(config));
}

async function handleRecordingStatusWebhook(request, response, pathname) {
  const validatedRequest = await validateTwilioWebhookRequest(request, response, {
    requireMatchingTo: false,
  });

  if (!validatedRequest) {
    return;
  }

  const result = await persistRecordingStatusCallback(
    getServerSupabaseClient(),
    validatedRequest.payload,
  );

  respondJson(response, result.status || (result.ok ? 200 : 400), result);
}

async function handleClickToCallRequest(request, response) {
  const body = await readRequestBody(request);
  const result = await requestClickToCall(parseJsonBody(body));
  respondJson(response, result.status || (result.ok ? 200 : 500), result);
}

async function handleThumbtackLeadWebhook(request, response) {
  const body = await readRequestBody(request);
  const result = await handleThumbtackLeadRequest(parseJsonBody(body), request.headers);
  respondJson(response, result.status || (result.ok ? 200 : 500), result);
}

async function handleManualCallLogRequest(request, response) {
  const body = await readRequestBody(request);
  const result = await logManualCall(getServerSupabaseClient(), parseJsonBody(body));
  respondJson(response, result.status || (result.ok ? 200 : 500), result);
}

async function handleClickToCallBridgeWebhook(request, response, pathname, requestUrl) {
  const validatedRequest = await validateTwilioWebhookRequest(request, response, {
    requireMatchingTo: false,
  });

  if (!validatedRequest) {
    return;
  }

  respondTwiml(
    response,
    buildClickToCallBridgeTwiml(validatedRequest.config, {
      businessPhoneNumber: requestUrl.searchParams.get("businessPhoneNumber"),
      customerName: requestUrl.searchParams.get("customerName"),
      customerPhone: requestUrl.searchParams.get("customerPhone"),
    }),
  );
}

async function handleClickToCallStatusWebhook(request, response, pathname) {
  const validatedRequest = await validateTwilioWebhookRequest(request, response, {
    requireMatchingTo: false,
  });

  if (!validatedRequest) {
    return;
  }

  const result = await handleClickToCallStatusCallback(validatedRequest.payload);
  respondJson(response, result.status || 200, result);
}

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");

  if (request.method === "OPTIONS") {
    respondNoContent(response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    respondJson(response, 200, { ok: true, status: "ok" });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/invoices/send-lumia") {
    const body = await readRequestBody(request);
    const result = await notifyLumiaAboutInvoice(parseJsonBody(body));
    respondJson(response, result.status || (result.ok ? 200 : 500), result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/dispatch/notify-eta") {
    const body = await readRequestBody(request);
    const result = await notifyDispatchEtaUpdate(parseJsonBody(body));
    respondJson(response, result.status || (result.ok ? 200 : 500), result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/workflows/dispatch") {
    const body = await readRequestBody(request);
    const result = await runDispatchWorkflow(parseJsonBody(body));
    respondJson(response, result.status || (result.ok ? 200 : 500), result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/workflows/generate-invoice") {
    const body = await readRequestBody(request);
    const result = await runInvoiceGenerationWorkflow(parseJsonBody(body));
    respondJson(response, result.status || (result.ok ? 200 : 500), result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/workflows/invoice-paid") {
    const body = await readRequestBody(request);
    const result = await runInvoicePaidWorkflow(parseJsonBody(body));
    respondJson(response, result.status || (result.ok ? 200 : 500), result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/workflows/final-work") {
    const body = await readRequestBody(request);
    const result = await runFinalWorkWorkflow(parseJsonBody(body));
    respondJson(response, result.status || (result.ok ? 200 : 500), result);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === CLICK_TO_CALL_PATH) {
    await handleClickToCallRequest(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === THUMBTACK_LEAD_PATH) {
    await handleThumbtackLeadWebhook(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === MANUAL_CALL_LOG_PATH) {
    await handleManualCallLogRequest(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === SMS_WEBHOOK_PATH) {
    await handleTwilioWebhook(request, response, requestUrl.pathname, persistInboundSms);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === VOICE_WEBHOOK_PATH) {
    await handleTwilioVoiceWebhook(request, response, requestUrl.pathname);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === CALL_STATUS_WEBHOOK_PATH) {
    await handleTwilioWebhook(request, response, requestUrl.pathname, persistInboundCallEvent);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === RECORDING_STATUS_WEBHOOK_PATH) {
    await handleRecordingStatusWebhook(request, response, requestUrl.pathname);
    return;
  }

  if (
    (request.method === "POST" || request.method === "GET") &&
    requestUrl.pathname === CLICK_TO_CALL_BRIDGE_PATH
  ) {
    await handleClickToCallBridgeWebhook(request, response, requestUrl.pathname, requestUrl);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === CLICK_TO_CALL_STATUS_PATH) {
    await handleClickToCallStatusWebhook(request, response, requestUrl.pathname);
    return;
  }

  respondJson(response, 404, { ok: false, message: "Route not found." });
}

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    console.error("[twilio-webhooks]", error);
    respondJson(response, 500, { ok: false, message: error.message });
  });
});

const port = getLocalOperationsServerPort();

server.listen(port, () => {
  console.log(`[twilio-webhooks] listening on http://127.0.0.1:${port}`);
  console.log(`[twilio-webhooks] sms route: ${SMS_WEBHOOK_PATH}`);
  console.log(`[twilio-webhooks] voice route: ${VOICE_WEBHOOK_PATH}`);
  console.log(`[twilio-webhooks] call route: ${CALL_STATUS_WEBHOOK_PATH}`);
  console.log(`[twilio-webhooks] recording route: ${RECORDING_STATUS_WEBHOOK_PATH}`);
  console.log(`[twilio-webhooks] click-to-call route: ${CLICK_TO_CALL_PATH}`);
  console.log(`[twilio-webhooks] click-to-call bridge route: ${CLICK_TO_CALL_BRIDGE_PATH}`);
  console.log(`[twilio-webhooks] click-to-call status route: ${CLICK_TO_CALL_STATUS_PATH}`);
  console.log(`[twilio-webhooks] thumbtack lead route: ${THUMBTACK_LEAD_PATH}`);
  console.log(`[twilio-webhooks] manual call log route: ${MANUAL_CALL_LOG_PATH}`);
  console.log("[twilio-webhooks] invoice sms route: /api/invoices/send-lumia");
  console.log("[twilio-webhooks] dispatch notify route: /api/dispatch/notify-eta");
  console.log("[twilio-webhooks] workflow dispatch route: /api/workflows/dispatch");
  console.log("[twilio-webhooks] workflow invoice route: /api/workflows/generate-invoice");
  console.log("[twilio-webhooks] workflow paid route: /api/workflows/invoice-paid");
  console.log("[twilio-webhooks] workflow final-work route: /api/workflows/final-work");
});
