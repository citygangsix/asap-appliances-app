import { createClient } from "@supabase/supabase-js";
import { getDataSourceStatus } from "../../lib/config/dataSource";

const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

let supabaseClient = null;

export function getSupabaseConfig() {
  return supabaseConfig;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export function getSupabaseClientStatus(options = {}) {
  const { lastError = null } = options;

  return {
    configured: isSupabaseConfigured(),
    provider: "supabase",
    mode: !isSupabaseConfigured()
      ? "missing_credentials"
      : lastError
        ? "mock_fallback"
        : "live_reads_enabled",
    dataSource: getDataSourceStatus(),
    reason: !isSupabaseConfigured()
      ? "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Mock repositories remain the fallback source."
      : lastError
        ? `Supabase reads failed and the app fell back to mock data. ${lastError.message}`
        : "Supabase client is configured and live read queries are enabled.",
  };
}
