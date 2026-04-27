const HOSTED_OPERATIONS_API_URL = "https://retold-playback-cause.ngrok-free.dev";

function getConfiguredBaseUrl() {
  return import.meta.env.VITE_LOCAL_OPERATIONS_SERVER_URL?.trim() || "";
}

function getDefaultBaseUrl() {
  return import.meta.env.DEV ? "http://127.0.0.1:8787" : HOSTED_OPERATIONS_API_URL;
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
