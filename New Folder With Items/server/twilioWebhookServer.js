import http from "node:http";
import { URL } from "node:url";
import { getServerSupabaseClient, getTwilioServerConfig } from "./lib/supabaseAdmin.js";
import { isValidTwilioSignature } from "./lib/twilioSignature.js";
import {
  matchesConfiguredTwilioNumber,
  persistInboundCallEvent,
  persistInboundSms,
} from "./lib/twilioCommunications.js";

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

function respondJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function respondTwiml(response, statusCode = 200) {
  response.writeHead(statusCode, { "Content-Type": "text/xml; charset=utf-8" });
  response.end("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
}

function buildWebhookUrl(baseUrl, pathname) {
  return `${baseUrl}${pathname}`;
}

async function handleTwilioWebhook(request, response, pathname, persistEvent) {
  const config = getTwilioServerConfig();
  const body = await readRequestBody(request);
  const payload = parseFormBody(body);
  const signature = request.headers["x-twilio-signature"];

  if (payload.AccountSid !== config.accountSid) {
    respondJson(response, 403, { ok: false, message: "Twilio AccountSid mismatch." });
    return;
  }

  if (!matchesConfiguredTwilioNumber(config.phoneNumber, payload.To)) {
    respondJson(response, 202, {
      ok: false,
      message: "Webhook accepted but ignored because the destination number does not match TWILIO_PHONE_NUMBER.",
    });
    return;
  }

  if (
    !isValidTwilioSignature({
      authToken: config.authToken,
      signature,
      url: buildWebhookUrl(config.webhookBaseUrl, pathname),
      params: payload,
    })
  ) {
    respondJson(response, 403, { ok: false, message: "Invalid Twilio webhook signature." });
    return;
  }

  const result = await persistEvent(getServerSupabaseClient(), payload);

  if (pathname === "/api/twilio/sms") {
    respondTwiml(response, result.status || 200);
    return;
  }

  respondJson(response, result.status || 200, result);
}

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    respondJson(response, 200, { ok: true, status: "ok" });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/twilio/sms") {
    await handleTwilioWebhook(request, response, requestUrl.pathname, persistInboundSms);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/twilio/calls/status") {
    await handleTwilioWebhook(request, response, requestUrl.pathname, persistInboundCallEvent);
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

const { port } = getTwilioServerConfig();

server.listen(port, () => {
  console.log(`[twilio-webhooks] listening on http://127.0.0.1:${port}`);
  console.log("[twilio-webhooks] sms route: /api/twilio/sms");
  console.log("[twilio-webhooks] call route: /api/twilio/calls/status");
});
