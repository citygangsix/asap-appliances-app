import { getServerSupabaseClient, getTwilioServerConfig } from "./supabaseAdmin.js";
import {
  runDispatchWorkflow,
  runFinalWorkWorkflow,
  runInvoiceGenerationWorkflow,
  runInvoicePaidWorkflow,
} from "./opsWorkflowManager.js";
import { notifyDispatchEtaUpdate } from "./twilioOutboundNotifications.js";
import { notifyLumiaAboutInvoice } from "./lumiaInvoiceSms.js";
import { isValidTwilioSignature } from "./twilioSignature.js";
import {
  matchesConfiguredTwilioNumber,
  persistInboundCallEvent,
  persistInboundSms,
} from "./twilioCommunications.js";
import {
  buildClickToCallBridgeTwiml,
  handleClickToCallStatusCallback,
  requestClickToCall,
} from "./twilioClickToCall.js";
import { handleThumbtackLeadRequest } from "./thumbtackLeadBridge.js";
import { logManualCall } from "./manualCallLogs.js";
import { persistRecordingStatusCallback } from "./twilioVoiceRecordings.js";
import {
  buildBrowserCallTwiml,
  requestBrowserCall,
  requestBrowserHangup,
  requestBrowserVoiceToken,
} from "./twilioBrowserCalling.js";
import { handleBrowserCallStatusCallback } from "./twilioBrowserCallStatus.js";
import { listHiringCandidateRows } from "./hiringCandidateDirectory.js";

const SMS_WEBHOOK_PATH = "/api/twilio/sms";
const VOICE_WEBHOOK_PATH = "/api/twilio/voice";
const CALL_STATUS_WEBHOOK_PATH = "/api/twilio/calls/status";
const RECORDING_STATUS_WEBHOOK_PATH = "/api/twilio/recordings/status";
const CLICK_TO_CALL_PATH = "/api/twilio/outbound/calls";
const CLICK_TO_CALL_BRIDGE_PATH = "/api/twilio/outbound/bridge";
const CLICK_TO_CALL_STATUS_PATH = "/api/twilio/outbound/calls/status";
const BROWSER_CALL_PATH = "/api/twilio/browser-call";
const BROWSER_CALL_STATUS_PATH = "/api/twilio/browser-call/status";
const BROWSER_CALL_TWIML_PATH = "/api/twilio/browser-call/twiml";
const BROWSER_HANGUP_PATH = "/api/twilio/hangup";
const BROWSER_VOICE_TOKEN_PATH = "/api/twilio/voice-token";
const HIRING_CANDIDATES_PATH = "/api/hiring-candidates";
const THUMBTACK_LEAD_PATH = "/api/thumbtack/lead";
const MANUAL_CALL_LOG_PATH = "/api/manual/calls/log";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Twilio-Signature, X-Thumbtack-Secret, X-ASAP-Webhook-Secret",
};

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

function respondJson(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function respondTwiml(twiml = buildEmptyTwiml(), statusCode = 200) {
  return new Response(twiml, {
    status: statusCode,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

function respondNoContent(statusCode = 204) {
  return new Response(null, {
    status: statusCode,
    headers: CORS_HEADERS,
  });
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

function buildWebhookUrl(baseUrl, pathname) {
  return `${baseUrl}${pathname}`;
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function stripPathPrefix(pathname, prefix) {
  if (!prefix || prefix === "/") {
    return pathname;
  }

  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;

  if (pathname === normalizedPrefix) {
    return "/";
  }

  if (pathname.startsWith(`${normalizedPrefix}/`)) {
    return pathname.slice(normalizedPrefix.length) || "/";
  }

  return pathname;
}

function buildRequestContext(request, options = {}) {
  const requestUrl = new URL(request.url);
  const pathname = stripPathPrefix(requestUrl.pathname, options.pathPrefix);
  const routeUrl = new URL(requestUrl);
  routeUrl.pathname = pathname;

  return {
    headers: normalizeHeaders(request.headers),
    originalUrl: requestUrl,
    routeUrl,
    pathname,
    pathAndSearch: `${pathname}${routeUrl.search}`,
  };
}

async function validateTwilioWebhookRequest(request, context, options = {}) {
  const { requireMatchingTo = true } = options;
  const config = getTwilioServerConfig();
  const body = request.method === "POST" ? await request.text() : "";
  const formPayload = parseFormBody(body);
  const queryPayload = Object.fromEntries(context.routeUrl.searchParams.entries());
  const payload = request.method === "GET" ? queryPayload : { ...queryPayload, ...formPayload };
  const signatureParams = request.method === "GET" ? {} : formPayload;
  const signature = context.headers["x-twilio-signature"];

  if (payload.AccountSid !== config.accountSid) {
    return {
      response: respondJson(403, { ok: false, message: "Twilio AccountSid mismatch." }),
    };
  }

  if (
    requireMatchingTo &&
    !matchesConfiguredTwilioNumber(config.managedPhoneNumbers || config.phoneNumber, payload.To)
  ) {
    return {
      response: respondJson(202, {
        ok: false,
        message:
          "Webhook accepted but ignored because the destination number does not match TWILIO_PHONE_NUMBER or TWILIO_MANAGED_PHONE_NUMBERS.",
      }),
    };
  }

  if (
    !(await isValidTwilioSignature({
      authToken: config.authToken,
      signature,
      url: buildWebhookUrl(config.webhookBaseUrl, context.pathAndSearch),
      params: signatureParams,
    }))
  ) {
    return {
      response: respondJson(403, { ok: false, message: "Invalid Twilio webhook signature." }),
    };
  }

  return { config, payload };
}

async function handleTwilioWebhook(request, context, pathname, persistEvent) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context);

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  const result = await persistEvent(getServerSupabaseClient(), validatedRequest.payload);

  if (pathname === SMS_WEBHOOK_PATH) {
    return respondTwiml(buildEmptyTwiml(), result.status || 200);
  }

  return respondJson(result.status || 200, result);
}

async function handleTwilioVoiceWebhook(request, context) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context);

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  if (!validatedRequest.config.voiceForwardToNumber) {
    return respondJson(500, {
      ok: false,
      message:
        "TWILIO_VOICE_FORWARD_TO or LUMIA_INVOICE_SMS_PHONE_NUMBER must be configured on the server.",
    });
  }

  return respondTwiml(buildInboundVoiceForwardTwiml(validatedRequest.config));
}

async function handleRecordingStatusWebhook(request, context) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context, {
    requireMatchingTo: false,
  });

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  const result = await persistRecordingStatusCallback(
    getServerSupabaseClient(),
    validatedRequest.payload,
  );

  return respondJson(result.status || (result.ok ? 200 : 400), result);
}

async function handleClickToCallRequest(request) {
  const result = await requestClickToCall(parseJsonBody(await request.text()));
  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

async function handleBrowserCallRequest(request) {
  const result = await requestBrowserCall(parseJsonBody(await request.text()));
  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

async function handleBrowserHangupRequest(request) {
  const result = await requestBrowserHangup(parseJsonBody(await request.text()));
  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

async function handleBrowserVoiceTokenRequest() {
  const result = await requestBrowserVoiceToken();
  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

async function handleBrowserCallStatusWebhook(request, context) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context, {
    requireMatchingTo: false,
  });

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  const result = await handleBrowserCallStatusCallback(validatedRequest.payload);
  return respondJson(result.status || 200, result);
}

async function handleHiringCandidatesRequest() {
  const candidates = await listHiringCandidateRows(getServerSupabaseClient());

  return respondJson(200, {
    ok: true,
    candidates,
    fetchedAt: new Date().toISOString(),
    message: "Live hiring candidates loaded from the server database.",
  });
}

async function handleBrowserCallTwimlRequest(request, context) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context, {
    requireMatchingTo: false,
  });

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  return respondTwiml(
    buildBrowserCallTwiml(validatedRequest.config, validatedRequest.payload),
  );
}

async function handleThumbtackLeadWebhook(request, context) {
  const result = await handleThumbtackLeadRequest(
    parseJsonBody(await request.text()),
    context.headers,
  );

  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

async function handleManualCallLogRequest(request) {
  const result = await logManualCall(
    getServerSupabaseClient(),
    parseJsonBody(await request.text()),
  );

  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

async function handleClickToCallBridgeWebhook(request, context) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context, {
    requireMatchingTo: false,
  });

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  return respondTwiml(
    buildClickToCallBridgeTwiml(validatedRequest.config, {
      businessPhoneNumber: context.routeUrl.searchParams.get("businessPhoneNumber"),
      customerName: context.routeUrl.searchParams.get("customerName"),
      customerPhone: context.routeUrl.searchParams.get("customerPhone"),
    }),
  );
}

async function handleClickToCallStatusWebhook(request, context) {
  const validatedRequest = await validateTwilioWebhookRequest(request, context, {
    requireMatchingTo: false,
  });

  if (validatedRequest.response) {
    return validatedRequest.response;
  }

  const result = await handleClickToCallStatusCallback(validatedRequest.payload);
  return respondJson(result.status || 200, result);
}

async function handleJsonWorkflowRequest(request, workflow) {
  const result = await workflow(parseJsonBody(await request.text()));
  return respondJson(result.status || (result.ok ? 200 : 500), result);
}

export async function handleOperationsFetchRequest(request, options = {}) {
  try {
    const context = buildRequestContext(request, options);
    const { pathname } = context;

    if (request.method === "OPTIONS") {
      return respondNoContent();
    }

    if (request.method === "GET" && pathname === "/health") {
      return respondJson(200, { ok: true, status: "ok" });
    }

    if (request.method === "POST" && pathname === "/api/invoices/send-lumia") {
      return handleJsonWorkflowRequest(request, notifyLumiaAboutInvoice);
    }

    if (request.method === "POST" && pathname === "/api/dispatch/notify-eta") {
      return handleJsonWorkflowRequest(request, notifyDispatchEtaUpdate);
    }

    if (request.method === "POST" && pathname === "/api/workflows/dispatch") {
      return handleJsonWorkflowRequest(request, runDispatchWorkflow);
    }

    if (request.method === "POST" && pathname === "/api/workflows/generate-invoice") {
      return handleJsonWorkflowRequest(request, runInvoiceGenerationWorkflow);
    }

    if (request.method === "POST" && pathname === "/api/workflows/invoice-paid") {
      return handleJsonWorkflowRequest(request, runInvoicePaidWorkflow);
    }

    if (request.method === "POST" && pathname === "/api/workflows/final-work") {
      return handleJsonWorkflowRequest(request, runFinalWorkWorkflow);
    }

    if (request.method === "POST" && pathname === CLICK_TO_CALL_PATH) {
      return handleClickToCallRequest(request);
    }

    if (request.method === "POST" && pathname === BROWSER_CALL_PATH) {
      return handleBrowserCallRequest(request);
    }

    if (request.method === "POST" && pathname === BROWSER_CALL_TWIML_PATH) {
      return handleBrowserCallTwimlRequest(request, context);
    }

    if (request.method === "POST" && pathname === BROWSER_CALL_STATUS_PATH) {
      return handleBrowserCallStatusWebhook(request, context);
    }

    if (request.method === "POST" && pathname === BROWSER_HANGUP_PATH) {
      return handleBrowserHangupRequest(request);
    }

    if (request.method === "GET" && pathname === BROWSER_VOICE_TOKEN_PATH) {
      return handleBrowserVoiceTokenRequest();
    }

    if (request.method === "GET" && pathname === HIRING_CANDIDATES_PATH) {
      return handleHiringCandidatesRequest();
    }

    if (request.method === "POST" && pathname === THUMBTACK_LEAD_PATH) {
      return handleThumbtackLeadWebhook(request, context);
    }

    if (request.method === "POST" && pathname === MANUAL_CALL_LOG_PATH) {
      return handleManualCallLogRequest(request);
    }

    if (request.method === "POST" && pathname === SMS_WEBHOOK_PATH) {
      return handleTwilioWebhook(request, context, pathname, persistInboundSms);
    }

    if (request.method === "POST" && pathname === VOICE_WEBHOOK_PATH) {
      return handleTwilioVoiceWebhook(request, context);
    }

    if (request.method === "POST" && pathname === CALL_STATUS_WEBHOOK_PATH) {
      return handleTwilioWebhook(request, context, pathname, persistInboundCallEvent);
    }

    if (request.method === "POST" && pathname === RECORDING_STATUS_WEBHOOK_PATH) {
      return handleRecordingStatusWebhook(request, context);
    }

    if (
      (request.method === "POST" || request.method === "GET") &&
      pathname === CLICK_TO_CALL_BRIDGE_PATH
    ) {
      return handleClickToCallBridgeWebhook(request, context);
    }

    if (request.method === "POST" && pathname === CLICK_TO_CALL_STATUS_PATH) {
      return handleClickToCallStatusWebhook(request, context);
    }

    return respondJson(404, { ok: false, message: "Route not found." });
  } catch (error) {
    console.error("[asap-crm-api]", error);
    return respondJson(500, {
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected API error.",
    });
  }
}
