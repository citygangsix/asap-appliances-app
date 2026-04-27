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

export function getTwilioServerConfig() {
  const phoneNumber = readRequiredEnv("TWILIO_PHONE_NUMBER");
  const lumiaInvoicePhoneNumber = readOptionalEnv("LUMIA_INVOICE_SMS_PHONE_NUMBER");
  const assistantOfficePhoneNumber = readOptionalEnv("ASSISTANT_OFFICE_PHONE_NUMBER") || lumiaInvoicePhoneNumber;
  const clickToCallAgentNumber =
    readOptionalEnv("TWILIO_CLICK_TO_CALL_AGENT_NUMBER") ||
    assistantOfficePhoneNumber ||
    readOptionalEnv("TWILIO_VOICE_FORWARD_TO");
  const managedPhoneNumbers = Array.from(
    new Set([phoneNumber, ...readOptionalListEnv("TWILIO_MANAGED_PHONE_NUMBERS")].filter(Boolean)),
  );

  return {
    supabaseUrl: readRequiredSupabaseUrl(),
    supabaseServiceRoleKey: readRequiredSupabaseServiceRoleKey(),
    accountSid: readRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: readRequiredEnv("TWILIO_AUTH_TOKEN"),
    apiKeySid: readOptionalEnv("TWILIO_API_KEY_SID"),
    apiKeySecret: readOptionalEnv("TWILIO_API_KEY_SECRET"),
    twimlAppSid: readOptionalEnv("TWILIO_TWIML_APP_SID"),
    phoneNumber,
    managedPhoneNumbers,
    lumiaInvoicePhoneNumber,
    assistantOfficePhoneNumber,
    voiceForwardToNumber:
      readOptionalEnv("TWILIO_VOICE_FORWARD_TO") || lumiaInvoicePhoneNumber || assistantOfficePhoneNumber,
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
    webhookBaseUrl: readRequiredEnv("TWILIO_WEBHOOK_BASE_URL").replace(/\/$/u, ""),
    port: Number(readServerEnv("TWILIO_WEBHOOK_PORT") || 8787),
  };
}

export function getServerSupabaseClient() {
  if (!serverSupabaseClient) {
    const { supabaseUrl, supabaseServiceRoleKey } = getTwilioServerConfig();

    serverSupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverSupabaseClient;
}
