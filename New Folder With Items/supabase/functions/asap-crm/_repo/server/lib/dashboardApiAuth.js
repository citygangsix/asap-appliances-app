import { createClient } from "@supabase/supabase-js";
import { readServerEnv } from "./serverEnv.js";

const DASHBOARD_API_ROUTES = [
  { method: "POST", pathname: "/api/invoices/send-lumia" },
  { method: "POST", pathname: "/api/dispatch/notify-eta" },
  { method: "POST", pathname: "/api/workflows/dispatch" },
  { method: "POST", pathname: "/api/workflows/generate-invoice" },
  { method: "POST", pathname: "/api/workflows/invoice-paid" },
  { method: "POST", pathname: "/api/workflows/final-work" },
  { method: "POST", pathname: "/api/twilio/outbound/calls" },
  { method: "GET", pathname: "/api/twilio/outbound/calls/active" },
  { method: "POST", pathname: "/api/twilio/outbound/messages" },
  { method: "POST", pathname: "/api/twilio/browser-call" },
  { method: "POST", pathname: "/api/twilio/hangup" },
  { method: "GET", pathname: "/api/twilio/voice-token" },
  { method: "GET", pathname: "/api/hiring-candidates" },
  { method: "POST", pathname: "/api/manual/calls/log" },
];

let dashboardAuthClient = null;
let dashboardAuthClientCacheKey = "";

function readRequiredAuthConfig() {
  const supabaseUrl = (
    readServerEnv("SUPABASE_URL") ||
    readServerEnv("VITE_SUPABASE_URL") ||
    ""
  ).trim();
  const serviceRoleKey = (
    readServerEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    readServerEnv("SUPABASE_SERVICE_ROLE") ||
    ""
  ).trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      message:
        "Supabase dashboard auth is not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return {
    ok: true,
    supabaseUrl,
    serviceRoleKey,
  };
}

function getDashboardAuthClient(config) {
  const cacheKey = `${config.supabaseUrl}:${config.serviceRoleKey}`;

  if (!dashboardAuthClient || dashboardAuthClientCacheKey !== cacheKey) {
    dashboardAuthClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    dashboardAuthClientCacheKey = cacheKey;
  }

  return dashboardAuthClient;
}

function readHeader(headers, name) {
  if (!headers) {
    return "";
  }

  const lowerName = name.toLowerCase();

  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(lowerName) || "";
  }

  const exactValue = headers[name] ?? headers[lowerName];

  if (exactValue !== undefined) {
    return Array.isArray(exactValue) ? String(exactValue[0] || "") : String(exactValue);
  }

  const matchingEntry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === lowerName,
  );
  const value = matchingEntry?.[1];

  if (value === undefined) {
    return "";
  }

  return Array.isArray(value) ? String(value[0] || "") : String(value);
}

function readBearerToken(headers) {
  const authorization = readHeader(headers, "Authorization").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() || "";
}

export function isDashboardApiRoute(method, pathname) {
  const normalizedMethod = String(method || "").toUpperCase();

  return DASHBOARD_API_ROUTES.some(
    (route) => route.method === normalizedMethod && route.pathname === pathname,
  );
}

export async function getDashboardApiAuthFailure(headers) {
  const authConfig = readRequiredAuthConfig();

  if (!authConfig.ok) {
    return {
      status: 503,
      message: authConfig.message,
    };
  }

  const accessToken = readBearerToken(headers);

  if (!accessToken) {
    return {
      status: 401,
      message: "Supabase dashboard session is required.",
    };
  }

  const { data, error } = await getDashboardAuthClient(authConfig).auth.getUser(accessToken);

  if (error || !data?.user) {
    return {
      status: 403,
      message: "Supabase dashboard session is invalid or expired.",
    };
  }

  return null;
}
