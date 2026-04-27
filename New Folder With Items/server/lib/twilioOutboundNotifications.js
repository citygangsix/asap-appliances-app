import { getServerSupabaseClient, getTwilioServerConfig } from "./supabaseAdmin.js";

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toBoolean(value, fallback = false) {
  return value === undefined ? fallback : value === true;
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

function buildTwimlSayResponse(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${escapeXml(message)}</Say></Response>`;
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

async function sendTwilioSms({ accountSid, authToken, fromNumber, toNumber, body }) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: buildTwilioAuthHeader(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: body,
    }),
  });

  return parseTwilioResponse(response);
}

async function placeTwilioCall({ accountSid, authToken, fromNumber, toNumber, message }) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: buildTwilioAuthHeader(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Twiml: buildTwimlSayResponse(message),
    }),
  });

  return parseTwilioResponse(response);
}

export async function sendOutboundSms({ toNumber, body, dryRun = false, label = "sms" }) {
  const config = getTwilioServerConfig();
  const destination = toNullableString(toNumber);

  if (!destination) {
    return {
      ok: false,
      channel: "sms",
      label,
      dryRun,
      skipped: true,
      message: "Destination phone number is missing.",
    };
  }

  if (dryRun) {
    console.log("[outbound-sms][dry-run]", { label, toNumber: destination, body });

    return {
      ok: true,
      channel: "sms",
      label,
      dryRun: true,
      skipped: false,
      smsRequested: false,
      preview: {
        fromNumber: config.phoneNumber,
        toNumber: destination,
        body,
      },
      message: "Dry run prepared outbound SMS.",
    };
  }

  const twilioResponse = await sendTwilioSms({
    accountSid: config.accountSid,
    authToken: config.authToken,
    fromNumber: config.phoneNumber,
    toNumber: destination,
    body,
  });

  return {
    ok: true,
    channel: "sms",
    label,
    dryRun: false,
    skipped: false,
    smsRequested: true,
    providerMessageSid: twilioResponse?.sid || null,
    message: "Outbound SMS sent.",
  };
}

export async function sendOutboundCall({ toNumber, message, dryRun = false, label = "call" }) {
  const config = getTwilioServerConfig();
  const destination = toNullableString(toNumber);

  if (!destination) {
    return {
      ok: false,
      channel: "call",
      label,
      dryRun,
      skipped: true,
      message: "Destination phone number is missing.",
    };
  }

  if (dryRun) {
    console.log("[outbound-call][dry-run]", { label, toNumber: destination, message });

    return {
      ok: true,
      channel: "call",
      label,
      dryRun: true,
      skipped: false,
      callRequested: false,
      preview: {
        fromNumber: config.phoneNumber,
        toNumber: destination,
        message,
        twiml: buildTwimlSayResponse(message),
      },
      message: "Dry run prepared outbound voice call.",
    };
  }

  const twilioResponse = await placeTwilioCall({
    accountSid: config.accountSid,
    authToken: config.authToken,
    fromNumber: config.phoneNumber,
    toNumber: destination,
    message,
  });

  return {
    ok: true,
    channel: "call",
    label,
    dryRun: false,
    skipped: false,
    callRequested: true,
    providerCallSid: twilioResponse?.sid || null,
    message: "Outbound voice call placed.",
  };
}

function buildDispatchEtaLabel({ etaWindowText, etaAt }) {
  const label = toNullableString(etaWindowText);

  if (label) {
    return label;
  }

  if (!etaAt) {
    return "an updated ETA";
  }

  const etaDate = new Date(etaAt);

  if (Number.isNaN(etaDate.getTime())) {
    return "an updated ETA";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(etaDate);
}

export async function loadDispatchNotificationContext(jobId) {
  const client = getServerSupabaseClient();
  const result = await client
    .from("jobs")
    .select(`
      job_id,
      service_address,
      issue_summary,
      eta_at,
      eta_window_text,
      customer:customers!jobs_customer_id_fkey(
        customer_id,
        name,
        primary_phone,
        secondary_phone
      ),
      technician:technicians!jobs_tech_id_fkey(
        tech_id,
        name,
        primary_phone
      )
    `)
    .eq("job_id", jobId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`dispatch.notificationContext: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error("Dispatch notification job was not found.");
  }

  return result.data;
}

function buildDispatchSmsBody({ audience, job, etaLabel }) {
  if (audience === "technician") {
    return `ASAP dispatch update: ${job.customer?.name || "customer"} at ${job.service_address || "the service address"} is now set for ${etaLabel}. Job ${job.job_id}.`;
  }

  return `ASAP update: your technician for ${job.issue_summary || "your service visit"} is now expected ${etaLabel}. Reply to this text if you need the office.`;
}

function buildDispatchCallMessage({ audience, job, etaLabel }) {
  if (audience === "technician") {
    return `Dispatch update. ${job.customer?.name || "Your customer"} is now set for ${etaLabel}. Check your phone for the address and update.`;
  }

  return `Hello, this is ASAP Appliances with an update. Your technician is now expected ${etaLabel}. Please check your text messages for the latest details.`;
}

function buildDispatchTargetPlans(payload, job) {
  const notifyTechnician = payload.notifyTechnician || {};
  const notifyCustomer = payload.notifyCustomer || {};

  return [
    {
      audience: "technician",
      enabled: toBoolean(notifyTechnician.sms) || toBoolean(notifyTechnician.call),
      phoneNumber: toNullableString(job.technician?.primary_phone),
      sms: toBoolean(notifyTechnician.sms),
      call: toBoolean(notifyTechnician.call),
      name: toNullableString(job.technician?.name) || "technician",
    },
    {
      audience: "customer",
      enabled: toBoolean(notifyCustomer.sms) || toBoolean(notifyCustomer.call),
      phoneNumber:
        toNullableString(job.customer?.primary_phone) || toNullableString(job.customer?.secondary_phone),
      sms: toBoolean(notifyCustomer.sms),
      call: toBoolean(notifyCustomer.call),
      name: toNullableString(job.customer?.name) || "customer",
    },
  ].filter((plan) => plan.enabled);
}

export async function notifyDispatchEtaUpdate(payload = {}) {
  const jobId = toNullableString(payload.jobId);
  const dryRun = payload.dryRun === true;

  if (!jobId) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: "Dispatch notification payload must include jobId.",
    };
  }

  const job = await loadDispatchNotificationContext(jobId);
  const etaLabel = buildDispatchEtaLabel({
    etaWindowText: payload.etaWindowText || job.eta_window_text,
    etaAt: payload.etaAt || job.eta_at,
  });
  const targetPlans = buildDispatchTargetPlans(payload, job);

  if (targetPlans.length === 0) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: "Select at least one technician or customer notification channel.",
    };
  }

  const results = [];

  for (const target of targetPlans) {
    if (target.sms) {
      try {
        results.push(
          await sendOutboundSms({
            toNumber: target.phoneNumber,
            body: buildDispatchSmsBody({ audience: target.audience, job, etaLabel }),
            dryRun,
            label: `${target.audience}-eta-sms`,
          }),
        );
      } catch (error) {
        results.push({
          ok: false,
          channel: "sms",
          label: `${target.audience}-eta-sms`,
          dryRun,
          skipped: false,
          message: error.message,
        });
      }
    }

    if (target.call) {
      try {
        results.push(
          await sendOutboundCall({
            toNumber: target.phoneNumber,
            message: buildDispatchCallMessage({ audience: target.audience, job, etaLabel }),
            dryRun,
            label: `${target.audience}-eta-call`,
          }),
        );
      } catch (error) {
        results.push({
          ok: false,
          channel: "call",
          label: `${target.audience}-eta-call`,
          dryRun,
          skipped: false,
          message: error.message,
        });
      }
    }
  }

  const succeeded = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);

  return {
    ok: succeeded.length > 0,
    status: succeeded.length > 0 ? 200 : 502,
    dryRun,
    message:
      failed.length > 0 && succeeded.length > 0
        ? `Dispatch ETA notifications partially completed: ${failed.map((result) => result.message).join(" ")}`
        : failed.length > 0
          ? `ETA update saved, but notifications failed: ${failed.map((result) => result.message).join(" ")}`
        : dryRun
          ? "Dry run prepared dispatch ETA notifications."
          : "Dispatch ETA notifications sent.",
    etaLabel,
    results,
  };
}
