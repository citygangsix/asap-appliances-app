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

export function getTwilioServerConfig() {
  return {
    supabaseUrl: readRequiredEnv("VITE_SUPABASE_URL"),
    supabaseServiceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    accountSid: readRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: readRequiredEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: readRequiredEnv("TWILIO_PHONE_NUMBER"),
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
