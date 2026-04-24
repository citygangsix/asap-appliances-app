import {
  getServerSupabaseClient,
  getTwilioServerConfig,
} from "./supabaseAdmin.js";
import {
  mapCommunicationDraftToInsert,
  mapCommunicationStatusPatchToUpdate,
} from "../../src/integrations/supabase/mappers/communications.js";
import {
  runCreateCommunicationMutation,
  runUpdateCommunicationMutation,
} from "../../src/integrations/supabase/mutations/communications.js";
import { sendOutboundSms } from "./twilioOutboundNotifications.js";
import {
  buildCooldownUntil,
  buildMissedCallSmsBody,
  createOutboundContactAttempt,
  findCustomerOutreachProfile,
  findLatestAutomatedCallAttemptByNumber,
  findLatestOutboundContactAttempt,
  isAutomatedTrigger,
  isCustomerOptedOut,
  normalizePhoneNumber,
  setCustomerAutoContactCooldown,
  updateOutboundContactAttempt,
} from "./customerOutreach.js";

const CLICK_TO_CALL_STATUS_EVENTS = ["initiated", "ringing", "answered", "completed"];
const MISSED_CALL_SMS_ATTEMPT_SUFFIX = "missed_followup_sms";
const pendingMissedCallSmsFollowups = new Map();

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildTwilioAuthHeader(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function parseTwilioResponse(response) {
  const responseText = await response.text();
  let responseJson = null;

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch (error) {
      responseJson = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Twilio rejected the server credentials. Update TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SECRET in .env.server.local, then restart the webhook server.",
      );
    }

    throw new Error(
      responseJson?.message || `Twilio request failed with status ${response.status}.`,
    );
  }

  return responseJson;
}

function buildWebhookUrl(baseUrl, pathname) {
  return `${baseUrl}${pathname}`;
}

function buildClickToCallBridgeUrl(config, payload) {
  const params = new URLSearchParams();
  const customerName = toNullableString(payload.customerName);
  const customerPhone = toNullableString(payload.customerPhone);
  const customerId = toNullableString(payload.customerId);
  const jobId = toNullableString(payload.jobId);
  const businessPhoneNumber = toNullableString(payload.businessPhoneNumber);

  if (customerName) {
    params.set("customerName", customerName);
  }

  if (customerPhone) {
    params.set("customerPhone", customerPhone);
  }

  if (customerId) {
    params.set("customerId", customerId);
  }

  if (jobId) {
    params.set("jobId", jobId);
  }

  if (businessPhoneNumber) {
    params.set("businessPhoneNumber", businessPhoneNumber);
  }

  return `${buildWebhookUrl(config.webhookBaseUrl, "/api/twilio/outbound/bridge")}?${params.toString()}`;
}

function buildClickToCallStatusUrl(config) {
  return buildWebhookUrl(config.webhookBaseUrl, "/api/twilio/outbound/calls/status");
}

function buildClickToCallRecordingUrl(config) {
  return buildWebhookUrl(config.webhookBaseUrl, "/api/twilio/recordings/status");
}

function resolveTriggerSource(payload) {
  return toNullableString(payload.triggerSource) || "manual_ui";
}

function formatCallStatus(callStatus) {
  return (callStatus || "initiated").replace(/-/g, " ");
}

function buildOutboundCallPreview(callStatus, durationSeconds) {
  const normalizedStatus = formatCallStatus(callStatus);

  if (durationSeconds) {
    return `Outbound call ${normalizedStatus}. Duration ${durationSeconds} seconds.`;
  }

  return `Outbound call ${normalizedStatus}.`;
}

function buildOutboundSmsPreview(body) {
  const trimmed = String(body ?? "").trim();

  if (!trimmed) {
    return "Outbound follow-up SMS sent.";
  }

  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function mapOutboundCallStatusToCommunicationStatus(callStatus) {
  if (["busy", "no-answer", "failed", "canceled"].includes(callStatus)) {
    return "awaiting_callback";
  }

  return "unresolved";
}

function isCustomerLegPayload(payload) {
  return Boolean(toNullableString(payload.ParentCallSid));
}

function isTerminalCallStatus(callStatus) {
  return ["completed", "busy", "no-answer", "failed", "canceled"].includes(callStatus);
}

function shouldSendMissedCallSms(payload) {
  const callStatus = String(payload.CallStatus || "").toLowerCase();
  return isCustomerLegPayload(payload) && ["busy", "no-answer", "failed", "canceled"].includes(callStatus);
}

function mapAttemptOutcomeFromStatus(payload) {
  const callStatus = String(payload.CallStatus || "").toLowerCase() || "unknown";
  const legPrefix = isCustomerLegPayload(payload) ? "customer" : "assistant";

  switch (callStatus) {
    case "initiated":
      return `${legPrefix}_initiated`;
    case "ringing":
      return `${legPrefix}_ringing`;
    case "answered":
    case "in-progress":
      return `${legPrefix}_answered`;
    case "completed":
      return legPrefix === "customer" ? "customer_connected" : "assistant_completed";
    case "busy":
      return `${legPrefix}_busy`;
    case "no-answer":
      return `${legPrefix}_no_answer`;
    case "failed":
      return `${legPrefix}_failed`;
    case "canceled":
      return `${legPrefix}_canceled`;
    default:
      return `${legPrefix}_${callStatus}`;
  }
}

function buildFollowUpPolicyPreview(config, triggerSource) {
  return {
    triggerSource,
    liveAgentBridgeOnly: true,
    maxLiveCustomerCallsPerTrigger: 1,
    additionalAutoCallAttempts: 0,
    missedCallSmsDelaySeconds: config.clickToCallMissedSmsDelaySeconds,
    autoCooldownHours: config.clickToCallAutoCooldownHours,
  };
}

async function findCommunicationByCallSid(client, callSid) {
  if (!callSid) {
    return null;
  }

  const result = await client
    .from("communications")
    .select("*")
    .eq("provider_call_sid", callSid)
    .maybeSingle();

  if (result.error) {
    throw new Error(`communications.lookupByProviderCallSid: ${result.error.message}`);
  }

  return result.data || null;
}

async function createOutboundCallCommunicationLog(config, payload, providerCallSid) {
  const customerId = toNullableString(payload.customerId);
  const businessPhoneNumber =
    normalizePhoneNumber(toNullableString(payload.businessPhoneNumber)) || config.phoneNumber;

  if (!customerId || !providerCallSid) {
    return null;
  }

  const client = getServerSupabaseClient();

  return runCreateCommunicationMutation(
    client,
    mapCommunicationDraftToInsert({
      customerId,
      linkedJobId: toNullableString(payload.jobId),
      invoiceId: null,
      communicationChannel: "call",
      direction: "outbound",
      communicationStatus: "unresolved",
      previewText: "Outbound live call initiated. Waiting for customer connection.",
      transcriptText: null,
      callHighlights: null,
      callSummarySections: null,
      transcriptionStatus: "pending",
      transcriptionError: null,
      extractedEventLabel: null,
      occurredAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      fromNumber: businessPhoneNumber,
      toNumber: toNullableString(payload.customerPhone),
      providerName: "twilio",
      providerMessageSid: null,
      providerCallSid,
    }),
  );
}

async function createOutboundSmsCommunicationLog(client, config, communication, body, providerMessageSid) {
  if (!communication?.customer_id || !communication?.to_number) {
    return null;
  }

  return runCreateCommunicationMutation(
    client,
    mapCommunicationDraftToInsert({
      customerId: communication.customer_id,
      linkedJobId: communication.job_id || null,
      invoiceId: communication.invoice_id || null,
      communicationChannel: "text",
      direction: "outbound",
      communicationStatus: "awaiting_callback",
      previewText: buildOutboundSmsPreview(body),
      transcriptText: body,
      callHighlights: null,
      callSummarySections: null,
      transcriptionStatus: null,
      transcriptionError: null,
      extractedEventLabel: "Missed-call follow-up text sent.",
      occurredAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      fromNumber: config.phoneNumber,
      toNumber: communication.to_number,
      providerName: "twilio",
      providerMessageSid,
      providerCallSid: null,
    }),
  );
}

async function verifyWebhookBaseUrlHealth(config) {
  const healthUrl = buildWebhookUrl(config.webhookBaseUrl, "/health");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        healthUrl,
        detail: `Health check returned HTTP ${response.status}.`,
      };
    }

    const payload = await response.json().catch(() => null);

    if (payload?.ok !== true) {
      return {
        ok: false,
        healthUrl,
        detail: "Health check did not return the expected JSON payload.",
      };
    }

    return {
      ok: true,
      healthUrl,
    };
  } catch (error) {
    const detail =
      error?.name === "AbortError"
        ? "Health check timed out after 5 seconds."
        : error?.message || "Health check failed.";

    return {
      ok: false,
      healthUrl,
      detail,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildDryRunBridgeTwiml(config, payload) {
  return buildClickToCallBridgeTwiml(config, {
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    businessPhoneNumber: payload.businessPhoneNumber,
  });
}

function resolveManagedBusinessPhoneNumber(config, requestedPhoneNumber) {
  const managedPhoneNumbers =
    Array.isArray(config.managedPhoneNumbers) && config.managedPhoneNumbers.length
      ? config.managedPhoneNumbers
      : [config.phoneNumber].filter(Boolean);
  const normalizedRequestedPhone =
    normalizePhoneNumber(toNullableString(requestedPhoneNumber)) || toNullableString(requestedPhoneNumber);

  if (!normalizedRequestedPhone) {
    return {
      ok: true,
      phoneNumber: config.phoneNumber,
      managedPhoneNumbers,
    };
  }

  const matchedPhoneNumber = managedPhoneNumbers.find((phoneNumber) => {
    return normalizePhoneNumber(phoneNumber) === normalizePhoneNumber(normalizedRequestedPhone);
  });

  if (!matchedPhoneNumber) {
    return {
      ok: false,
      message:
        "businessPhoneNumber must match TWILIO_PHONE_NUMBER or one of TWILIO_MANAGED_PHONE_NUMBERS.",
      managedPhoneNumbers,
    };
  }

  return {
    ok: true,
    phoneNumber: matchedPhoneNumber,
    managedPhoneNumbers,
  };
}

async function placeTwilioApiCall({
  accountSid,
  authToken,
  fromNumber,
  toNumber,
  url,
  statusCallback,
}) {
  const body = new URLSearchParams({
    From: fromNumber,
    To: toNumber,
    Url: url,
    Method: "POST",
    StatusCallback: statusCallback,
    StatusCallbackMethod: "POST",
  });

  for (const event of CLICK_TO_CALL_STATUS_EVENTS) {
    body.append("StatusCallbackEvent", event);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: buildTwilioAuthHeader(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseTwilioResponse(response);
}

async function ensureCallAttemptLog(client, communication, payload) {
  let attempt = communication
    ? await findLatestOutboundContactAttempt(client, {
        communicationId: communication.communication_id,
        attemptChannel: "call",
      })
    : null;

  if (attempt || !communication) {
    return attempt;
  }

  return createOutboundContactAttempt(client, {
    customerId: communication.customer_id,
    communicationId: communication.communication_id,
    triggerSource: "unknown",
    isAutomated: false,
    attemptChannel: "call",
    customerNumber:
      normalizePhoneNumber(communication.to_number || payload.To || communication.from_number) ||
      communication.to_number ||
      payload.To ||
      communication.from_number,
    providerCallSid: payload.CallSid || null,
    providerParentCallSid: payload.ParentCallSid || null,
    outcome: mapAttemptOutcomeFromStatus(payload),
    requestedAt: communication.started_at || new Date().toISOString(),
    completedAt: isTerminalCallStatus(payload.CallStatus) ? new Date().toISOString() : null,
    rawPayload: payload,
  });
}

async function scheduleMissedCallSmsFollowup({ communication, triggerSource }) {
  if (!communication?.communication_id || !communication?.to_number) {
    return;
  }

  const config = getTwilioServerConfig();
  const followupKey = communication.communication_id;

  if (pendingMissedCallSmsFollowups.has(followupKey)) {
    return;
  }

  const timeoutId = setTimeout(async () => {
    pendingMissedCallSmsFollowups.delete(followupKey);
    const client = getServerSupabaseClient();
    const customerLookup = await findCustomerOutreachProfile(client, {
      customerId: communication.customer_id,
      customerPhone: communication.to_number,
    });
    const customerProfile = customerLookup.customer;

    if (isCustomerOptedOut(customerProfile)) {
      await createOutboundContactAttempt(client, {
        customerId: communication.customer_id,
        communicationId: communication.communication_id,
        triggerSource: `${triggerSource}:${MISSED_CALL_SMS_ATTEMPT_SUFFIX}`,
        isAutomated: isAutomatedTrigger(triggerSource),
        attemptChannel: "text",
        customerNumber: normalizePhoneNumber(communication.to_number) || communication.to_number,
        outcome: "blocked_opt_out",
        outcomeDetail: "Follow-up SMS skipped because the customer is opted out.",
        completedAt: new Date().toISOString(),
        rawPayload: {
          relatedCommunicationId: communication.communication_id,
        },
      });
      return;
    }

    const smsBody = buildMissedCallSmsBody(
      customerProfile?.name,
      config.clickToCallMissedSmsBody,
    );

    try {
      const smsResult = await sendOutboundSms({
        toNumber: communication.to_number,
        body: smsBody,
        dryRun: false,
        label: "click-to-call-missed-followup",
      });
      const smsCommunication = await createOutboundSmsCommunicationLog(
        client,
        config,
        communication,
        smsBody,
        smsResult.providerMessageSid || null,
      );

      await createOutboundContactAttempt(client, {
        customerId: communication.customer_id,
        communicationId: smsCommunication?.communication_id || communication.communication_id,
        triggerSource: `${triggerSource}:${MISSED_CALL_SMS_ATTEMPT_SUFFIX}`,
        isAutomated: isAutomatedTrigger(triggerSource),
        attemptChannel: "text",
        customerNumber: normalizePhoneNumber(communication.to_number) || communication.to_number,
        providerMessageSid: smsResult.providerMessageSid || null,
        outcome: "sent_after_unanswered_call",
        completedAt: new Date().toISOString(),
        rawPayload: {
          relatedCallCommunicationId: communication.communication_id,
          smsBody,
        },
      });
    } catch (error) {
      await createOutboundContactAttempt(client, {
        customerId: communication.customer_id,
        communicationId: communication.communication_id,
        triggerSource: `${triggerSource}:${MISSED_CALL_SMS_ATTEMPT_SUFFIX}`,
        isAutomated: isAutomatedTrigger(triggerSource),
        attemptChannel: "text",
        customerNumber: normalizePhoneNumber(communication.to_number) || communication.to_number,
        outcome: "failed",
        outcomeDetail: error?.message || "Missed-call follow-up SMS failed.",
        completedAt: new Date().toISOString(),
        rawPayload: {
          relatedCallCommunicationId: communication.communication_id,
          attemptedBody: smsBody,
        },
      });
    }
  }, config.clickToCallMissedSmsDelaySeconds * 1000);

  pendingMissedCallSmsFollowups.set(followupKey, timeoutId);
}

export function buildClickToCallBridgeTwiml(config, payload = {}) {
  const customerName = toNullableString(payload.customerName) || "the customer";
  const customerPhone = toNullableString(payload.customerPhone);
  const resolvedBusinessPhoneNumber = resolveManagedBusinessPhoneNumber(
    config,
    payload.businessPhoneNumber,
  );
  const callerId = resolvedBusinessPhoneNumber.phoneNumber || config.phoneNumber;

  if (!customerPhone) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">The customer phone number is missing.</Say><Hangup/></Response>`;
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Dial answerOnBridge="true" callerId="${escapeXml(callerId)}" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(
      buildClickToCallRecordingUrl(config),
    )}" recordingStatusCallbackMethod="POST">`,
    `<Number statusCallback="${escapeXml(
      buildClickToCallStatusUrl(config),
    )}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(
      customerPhone,
    )}</Number>`,
    "</Dial>",
    `<Say voice="alice">The call with ${escapeXml(customerName)} has ended.</Say>`,
    "</Response>",
  ].join("");
}

export async function requestClickToCall(payload = {}) {
  const config = getTwilioServerConfig();
  const customerPhone = toNullableString(payload.customerPhone);
  const normalizedCustomerPhone = normalizePhoneNumber(customerPhone) || customerPhone;
  const customerName = toNullableString(payload.customerName) || "customer";
  const requestedAgentPhone =
    normalizePhoneNumber(toNullableString(payload.agentPhone)) || toNullableString(payload.agentPhone);
  const agentPhone = requestedAgentPhone || toNullableString(config.clickToCallAgentNumber);
  const dryRun = payload.dryRun === true;
  const triggerSource = resolveTriggerSource(payload);
  const isAutomated = isAutomatedTrigger(triggerSource, payload.manualRetry === true);
  const requestedBusinessPhone = toNullableString(payload.businessPhoneNumber);
  const resolvedBusinessPhoneNumber = resolveManagedBusinessPhoneNumber(config, requestedBusinessPhone);
  const businessPhoneNumber = resolvedBusinessPhoneNumber.phoneNumber || config.phoneNumber;

  if (!customerPhone) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: "Click-to-call requires a customer phone number.",
    };
  }

  if (!agentPhone) {
    return {
      ok: false,
      status: 500,
      dryRun,
      message:
        "TWILIO_CLICK_TO_CALL_AGENT_NUMBER, ASSISTANT_OFFICE_PHONE_NUMBER, or TWILIO_VOICE_FORWARD_TO must be configured on the server.",
    };
  }

  if (!resolvedBusinessPhoneNumber.ok) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: resolvedBusinessPhoneNumber.message,
      managedPhoneNumbers: resolvedBusinessPhoneNumber.managedPhoneNumbers,
    };
  }

  const bridgeUrl = buildClickToCallBridgeUrl(config, payload);
  const statusCallbackUrl = buildClickToCallStatusUrl(config);
  const recordingCallbackUrl = buildClickToCallRecordingUrl(config);
  const followUpPolicy = buildFollowUpPolicyPreview(config, triggerSource);

  if (dryRun) {
    return {
      ok: true,
      status: 200,
      dryRun: true,
      preview: {
        agentPhone,
        businessPhoneNumber,
        customerPhone,
        customerName,
        bridgeUrl,
        statusCallbackUrl,
        recordingCallbackUrl,
        bridgeTwiml: buildDryRunBridgeTwiml(config, payload),
        followUpPolicy,
      },
      message: "Dry run prepared click-to-call request.",
    };
  }

  const client = getServerSupabaseClient();
  const customerLookup = await findCustomerOutreachProfile(client, {
    customerId: toNullableString(payload.customerId),
    customerPhone,
  });
  const customerProfile = customerLookup.customer;
  const resolvedCustomerId = toNullableString(payload.customerId) || customerProfile?.customer_id || null;

  if (isCustomerOptedOut(customerProfile)) {
    await createOutboundContactAttempt(client, {
      customerId: resolvedCustomerId,
      communicationId: null,
      triggerSource,
      isAutomated,
      attemptChannel: "call",
      customerNumber: normalizedCustomerPhone,
      outcome: "blocked_opt_out",
      outcomeDetail: "Call request blocked because the customer has opted out.",
      completedAt: new Date().toISOString(),
      rawPayload: payload,
    });

    return {
      ok: false,
      status: 409,
      dryRun: false,
      message: "This customer has opted out, so no call or text was sent.",
    };
  }

  if (isAutomated) {
    const cooldownCutoff = customerProfile?.auto_contact_cooldown_until
      ? new Date(customerProfile.auto_contact_cooldown_until)
      : null;
    const latestAutomatedAttempt = await findLatestAutomatedCallAttemptByNumber(
      client,
      normalizedCustomerPhone,
    );
    const fallbackCooldownCutoff = latestAutomatedAttempt?.cooldown_applied_until
      ? new Date(latestAutomatedAttempt.cooldown_applied_until)
      : null;
    const now = new Date();
    const activeCooldownUntil =
      cooldownCutoff && cooldownCutoff > now
        ? customerProfile.auto_contact_cooldown_until
        : fallbackCooldownCutoff && fallbackCooldownCutoff > now
          ? latestAutomatedAttempt.cooldown_applied_until
          : null;

    if (activeCooldownUntil) {
      await createOutboundContactAttempt(client, {
        customerId: resolvedCustomerId,
        communicationId: null,
        triggerSource,
        isAutomated: true,
        attemptChannel: "call",
        customerNumber: normalizedCustomerPhone,
        outcome: "blocked_cooldown",
        outcomeDetail: `Automatic calling is cooling down until ${activeCooldownUntil}.`,
        cooldownAppliedUntil: activeCooldownUntil,
        completedAt: new Date().toISOString(),
        rawPayload: payload,
      });

      return {
        ok: false,
        status: 429,
        dryRun: false,
        message: `Automatic calling is cooling down for this customer until ${activeCooldownUntil}.`,
      };
    }
  }

  const webhookHealth = await verifyWebhookBaseUrlHealth(config);

  if (!webhookHealth.ok) {
    return {
      ok: false,
      status: 503,
      dryRun: false,
      agentPhone,
      customerPhone,
      message: `TWILIO_WEBHOOK_BASE_URL is not serving the webhook server. Checked ${webhookHealth.healthUrl}. ${webhookHealth.detail} Restart the tunnel, update TWILIO_WEBHOOK_BASE_URL, and restart the webhook server before using click-to-call.`,
    };
  }

  const twilioResponse = await placeTwilioApiCall({
    accountSid: config.accountSid,
    authToken: config.authToken,
    fromNumber: businessPhoneNumber,
    toNumber: agentPhone,
    url: bridgeUrl,
    statusCallback: statusCallbackUrl,
  });

  let communicationRecord = null;

  try {
    communicationRecord = await createOutboundCallCommunicationLog(
      config,
      {
        ...payload,
        customerId: resolvedCustomerId,
        businessPhoneNumber,
      },
      twilioResponse?.sid || null,
    );
  } catch (error) {
    console.error("Click-to-call was placed but the outbound communication log failed.", error);
  }

  const cooldownAppliedUntil = isAutomated
    ? buildCooldownUntil(config.clickToCallAutoCooldownHours)
    : null;

  if (isAutomated && customerProfile?.customer_id && cooldownAppliedUntil) {
    try {
      await setCustomerAutoContactCooldown(
        client,
        customerProfile.customer_id,
        cooldownAppliedUntil,
      );
    } catch (error) {
      console.error("Click-to-call cooldown update failed.", error);
    }
  }

  try {
    await createOutboundContactAttempt(client, {
      customerId: resolvedCustomerId,
      communicationId: communicationRecord?.communication_id || null,
      triggerSource,
      isAutomated,
      attemptChannel: "call",
      customerNumber: normalizedCustomerPhone,
      providerCallSid: twilioResponse?.sid || null,
      outcome: "assistant_initiated",
      cooldownAppliedUntil,
      rawPayload: payload,
    });
  } catch (error) {
    console.error("Click-to-call attempt log failed.", error);
  }

  return {
    ok: true,
    status: 200,
    dryRun: false,
    providerCallSid: twilioResponse?.sid || null,
    agentPhone,
    businessPhoneNumber,
    customerPhone,
    followUpPolicy,
    message: `Twilio is calling ${agentPhone} and will connect ${customerName} once you answer.`,
  };
}

export async function handleClickToCallStatusCallback(payload = {}) {
  try {
    const client = getServerSupabaseClient();
    const existingCommunication =
      (await findCommunicationByCallSid(client, payload.CallSid)) ||
      (await findCommunicationByCallSid(client, payload.ParentCallSid));

    if (existingCommunication) {
      await runUpdateCommunicationMutation(
        client,
        existingCommunication.communication_id,
        mapCommunicationStatusPatchToUpdate({
          communicationStatus: mapOutboundCallStatusToCommunicationStatus(payload.CallStatus),
          previewText: buildOutboundCallPreview(payload.CallStatus, payload.CallDuration),
          linkedJobId: existingCommunication.job_id,
          invoiceId: existingCommunication.invoice_id,
          transcriptText: existingCommunication.transcript_text,
          callHighlights: existingCommunication.call_highlights,
          transcriptionStatus: existingCommunication.transcription_status,
          transcriptionError: existingCommunication.transcription_error,
          extractedEventLabel: existingCommunication.extracted_event_summary,
          startedAt: existingCommunication.started_at || new Date().toISOString(),
          endedAt:
            isTerminalCallStatus(payload.CallStatus)
              ? new Date().toISOString()
              : existingCommunication.ended_at,
        }),
      );

      const latestAttempt =
        (await ensureCallAttemptLog(client, existingCommunication, payload)) ||
        (await findLatestOutboundContactAttempt(client, {
          communicationId: existingCommunication.communication_id,
          attemptChannel: "call",
        }));

      if (latestAttempt) {
        await updateOutboundContactAttempt(client, latestAttempt.attempt_id, {
          providerCallSid:
            isCustomerLegPayload(payload) && payload.CallSid
              ? payload.CallSid
              : latestAttempt.provider_call_sid || payload.CallSid || null,
          providerParentCallSid:
            isCustomerLegPayload(payload) && payload.ParentCallSid
              ? payload.ParentCallSid
              : latestAttempt.provider_parent_call_sid || null,
          outcome: mapAttemptOutcomeFromStatus(payload),
          completedAt: isTerminalCallStatus(payload.CallStatus) ? new Date().toISOString() : undefined,
          rawPayload: payload,
        });
      }

      if (shouldSendMissedCallSms(payload)) {
        const attemptWithTrigger =
          latestAttempt ||
          (await findLatestOutboundContactAttempt(client, {
            communicationId: existingCommunication.communication_id,
            attemptChannel: "call",
          }));
        await scheduleMissedCallSmsFollowup({
          communication: existingCommunication,
          triggerSource: attemptWithTrigger?.trigger_source || "unknown",
        });
      }
    }
  } catch (error) {
    console.error("Click-to-call status callback failed to sync communication state.", error);
  }

  console.log("[twilio-click-to-call:status]", {
    callSid: payload.CallSid || null,
    parentCallSid: payload.ParentCallSid || null,
    callStatus: payload.CallStatus || null,
    direction: payload.Direction || null,
    from: payload.From || null,
    to: payload.To || null,
  });

  return {
    ok: true,
    status: 200,
    message: "Click-to-call status callback accepted.",
  };
}
