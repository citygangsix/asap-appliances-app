/** @typedef {import("../../types/models").RepositorySource} RepositorySource */

export const DEFAULT_DATA_SOURCE = "mock";
export const SUPABASE_MOCK_FALLBACK_ENV = "VITE_SUPABASE_ALLOW_MOCK_FALLBACK";

const BOOLEAN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const BOOLEAN_FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readBooleanEnv(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();

  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return false;
  }

  return null;
}

/**
 * @returns {RepositorySource}
 */
export function getRequestedDataSource() {
  const configuredSource =
    import.meta.env.VITE_APP_DATA_SOURCE ||
    import.meta.env.VITE_DATA_SOURCE ||
    DEFAULT_DATA_SOURCE;

  return configuredSource === "supabase" ? "supabase" : "mock";
}

export function isSupabaseMockFallbackAllowed() {
  const configuredFallback = readBooleanEnv(import.meta.env[SUPABASE_MOCK_FALLBACK_ENV]);

  if (configuredFallback !== null) {
    return configuredFallback;
  }

  return getRequestedDataSource() !== "supabase" || Boolean(import.meta.env.DEV);
}

export function getLiveDataSourceMode() {
  if (getRequestedDataSource() !== "supabase") {
    return "mock";
  }

  return isSupabaseMockFallbackAllowed()
    ? "supabase_with_mock_fallback"
    : "supabase_strict";
}

export function getDataSourceStatus() {
  return {
    requested: getRequestedDataSource(),
    defaultSource: DEFAULT_DATA_SOURCE,
    liveMode: getLiveDataSourceMode(),
    mockFallbackAllowed: isSupabaseMockFallbackAllowed(),
    mockFallbackEnv: SUPABASE_MOCK_FALLBACK_ENV,
    supportedSources: ["mock", "supabase"],
  };
}
