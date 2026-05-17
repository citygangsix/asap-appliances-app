import { createClient } from "@supabase/supabase-js";
import { loadServerEnv } from "./loadEnv.js";
import { readServerEnv, readServerNumberEnv } from "./serverEnv.js";

loadServerEnv();

let serverSupabaseClient = null;

function readRequiredEnv(key) {
  const value = readServerEnv(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readOptionalEnv(key) {
  const value = readServerEnv(key);
  return value ? value : null;
}

function readFirstEnv(keys) {
  for (const key of keys) {
    const value = readOptionalEnv(key);

    if (value) {
      return value;
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

function readRequiredSupabaseUrl() {
  const value = readServerEnv("VITE_SUPABASE_URL") || readServerEnv("SUPABASE_URL");

  if (!value) {
    throw new Error("Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL");
  }

  return value;
}

function readRequiredSupabaseServiceRoleKey() {
  const value =
    readServerEnv("SUPABASE_SERVICE_ROLE_KEY") || readServerEnv("SUPABASE_SERVICE_ROLE");

  if (!value) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE",
    );
  }

  return value;
}

function readOptionalListEnv(key) {
  const value = readOptionalEnv(key);

  if (!value) {
    return [];
  }

  return value
    .split(/[,\n]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readOptionalNumberEnv(key, fallback) {
  return readServerNumberEnv(key, fallback);
}

function normalizeApiBaseUrl(value) {
  return value ? value.trim().replace(/\/$/u, "") : null;
}

function normalizeSignalWireApiBaseUrl() {
  let normalizedSpaceUrl = readOptionalEnv("SIGNALWIRE_SPACE_URL")?.trim().replace(/\/$/u, "");

  if (!normalizedSpaceUrl) {
    return null;
  }

  if (!/^https?:\/\//iu.test(normalizedSpaceUrl)) {
    normalizedSpaceUrl = normalizedSpaceUrl.includes(".")
      ? `https://${normalizedSpaceUrl}`
      : `https://${normalizedSpaceUrl}.signalwire.com`;
  }

  let parsedSpaceUrl = null;

  try {
    parsedSpaceUrl = new URL(normalizedSpaceUrl);
  } catch (error) {
    return null;
  }

  const normalizedPathname = parsedSpaceUrl.pathname.replace(/\/$/u, "");

  if (/\/api\/laml\/2010-04-01$/u.test(normalizedPathname)) {
    return `${parsedSpaceUrl.origin}${normalizedPathname}`;
  }

  return `${parsedSpaceUrl.origin}/api/laml/2010-04-01`;
}

function resolveTelephonyProvider(apiBaseUrl) {
  const configuredProvider = readOptionalEnv("TELEPHONY_PROVIDER")?.trim().toLowerCase();

  if (configuredProvider === "signalwire" || configuredProvider === "twilio") {
    return configuredProvider;
  }

  if (
    readOptionalEnv("SIGNALWIRE_PROJECT_ID") ||
    readOptionalEnv("SIGNALWIRE_API_TOKEN") ||
    readOptionalEnv("SIGNALWIRE_SPACE_URL") ||
    /signalwire\.com/iu.test(apiBaseUrl || "")
  ) {
    return "signalwire";
  }

  return "twilio";
}

export function getTwilioServerConfig() {
  const phoneNumber = readRequiredAnyEnv(["SIGNALWIRE_PHONE_NUMBER", "TWILIO_PHONE_NUMBER"]);
  const lumiaInvoicePhoneNumber = readOptionalEnv("LUMIA_INVOICE_SMS_PHONE_NUMBER");
  const assistantOfficePhoneNumber = readOptionalEnv("ASSISTANT_OFFICE_PHONE_NUMBER") || lumiaInvoicePhoneNumber;
  const clickToCallAgentNumber =
    readOptionalEnv("SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER") ||
    readOptionalEnv("TWILIO_CLICK_TO_CALL_AGENT_NUMBER") ||
    assistantOfficePhoneNumber ||
    readOptionalEnv("SIGNALWIRE_VOICE_FORWARD_TO") ||
    readOptionalEnv("TWILIO_VOICE_FORWARD_TO");
  const signalWireManagedPhoneNumbers = readOptionalListEnv("SIGNALWIRE_MANAGED_PHONE_NUMBERS");
  const twilioManagedPhoneNumbers = readOptionalListEnv("TWILIO_MANAGED_PHONE_NUMBERS");
  const managedPhoneNumbers = Array.from(
    new Set([phoneNumber, ...signalWireManagedPhoneNumbers, ...twilioManagedPhoneNumbers].filter(Boolean)),
  );
  const apiBaseUrl =
    normalizeSignalWireApiBaseUrl() ||
    normalizeApiBaseUrl(readOptionalEnv("TELEPHONY_API_BASE_URL")) ||
    normalizeApiBaseUrl(readOptionalEnv("TWILIO_API_BASE_URL")) ||
    "https://api.twilio.com/2010-04-01";
  const providerName = resolveTelephonyProvider(apiBaseUrl);
  const providerDisplayName = providerName === "signalwire" ? "SignalWire" : "Twilio";

  return {
    supabaseUrl: readRequiredSupabaseUrl(),
    supabaseServiceRoleKey: readRequiredSupabaseServiceRoleKey(),
    providerName,
    providerDisplayName,
    accountSid: readRequiredAnyEnv(["SIGNALWIRE_PROJECT_ID", "TWILIO_ACCOUNT_SID"]),
    authToken: readRequiredAnyEnv(["SIGNALWIRE_API_TOKEN", "TWILIO_AUTH_TOKEN"]),
    signalWireSigningKey: readOptionalEnv("SIGNALWIRE_SIGNING_KEY"),
    apiKeySid: readOptionalEnv("TWILIO_API_KEY_SID"),
    apiKeySecret: readOptionalEnv("TWILIO_API_KEY_SECRET"),
    apiBaseUrl,
    twimlAppSid: readOptionalEnv("SIGNALWIRE_CXML_APP_SID") || readOptionalEnv("TWILIO_TWIML_APP_SID"),
    phoneNumber,
    managedPhoneNumbers,
    lumiaInvoicePhoneNumber,
    assistantOfficePhoneNumber,
    voiceForwardToNumber:
      readOptionalEnv("SIGNALWIRE_VOICE_FORWARD_TO") ||
      readOptionalEnv("TWILIO_VOICE_FORWARD_TO") ||
      lumiaInvoicePhoneNumber ||
      assistantOfficePhoneNumber,
    clickToCallAgentNumber,
    thumbtackAssistantPhoneNumber:
      readOptionalEnv("THUMBTACK_ASSISTANT_PHONE_NUMBER") || clickToCallAgentNumber,
    thumbtackWebhookSecret: readOptionalEnv("THUMBTACK_WEBHOOK_SECRET"),
    workflowDispatchLeadMinutes: readOptionalNumberEnv("WORKFLOW_DISPATCH_HEADS_UP_MINUTES", 60),
    workflowTechnicianResponseFollowupMinutes: readOptionalNumberEnv(
      "WORKFLOW_TECHNICIAN_RESPONSE_FOLLOWUP_MINUTES",
      15,
    ),
    workflowPaymentFollowupMinutes: readOptionalNumberEnv("WORKFLOW_PAYMENT_FOLLOWUP_MINUTES", 8),
    workflowFinalAlertLeadMinutes: readOptionalNumberEnv("WORKFLOW_FINAL_ALERT_LEAD_MINUTES", 10),
    workflowLaborInvoiceAmount: readOptionalNumberEnv("WORKFLOW_LABOR_INVOICE_AMOUNT", 150),
    clickToCallAutoCooldownHours: readOptionalNumberEnv(
      "TWILIO_CLICK_TO_CALL_AUTO_COOLDOWN_HOURS",
      24,
    ),
    clickToCallMissedSmsDelaySeconds: readOptionalNumberEnv(
      "TWILIO_CLICK_TO_CALL_MISSED_SMS_DELAY_SECONDS",
      120,
    ),
    clickToCallMissedSmsBody: readOptionalEnv("TWILIO_CLICK_TO_CALL_MISSED_SMS_BODY"),
    webhookBaseUrl: readRequiredAnyEnv(["SIGNALWIRE_WEBHOOK_BASE_URL", "TWILIO_WEBHOOK_BASE_URL"]).replace(/\/$/u, ""),
    port: Number(readServerEnv("SIGNALWIRE_WEBHOOK_PORT") || readServerEnv("TWILIO_WEBHOOK_PORT") || 8787),
  };
}

export function getServerSupabaseClient() {
  if (!serverSupabaseClient) {
    serverSupabaseClient = createClient(readRequiredSupabaseUrl(), readRequiredSupabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverSupabaseClient;
}
