import crypto from "node:crypto";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { loadServerEnv } from "./lib/loadEnv.js";

loadServerEnv();

function readRequiredEnv(key) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/$/u, "");
}

function buildValidationPayload(url, params) {
  return Object.keys(params)
    .sort()
    .reduce((payload, key) => payload + key + String(params[key] ?? ""), url);
}

function buildTwilioSignature(authToken, url, params) {
  return crypto.createHmac("sha1", authToken).update(buildValidationPayload(url, params), "utf8").digest("base64");
}

function buildAlternatePhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");

  if (!digits) {
    return "+12145559999";
  }

  const nextLastDigit = digits.endsWith("9") ? "8" : "9";
  const alternateDigits = `${digits.slice(0, -1)}${nextLastDigit}`;

  return alternateDigits.startsWith("1") ? `+${alternateDigits}` : `+1${alternateDigits}`;
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  const body = await response.text();

  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

async function fetchJson(url, options) {
  const response = await fetchText(url, options);
  let parsedBody = null;

  if (response.body) {
    try {
      parsedBody = JSON.parse(response.body);
    } catch (error) {
      throw new Error(`Expected JSON from ${url}, received: ${response.body}`);
    }
  }

  return {
    ...response,
    json: parsedBody,
  };
}

async function isServerHealthy(localBaseUrl) {
  try {
    const response = await fetchJson(`${localBaseUrl}/health`);
    return response.status === 200 && response.json?.ok === true;
  } catch (error) {
    return false;
  }
}

async function waitForHealthyServer(localBaseUrl, server, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (server.child.exitCode !== null) {
      throw new Error("Webhook server exited before becoming healthy.");
    }

    if (await isServerHealthy(localBaseUrl)) {
      return;
    }

    await delay(200);
  }

  throw new Error(`Webhook server did not become healthy within ${timeoutMs}ms.`);
}

function startWebhookServer(appRoot) {
  const child = spawn(process.execPath, ["server/twilioWebhookServer.js"], {
    cwd: appRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";

  child.stdout.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });

  child.stderr.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });

  return {
    child,
    getLogs: () => logs.trim(),
  };
}

async function stopWebhookServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  await new Promise((resolve) => {
    child.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
}

async function ensureWebhookServer(appRoot, localBaseUrl) {
  if (await isServerHealthy(localBaseUrl)) {
    return {
      mode: "reuse",
      child: null,
      getLogs: () => "",
    };
  }

  const server = startWebhookServer(appRoot);

  try {
    await waitForHealthyServer(localBaseUrl, server, 10000);
  } catch (error) {
    await stopWebhookServer(server.child);
    const logs = server.getLogs();
    throw new Error(logs ? `${error.message}\n${logs}` : error.message);
  }

  return {
    mode: "spawned",
    child: server.child,
    getLogs: server.getLogs,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function postSignedForm({
  authToken,
  publicBaseUrl,
  localBaseUrl,
  pathname,
  params,
  useValidSignature = true,
}) {
  const signature = useValidSignature
    ? buildTwilioSignature(authToken, `${publicBaseUrl}${pathname}`, params)
    : "invalid-signature";

  return fetchJson(`${localBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body: new URLSearchParams(params).toString(),
  });
}

async function main() {
  const appRoot = process.cwd();
  const accountSid = readRequiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = readRequiredEnv("TWILIO_AUTH_TOKEN");
  const configuredPhoneNumber = readRequiredEnv("TWILIO_PHONE_NUMBER");
  const publicBaseUrl = normalizeBaseUrl(readRequiredEnv("TWILIO_WEBHOOK_BASE_URL"));
  const localBaseUrl = `http://127.0.0.1:${Number(process.env.TWILIO_WEBHOOK_PORT || 8787)}`;
  const wrongToNumber = buildAlternatePhoneNumber(configuredPhoneNumber);

  const server = await ensureWebhookServer(appRoot, localBaseUrl);

  console.log(`[twilio-smoke] webhook server: ${server.mode === "reuse" ? "reusing existing process" : "started temporary process"}`);
  console.log(`[twilio-smoke] local base URL: ${localBaseUrl}`);
  console.log(`[twilio-smoke] signature base URL: ${publicBaseUrl}`);

  try {
    const health = await fetchJson(`${localBaseUrl}/health`);
    assert(health.status === 200, `Expected /health to return 200, received ${health.status}`);
    assert(health.json?.ok === true, "Expected /health response body to include ok=true.");
    console.log("[twilio-smoke] PASS /health");

    const safeSmsParams = {
      AccountSid: accountSid,
      Body: "ASAP webhook smoke test. This should never be stored.",
      From: "+15551110001",
      MessageSid: "SMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX01",
      To: wrongToNumber,
    };

    const safeSms = await postSignedForm({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/sms",
      params: safeSmsParams,
    });

    assert(safeSms.status === 202, `Expected signed SMS smoke request to return 202, received ${safeSms.status}`);
    assert(
      safeSms.json?.message?.includes("destination number does not match"),
      "Expected signed SMS smoke request to be ignored because To does not match TWILIO_PHONE_NUMBER.",
    );
    console.log("[twilio-smoke] PASS signed SMS ignored safely");

    const safeCallParams = {
      AccountSid: accountSid,
      CallDuration: "0",
      CallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX01",
      CallStatus: "ringing",
      Direction: "inbound",
      From: "+15551110002",
      To: wrongToNumber,
    };

    const safeCall = await postSignedForm({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/calls/status",
      params: safeCallParams,
    });

    assert(safeCall.status === 202, `Expected signed call smoke request to return 202, received ${safeCall.status}`);
    assert(
      safeCall.json?.message?.includes("destination number does not match"),
      "Expected signed call smoke request to be ignored because To does not match TWILIO_PHONE_NUMBER.",
    );
    console.log("[twilio-smoke] PASS signed call ignored safely");

    const invalidSignature = await postSignedForm({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/sms",
      params: {
        ...safeSmsParams,
        To: configuredPhoneNumber,
      },
      useValidSignature: false,
    });

    assert(
      invalidSignature.status === 403,
      `Expected invalid-signature smoke request to return 403, received ${invalidSignature.status}`,
    );
    assert(
      invalidSignature.json?.message === "Invalid Twilio webhook signature.",
      "Expected invalid-signature smoke request to be rejected explicitly.",
    );
    console.log("[twilio-smoke] PASS invalid signature rejected");

    console.log("[twilio-smoke] Completed without creating live communication rows.");
  } finally {
    await stopWebhookServer(server.child);
  }
}

main().catch((error) => {
  console.error(`[twilio-smoke] FAIL ${error.message}`);
  process.exitCode = 1;
});
