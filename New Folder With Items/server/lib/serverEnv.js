export function readServerEnv(key) {
  const denoEnv = globalThis.Deno?.env;

  if (denoEnv?.get) {
    return denoEnv.get(key) || null;
  }

  return globalThis.process?.env?.[key] || null;
}

export function readServerNumberEnv(key, fallback) {
  const value = Number(readServerEnv(key));
  return Number.isFinite(value) ? value : fallback;
}
