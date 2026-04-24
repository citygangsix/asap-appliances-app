export function getLocalOperationsServerUrl(pathname) {
  const configuredBaseUrl = import.meta.env.VITE_LOCAL_OPERATIONS_SERVER_URL?.trim();
  const baseUrl =
    configuredBaseUrl ||
    (import.meta.env.DEV ? "http://127.0.0.1:8787" : window.location.origin);
  return `${baseUrl}${pathname}`;
}
