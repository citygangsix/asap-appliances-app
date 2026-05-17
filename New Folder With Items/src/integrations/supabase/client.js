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
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "asap-crm-supabase-auth",
      },
    });
  }

  return supabaseClient;
}

export function getSupabaseClientStatus(options = {}) {
  const { lastError = null } = options;
  const dataSource = getDataSourceStatus();
  const strictLiveMode = dataSource.liveMode === "supabase_strict";
  const configured = isSupabaseConfigured();
  const mode = !configured
    ? strictLiveMode
      ? "missing_credentials_strict"
      : "missing_credentials"
    : lastError
      ? strictLiveMode
        ? "live_read_error"
        : "mock_fallback"
      : strictLiveMode
        ? "live_reads_required"
        : "live_reads_enabled";
  const reason = !configured
    ? strictLiveMode
      ? "Supabase live mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Mock fallback is disabled for this build."
      : "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Mock repositories remain the fallback source."
    : lastError
      ? strictLiveMode
        ? `Supabase live reads failed and mock fallback is disabled. ${lastError.message}`
        : `Supabase reads failed and the app fell back to mock data. ${lastError.message}`
      : strictLiveMode
        ? "Supabase client is configured and live reads are required for this build."
        : "Supabase client is configured and live read queries are enabled.";

  return {
    configured,
    provider: "supabase",
    mode,
    dataSource,
    reason,
  };
}
