const HOSTED_OPERATIONS_API_URL = "https://nexkymqahpkvzzlvivfi.supabase.co/functions/v1/asap-crm";

function getConfiguredBaseUrl() {
  return import.meta.env.VITE_LOCAL_OPERATIONS_SERVER_URL?.trim() || "";
}

function getDefaultBaseUrl() {
  if (!import.meta.env.DEV) {
    return HOSTED_OPERATIONS_API_URL;
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:8787";
  }

  const { hostname } = window.location;
  const localHostnames = new Set(["", "localhost", "127.0.0.1", "::1"]);

  return localHostnames.has(hostname)
    ? "http://127.0.0.1:8787"
    : `${window.location.protocol}//${hostname}:8787`;
}

export function getLocalOperationsServerUrl(pathname) {
  const baseUrl = getConfiguredBaseUrl() || getDefaultBaseUrl();
  return `${baseUrl}${pathname}`;
}

export function getLocalOperationsServerHeaders(headers = {}) {
  const baseUrl = getConfiguredBaseUrl() || getDefaultBaseUrl();
  const nextHeaders = { ...headers };

  if (/\.ngrok-free\./iu.test(baseUrl)) {
    nextHeaders["ngrok-skip-browser-warning"] = "true";
  }

  return nextHeaders;
}
