import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadServerEnv } from "../server/lib/loadEnv.js";

loadServerEnv();

const projectRef = process.env.SUPABASE_PROJECT_REF || "nexkymqahpkvzzlvivfi";
const defaultSupabaseUrl = `https://${projectRef}.supabase.co`;
const hostedApi =
  process.env.HOSTED_API ||
  process.env.ASAP_HOSTED_API_URL ||
  `${defaultSupabaseUrl}/functions/v1/asap-crm`;
const smokePhone = process.env.ASAP_EXTERNAL_SMOKE_TEST_PHONE || "+15551110004";

function maybeReadCliKeys() {
  try {
    const raw = execFileSync(
      "supabase",
      ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function findKey(keys, names) {
  for (const entry of keys) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const name = String(entry.name || entry.key || "").toLowerCase();

    if (names.some((candidate) => name.includes(candidate))) {
      return entry.api_key || entry.key_value || entry.value || entry.secret || null;
    }
  }

  return null;
}

function readFirstEnv(keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();

    if (value) {
      return { key, value };
    }
  }

  return { key: null, value: "" };
}

function buildTwilioSignature(url, params, authToken) {
  const validationPayload = Object.keys(params)
    .sort()
    .reduce((payload, key) => `${payload}${key}${String(params[key] ?? "")}`, url);

  return createHmac("sha1", authToken).update(validationPayload).digest("base64");
}

function summarizeJson(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return {
    ok: payload.ok,
    status: payload.status,
    dryRun: payload.dryRun,
    message: payload.message,
  };
}

function summarizeVoiceToken(payload) {
  return {
    ...summarizeJson(payload),
    tokenReturned: typeof payload?.token === "string" && payload.token.split(".").length === 3,
    identity: payload?.identity || null,
    expiresAt: payload?.expiresAt || null,
    twimlAppSidPresent: Boolean(payload?.twimlAppSid),
  };
}

function summarizeCallDryRun(payload) {
  return {
    ...summarizeJson(payload),
    agentPhonePresent: Boolean(payload?.preview?.agentPhone),
    businessPhonePresent: Boolean(payload?.preview?.businessPhoneNumber),
    bridgeUrlPresent: Boolean(payload?.preview?.bridgeUrl),
    statusCallbackUrlPresent: Boolean(payload?.preview?.statusCallbackUrl),
    recordingCallbackUrlPresent: Boolean(payload?.preview?.recordingCallbackUrl),
    bridgeTwimlPresent: Boolean(payload?.preview?.bridgeTwiml),
  };
}

function summarizeSmsDryRun(payload) {
  return {
    ...summarizeJson(payload),
    fromNumberPresent: Boolean(payload?.preview?.fromNumber),
    toNumberAccepted: Boolean(payload?.preview?.toNumber),
    bodyEchoPresent: Boolean(payload?.preview?.body),
  };
}

function summarizeInvoiceDryRun(payload) {
  return {
    ...summarizeJson(payload),
    smsRequested: payload?.smsRequested,
    callRequested: payload?.callRequested,
    toConfigured: payload?.toConfigured,
    invoiceReference: payload?.preview?.invoiceReference || null,
    customerPhonePresent: Boolean(payload?.preview?.customerPhone),
    assistantPreferences: payload?.preview?.notifyAssistant || null,
    customerPreferences: payload?.preview?.notifyCustomer || null,
  };
}

function summarizeThumbtack(payload) {
  return {
    ...summarizeJson(payload),
    source: payload?.source || null,
    leadIdPresent: Boolean(payload?.lead?.leadId),
    customerPhoneAccepted: Boolean(payload?.lead?.customerPhone),
    bridgeUrlPresent: Boolean(payload?.preview?.bridgeUrl),
  };
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${hostedApi}${path}`, options);
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch (error) {
    payload = { rawText: text.slice(0, 300) };
  }

  return {
    status: response.status,
    payload,
  };
}

async function postJson(path, body, headers = {}) {
  return fetchJson(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function postForm(path, fields, headers = {}) {
  return fetchJson(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

async function postSignedForm(path, fields, authToken) {
  const url = `${hostedApi}${path}`;

  return postForm(path, fields, {
    "X-Twilio-Signature": buildTwilioSignature(url, fields, authToken),
  });
}

async function createDashboardSession() {
  const cliKeys = maybeReadCliKeys();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    findKey(cliKeys, ["service_role", "service role", "service"]);
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    findKey(cliKeys, ["anon", "publishable"]);

  if (!serviceRoleKey || !anonKey) {
    return {
      ok: false,
      reason:
        "Missing Supabase service-role or anon key locally, and Supabase CLI API-key lookup failed.",
    };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const email = `codex-external-smoke-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Codex-${randomUUID()}-Smoke1!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      purpose: "temporary external integration smoke user",
    },
  });

  if (created.error || !created.data?.user?.id) {
    return {
      ok: false,
      reason: created.error?.message || "Failed to create temporary dashboard auth user.",
    };
  }

  const userId = created.data.user.id;
  const signedIn = await authClient.auth.signInWithPassword({ email, password });

  if (signedIn.error || !signedIn.data?.session?.access_token) {
    await admin.auth.admin.deleteUser(userId);

    return {
      ok: false,
      reason: signedIn.error?.message || "Temporary dashboard auth sign-in failed.",
    };
  }

  return {
    ok: true,
    admin,
    userId,
    accessToken: signedIn.data.session.access_token,
  };
}

async function cleanupDashboardSession(session, evidence) {
  if (!session?.ok || !session.admin || !session.userId) {
    return;
  }

  const deleted = await session.admin.auth.admin.deleteUser(session.userId);
  evidence.cleanup.dashboardAuthUserDeleted = !deleted.error;

  if (deleted.error) {
    evidence.cleanup.dashboardAuthUserDeleteError = deleted.error.message;
  }
}

async function run() {
  const evidence = {
    hostedApi,
    projectRef,
    routeProtection: {},
    dashboardDryRuns: {},
    providerCallbacks: {},
    thumbtack: {},
    blockers: [],
    cleanup: {},
  };

  const noAuthVoiceToken = await fetchJson("/api/twilio/voice-token");
  evidence.routeProtection.voiceTokenNoAuth = {
    status: noAuthVoiceToken.status,
    message: noAuthVoiceToken.payload?.message,
  };

  const invalidVoiceToken = await fetchJson("/api/twilio/voice-token", {
    headers: { Authorization: "Bearer invalid-smoke-token" },
  });
  evidence.routeProtection.voiceTokenInvalidAuth = {
    status: invalidVoiceToken.status,
    message: invalidVoiceToken.payload?.message,
  };

  const noAuthOutboundCall = await postJson("/api/twilio/outbound/calls", {
    customerName: "Smoke Test Customer",
    customerPhone: smokePhone,
    dryRun: true,
  });
  evidence.routeProtection.outboundCallNoAuth = {
    status: noAuthOutboundCall.status,
    message: noAuthOutboundCall.payload?.message,
  };

  const noAuthOutboundSms = await postJson("/api/twilio/outbound/messages", {
    toNumber: smokePhone,
    body: "ASAP smoke test SMS dry-run.",
    dryRun: true,
  });
  evidence.routeProtection.outboundSmsNoAuth = {
    status: noAuthOutboundSms.status,
    message: noAuthOutboundSms.payload?.message,
  };

  const noAuthActiveCalls = await fetchJson("/api/twilio/outbound/calls/active");
  evidence.routeProtection.activeCallsNoAuth = {
    status: noAuthActiveCalls.status,
    message: noAuthActiveCalls.payload?.message,
  };

  const noAuthBrowserCall = await postJson("/api/twilio/browser-call", {
    to: smokePhone,
  });
  evidence.routeProtection.browserCallNoAuth = {
    status: noAuthBrowserCall.status,
    message: noAuthBrowserCall.payload?.message,
  };

  const noAuthBrowserHangup = await postJson("/api/twilio/hangup", {});
  evidence.routeProtection.browserHangupNoAuth = {
    status: noAuthBrowserHangup.status,
    message: noAuthBrowserHangup.payload?.message,
  };

  const noAuthInvoice = await postJson("/api/invoices/send-lumia", {
    dryRun: true,
    invoice: {
      invoiceNumber: "SMOKE-INV-001",
      customerName: "Smoke Test Customer",
      customerPhone: smokePhone,
      totalAmount: 125,
      outstandingBalance: 125,
    },
  });
  evidence.routeProtection.invoiceNoAuth = {
    status: noAuthInvoice.status,
    message: noAuthInvoice.payload?.message,
  };

  const noAuthManualCallLog = await postJson("/api/manual/calls/log", {
    contactType: "customer",
    customerPhone: smokePhone,
    direction: "outbound",
    dryRun: true,
  });
  evidence.routeProtection.manualCallLogNoAuth = {
    status: noAuthManualCallLog.status,
    message: noAuthManualCallLog.payload?.message,
  };

  const noAuthHiringCandidates = await fetchJson("/api/hiring-candidates");
  evidence.routeProtection.hiringCandidatesNoAuth = {
    status: noAuthHiringCandidates.status,
    message: noAuthHiringCandidates.payload?.message,
  };

  const session = await createDashboardSession();

  if (!session.ok) {
    evidence.blockers.push({
      area: "Supabase/API auth",
      missing: ["SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE", "SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY"],
      detail: session.reason,
    });
  } else {
    const authHeader = { Authorization: `Bearer ${session.accessToken}` };

    const voiceToken = await fetchJson("/api/twilio/voice-token", {
      headers: authHeader,
    });
    evidence.dashboardDryRuns.browserVoiceToken = {
      status: voiceToken.status,
      ...summarizeVoiceToken(voiceToken.payload),
    };

    const outboundCall = await postJson(
      "/api/twilio/outbound/calls",
      {
        customerName: "Smoke Test Customer",
        customerPhone: smokePhone,
        dryRun: true,
        triggerSource: "external_integration_smoke",
      },
      authHeader,
    );
    evidence.dashboardDryRuns.outboundCallDryRun = {
      status: outboundCall.status,
      ...summarizeCallDryRun(outboundCall.payload),
    };

    const outboundSms = await postJson(
      "/api/twilio/outbound/messages",
      {
        toNumber: smokePhone,
        body: "ASAP smoke test SMS dry-run.",
        dryRun: true,
        triggerSource: "external_integration_smoke",
        persistCustomerContact: false,
      },
      authHeader,
    );
    evidence.dashboardDryRuns.outboundSmsDryRun = {
      status: outboundSms.status,
      ...summarizeSmsDryRun(outboundSms.payload),
    };

    const invoice = await postJson(
      "/api/invoices/send-lumia",
      {
        dryRun: true,
        invoice: {
          invoiceNumber: "SMOKE-INV-001",
          customerName: "Smoke Test Customer",
          customerPhone: smokePhone,
          totalAmount: 125,
          outstandingBalance: 125,
          invoiceUrl: "https://example.com/invoices/SMOKE-INV-001",
        },
        notifyAssistant: { sms: true, call: true },
        notifyCustomer: { sms: true, call: true },
      },
      authHeader,
    );
    evidence.dashboardDryRuns.invoiceNotificationDryRun = {
      status: invoice.status,
      ...summarizeInvoiceDryRun(invoice.payload),
    };
  }

  const recordingMismatch = await postForm("/api/twilio/recordings/status", {
    AccountSid: "AC00000000000000000000000000000000",
    CallSid: "CAexternalintegrationmismatch",
    RecordingSid: "REexternalintegrationmismatch",
    RecordingStatus: "completed",
  });
  evidence.providerCallbacks.recordingAccountMismatch = {
    status: recordingMismatch.status,
    message: recordingMismatch.payload?.message,
  };

  const browserTwimlMismatch = await postForm("/api/twilio/browser-call/twiml", {
    AccountSid: "AC00000000000000000000000000000000",
    From: "client:asap-crm-browser",
    To: smokePhone,
  });
  evidence.providerCallbacks.browserTwimlAccountMismatch = {
    status: browserTwimlMismatch.status,
    message: browserTwimlMismatch.payload?.message,
  };

  const smsMismatch = await postForm("/api/twilio/sms", {
    AccountSid: "AC00000000000000000000000000000000",
    From: smokePhone,
    To: "+15615769819",
    Body: "external integration mismatch smoke",
    MessageSid: "SMexternalintegrationmismatch",
  });
  evidence.providerCallbacks.smsAccountMismatch = {
    status: smsMismatch.status,
    message: smsMismatch.payload?.message,
  };

  const noSecretThumbtack = await postJson("/api/thumbtack/lead", {
    event: "lead.created",
    lead: {
      id: "tt-lead-smoke-no-secret",
      name: "Smoke Test Customer",
      phone: smokePhone,
      category: "Appliance repair",
      city: "Miami",
      state: "FL",
    },
    dryRun: true,
  });
  evidence.thumbtack.noSecret = {
    status: noSecretThumbtack.status,
    message: noSecretThumbtack.payload?.message,
  };

  const invalidSecretThumbtack = await postJson(
    "/api/thumbtack/lead",
    {
      event: "lead.created",
      lead: {
        id: "tt-lead-smoke-invalid-secret",
        name: "Smoke Test Customer",
        phone: smokePhone,
        category: "Appliance repair",
        city: "Miami",
        state: "FL",
      },
      customer: {
        name: "Smoke Test Customer",
        phone: smokePhone,
      },
      dryRun: true,
    },
    { Authorization: "Bearer invalid-thumbtack-smoke-secret" },
  );
  evidence.thumbtack.invalidSecret = {
    status: invalidSecretThumbtack.status,
    message: invalidSecretThumbtack.payload?.message,
  };

  const thumbtackSecret = readFirstEnv(["THUMBTACK_WEBHOOK_SECRET"]);

  if (thumbtackSecret.value) {
    const validThumbtack = await postJson(
      "/api/thumbtack/lead",
      {
        event: "lead.created",
        lead: {
          id: `tt-lead-smoke-${Date.now()}`,
          name: "Smoke Test Customer",
          phone: smokePhone,
          category: "Appliance repair",
          city: "Miami",
          state: "FL",
        },
        customer: {
          name: "Smoke Test Customer",
          phone: smokePhone,
        },
        dryRun: true,
      },
      { Authorization: `Bearer ${thumbtackSecret.value}` },
    );
    evidence.thumbtack.validDryRun = {
      status: validThumbtack.status,
      ...summarizeThumbtack(validThumbtack.payload),
    };
  } else {
    evidence.blockers.push({
      area: "Thumbtack/LeadWinner valid dry-run",
      missing: ["THUMBTACK_WEBHOOK_SECRET local value"],
      detail:
        "The hosted secret name is configured, but Supabase does not reveal secret values. Provide the value locally to test a valid provider payload.",
    });
  }

  const accountSid = readFirstEnv(["SIGNALWIRE_PROJECT_ID", "TWILIO_ACCOUNT_SID"]);
  const authToken = readFirstEnv(["SIGNALWIRE_API_TOKEN", "TWILIO_AUTH_TOKEN"]);

  if (accountSid.value && authToken.value && session.ok) {
    const recordingSid = `REcodexexternal${Date.now()}`;
    const validRecording = await postSignedForm(
      "/api/twilio/recordings/status",
      {
        AccountSid: accountSid.value,
        CallSid: `CAcodexexternal${Date.now()}`,
        RecordingSid: recordingSid,
        RecordingStatus: "processing",
        RecordingDuration: "0",
        RecordingChannels: "2",
      },
      authToken.value,
    );
    evidence.providerCallbacks.validRecordingCallback = {
      status: validRecording.status,
      ...summarizeJson(validRecording.payload),
      reason: validRecording.payload?.reason || null,
      recordStored: Boolean(validRecording.payload?.record?.recording_id),
    };

    const deletedRecording = await session.admin
      .from("twilio_voice_recordings")
      .delete({ count: "exact" })
      .eq("provider_recording_sid", recordingSid);
    evidence.cleanup.recordingSmokeRowsDeleted = deletedRecording.count ?? 0;

    const validBrowserTwiml = await postSignedForm(
      "/api/twilio/browser-call/twiml",
      {
        AccountSid: accountSid.value,
        From: "client:asap-crm-browser",
        To: smokePhone,
      },
      authToken.value,
    );
    evidence.providerCallbacks.validBrowserTwiml = {
      status: validBrowserTwiml.status,
      twimlReturned: typeof validBrowserTwiml.payload?.rawText === "string" &&
        validBrowserTwiml.payload.rawText.includes("<Response>"),
    };
  } else {
    evidence.blockers.push({
      area: "Valid provider webhook signature success path",
      missing: ["SIGNALWIRE_PROJECT_ID or TWILIO_ACCOUNT_SID local value", "SIGNALWIRE_API_TOKEN or TWILIO_AUTH_TOKEN local value"],
      detail:
        "The hosted secret names are configured, but valid webhook signatures require the local provider account/token values.",
    });
  }

  await cleanupDashboardSession(session, evidence);
  console.log(JSON.stringify(evidence, null, 2));

  const failedDashboardDryRuns = Object.entries(evidence.dashboardDryRuns).filter(([, result]) => {
    return result.status >= 400 || result.ok === false;
  });

  if (failedDashboardDryRuns.length > 0) {
    process.exitCode = 1;
  }
}

await run();
