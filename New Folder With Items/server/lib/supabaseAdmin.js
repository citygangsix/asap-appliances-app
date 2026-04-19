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

function readOptionalNumberEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function getTwilioServerConfig() {
  const lumiaInvoicePhoneNumber = readOptionalEnv("LUMIA_INVOICE_SMS_PHONE_NUMBER");

  return {
    supabaseUrl: readRequiredEnv("VITE_SUPABASE_URL"),
    supabaseServiceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    accountSid: readRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: readRequiredEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: readRequiredEnv("TWILIO_PHONE_NUMBER"),
    lumiaInvoicePhoneNumber,
    assistantOfficePhoneNumber:
      readOptionalEnv("ASSISTANT_OFFICE_PHONE_NUMBER") || lumiaInvoicePhoneNumber,
    workflowDispatchLeadMinutes: readOptionalNumberEnv("WORKFLOW_DISPATCH_HEADS_UP_MINUTES", 60),
    workflowPaymentFollowupMinutes: readOptionalNumberEnv("WORKFLOW_PAYMENT_FOLLOWUP_MINUTES", 8),
    workflowFinalAlertLeadMinutes: readOptionalNumberEnv("WORKFLOW_FINAL_ALERT_LEAD_MINUTES", 10),
    workflowLaborInvoiceAmount: readOptionalNumberEnv("WORKFLOW_LABOR_INVOICE_AMOUNT", 150),
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
