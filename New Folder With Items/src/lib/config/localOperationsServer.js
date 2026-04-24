export function getLocalOperationsServerUrl(pathname) {
  const baseUrl = import.meta.env.VITE_LOCAL_OPERATIONS_SERVER_URL || "http://127.0.0.1:8787";
  return `${baseUrl}${pathname}`;
}
