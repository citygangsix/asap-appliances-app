import crypto from "node:crypto";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { formatEnvValidationReport, validateSignalWireSmokeEnv } from "./lib/envValidation.js";
import { loadServerEnv } from "./lib/loadEnv.js";

loadServerEnv();

function readFirstEnv(keys) {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }

  return null;
}

function readRequiredAnyEnv(keys) {
  const value = readFirstEnv(keys);

  if (!value) {
    throw new Error(`Missing required environment variable: ${keys.join(" or ")}`);
  }

  return value;
}

function readOptionalListEnv(key) {
  const value = process.env[key];

  if (!value) {
    return [];
  }

  return value
    .split(/[,\n]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
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

async function postDashboardJson(url, body, dashboardAccessToken) {
  return fetchJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dashboardAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
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
    env: {
      ...process.env,
      TWILIO_RECORDING_RECOVERY_ENABLED: "false",
    },
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

async function postSignedFormText({
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

  return fetchText(`${localBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body: new URLSearchParams(params).toString(),
  });
}

async function getSignedText({
  authToken,
  publicBaseUrl,
  localBaseUrl,
  pathname,
  useValidSignature = true,
}) {
  const signature = useValidSignature
    ? buildTwilioSignature(authToken, `${publicBaseUrl}${pathname}`, {})
    : "invalid-signature";

  return fetchText(`${localBaseUrl}${pathname}`, {
    method: "GET",
    headers: {
      "X-Twilio-Signature": signature,
    },
  });
}

async function main() {
  const envValidation = validateSignalWireSmokeEnv();

  if (!envValidation.ok) {
    console.error(formatEnvValidationReport(envValidation));
    process.exitCode = 1;
    return;
  }

  if (envValidation.warnings.length > 0 || envValidation.recommendedMissing.length > 0) {
    console.warn(formatEnvValidationReport(envValidation));
  }

  const appRoot = process.cwd();
  const accountSid = readRequiredAnyEnv(["SIGNALWIRE_PROJECT_ID", "TWILIO_ACCOUNT_SID"]);
  const authToken = readRequiredAnyEnv(["SIGNALWIRE_API_TOKEN", "TWILIO_AUTH_TOKEN"]);
  const dashboardAccessToken = readRequiredAnyEnv([
    "ASAP_DASHBOARD_AUTH_BEARER_TOKEN",
    "SUPABASE_AUTH_ACCESS_TOKEN",
  ]);
  const configuredPhoneNumber = readRequiredAnyEnv(["SIGNALWIRE_PHONE_NUMBER", "TWILIO_PHONE_NUMBER"]);
  const managedPhoneNumbers = Array.from(
    new Set([
      configuredPhoneNumber,
      ...readOptionalListEnv("SIGNALWIRE_MANAGED_PHONE_NUMBERS"),
      ...readOptionalListEnv("TWILIO_MANAGED_PHONE_NUMBERS"),
    ]),
  );
  const expectedVoiceForwardTo =
    process.env.SIGNALWIRE_VOICE_FORWARD_TO ||
    process.env.TWILIO_VOICE_FORWARD_TO ||
    process.env.LUMIA_INVOICE_SMS_PHONE_NUMBER ||
    process.env.ASSISTANT_OFFICE_PHONE_NUMBER ||
    null;
  const expectedClickToCallAgent =
    process.env.SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER ||
    process.env.TWILIO_CLICK_TO_CALL_AGENT_NUMBER ||
    process.env.ASSISTANT_OFFICE_PHONE_NUMBER ||
    process.env.LUMIA_INVOICE_SMS_PHONE_NUMBER ||
    process.env.SIGNALWIRE_VOICE_FORWARD_TO ||
    process.env.TWILIO_VOICE_FORWARD_TO ||
    null;
  const publicBaseUrl = normalizeBaseUrl(
    readRequiredAnyEnv(["SIGNALWIRE_WEBHOOK_BASE_URL", "TWILIO_WEBHOOK_BASE_URL"]),
  );
  const localBaseUrl = `http://127.0.0.1:${Number(process.env.SIGNALWIRE_WEBHOOK_PORT || process.env.TWILIO_WEBHOOK_PORT || 8787)}`;
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
      "Expected signed SMS smoke request to be ignored because To does not match the configured managed business lines.",
    );
    console.log("[twilio-smoke] PASS signed SMS ignored safely");

    const clickToCallDryRun = await postDashboardJson(
      `${localBaseUrl}/api/twilio/outbound/calls`,
      {
        customerId: "00000000-0000-0000-0000-000000000401",
        customerName: "Smoke Test Customer",
        customerPhone: "+15551110004",
        jobId: "00000000-0000-0000-0000-000000000402",
        dryRun: true,
      },
      dashboardAccessToken,
    );

    assert(
      clickToCallDryRun.status === 200 && clickToCallDryRun.json?.ok === true,
      "Expected click-to-call dry run to succeed.",
    );
    assert(
      clickToCallDryRun.json?.preview?.agentPhone === expectedClickToCallAgent,
      `Expected click-to-call dry run to target ${expectedClickToCallAgent} first.`,
    );
    assert(
      managedPhoneNumbers.includes(clickToCallDryRun.json?.preview?.businessPhoneNumber),
      "Expected click-to-call dry run to report a managed business line as the outbound caller ID.",
    );
    assert(
      clickToCallDryRun.json?.preview?.bridgeTwiml?.includes('record="record-from-answer-dual"'),
      "Expected click-to-call dry run TwiML to enable dual-channel recording.",
    );
    assert(
      clickToCallDryRun.json?.preview?.bridgeTwiml?.includes("/api/twilio/recordings/status"),
      "Expected click-to-call dry run TwiML to include the recording callback route.",
    );
    assert(
      clickToCallDryRun.json?.preview?.bridgeTwiml?.includes("+15551110004"),
      "Expected click-to-call dry run TwiML to dial the customer phone number.",
    );
    assert(
      clickToCallDryRun.json?.preview?.followUpPolicy?.maxLiveCustomerCallsPerTrigger === 1,
      "Expected click-to-call dry run to limit outbound attempts to one live customer call.",
    );
    assert(
      clickToCallDryRun.json?.preview?.followUpPolicy?.additionalAutoCallAttempts === 0,
      "Expected click-to-call dry run to disable additional automatic retry calls.",
    );
    console.log("[twilio-smoke] PASS click-to-call dry run prepares agent-first recorded bridge");

    const clickToCallBridge = await postSignedFormText({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/outbound/bridge?customerName=Smoke%20Test%20Customer&customerPhone=%2B15551110004",
      params: {
        AccountSid: accountSid,
        CallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX01",
        Direction: "outbound-api",
        From: configuredPhoneNumber,
        To: expectedClickToCallAgent,
      },
    });

    assert(clickToCallBridge.status === 200, `Expected click-to-call bridge to return 200, received ${clickToCallBridge.status}`);
    assert(
      clickToCallBridge.headers.get("content-type")?.includes("text/xml"),
      "Expected click-to-call bridge POST response to return TwiML XML.",
    );
    assert(clickToCallBridge.body.includes("<Dial"), "Expected click-to-call bridge TwiML to include a Dial verb.");
    assert(
      clickToCallBridge.body.includes("/api/twilio/outbound/calls/status"),
      "Expected click-to-call bridge TwiML to include the outbound status callback route.",
    );
    console.log("[twilio-smoke] PASS click-to-call bridge route returns recorded Dial TwiML");

    const clickToCallBridgeGet = await getSignedText({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname:
        "/api/twilio/outbound/bridge?AccountSid=" +
        encodeURIComponent(accountSid) +
        "&CallSid=CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX03&Direction=outbound-api&From=" +
        encodeURIComponent(configuredPhoneNumber) +
        "&To=" +
        encodeURIComponent(expectedClickToCallAgent) +
        "&customerName=Smoke+Test+Customer&customerPhone=%2B15551110004",
    });

    assert(
      clickToCallBridgeGet.status === 200,
      `Expected GET click-to-call bridge to return 200, received ${clickToCallBridgeGet.status}`,
    );
    assert(
      clickToCallBridgeGet.headers.get("content-type")?.includes("text/xml"),
      "Expected click-to-call bridge GET response to return TwiML XML.",
    );
    assert(
      clickToCallBridgeGet.body.includes("+15551110004"),
      "Expected GET click-to-call bridge TwiML to dial the customer phone number.",
    );
    console.log("[twilio-smoke] PASS click-to-call bridge accepts signed GET requests");

    const voiceWebhook = await postSignedFormText({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/voice",
      params: {
        AccountSid: accountSid,
        CallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX02",
        Direction: "inbound",
        From: "+15551110003",
        To: configuredPhoneNumber,
      },
    });

    assert(voiceWebhook.status === 200, `Expected voice webhook to return 200, received ${voiceWebhook.status}`);
    assert(
      voiceWebhook.headers.get("content-type")?.includes("text/xml"),
      "Expected voice webhook to return TwiML XML.",
    );
    assert(voiceWebhook.body.includes("<Dial"), "Expected voice webhook TwiML to include a Dial verb.");
    assert(
      voiceWebhook.body.includes('record="record-from-answer-dual"'),
      "Expected voice webhook TwiML to enable dual-channel recording from answer.",
    );
    assert(
      voiceWebhook.body.includes("/api/twilio/recordings/status"),
      "Expected voice webhook TwiML to include the recording status callback route.",
    );

    if (expectedVoiceForwardTo) {
      assert(
        voiceWebhook.body.includes(expectedVoiceForwardTo),
        `Expected voice webhook TwiML to dial ${expectedVoiceForwardTo}.`,
      );
    }

    console.log("[twilio-smoke] PASS inbound voice webhook returns forwarding TwiML");

    const safeCallParams = {
      AccountSid: accountSid,
      CallDuration: "0",
      CallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX03",
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
      "Expected signed call smoke request to be ignored because To does not match the configured managed business lines.",
    );
    console.log("[twilio-smoke] PASS signed call ignored safely");

    const browserCallStatus = await postSignedForm({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/browser-call/status",
      params: {
        AccountSid: accountSid,
        CallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX09",
        CallStatus: "completed",
        Direction: "outbound-dial",
        From: configuredPhoneNumber,
        ParentCallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX08",
        To: "+15551110004",
      },
    });

    assert(
      browserCallStatus.status === 200,
      `Expected browser call status callback to return 200, received ${browserCallStatus.status}`,
    );
    assert(
      browserCallStatus.json?.ok === true,
      "Expected browser call status callback to be accepted.",
    );
    assert(
      browserCallStatus.json?.recoveryTriggerStatus === true,
      "Expected completed browser call status to be recognized as a recording recovery trigger.",
    );
    console.log("[twilio-smoke] PASS browser call status accepts recording recovery trigger");

    const recordingCallback = await postSignedForm({
      authToken,
      publicBaseUrl,
      localBaseUrl,
      pathname: "/api/twilio/recordings/status",
      params: {
        AccountSid: "ACWRONGACCOUNTXXXXXXXXXXXXXXXXXX",
        CallSid: "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX04",
        RecordingSid: "REXXXXXXXXXXXXXXXXXXXXXXXXXXXX04",
        RecordingStatus: "completed",
      },
    });

    assert(
      recordingCallback.status === 403,
      `Expected recording callback with wrong AccountSid to return 403, received ${recordingCallback.status}`,
    );
    assert(
      recordingCallback.json?.message?.includes("AccountSid mismatch"),
      "Expected recording callback to reject mismatched AccountSid before any write path runs.",
    );
    console.log("[twilio-smoke] PASS recording callback route rejects mismatched account safely");

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
      ["Invalid voice provider webhook signature.", "Invalid Twilio webhook signature."].includes(
        invalidSignature.json?.message,
      ),
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
