import { createClient } from "@supabase/supabase-js";
import { loadServerEnv } from "./loadEnv.js";

loadServerEnv();

let serverSupabaseClient = null;

function readRequiredEnv(key) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function readOptionalEnv(key) {
  const value = process.env[key];
  return value ? value : null;
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
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
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
    supabaseUrl: readRequiredEnv("VITE_SUPABASE_URL"),
    supabaseServiceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    accountSid: readRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: readRequiredEnv("TWILIO_AUTH_TOKEN"),
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
    port: Number(process.env.TWILIO_WEBHOOK_PORT || 8787),
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
