const SESSION_STORAGE_KEY = "asap_crm_temp_session";
const DEFAULT_PASSWORD_HASH = "1e9eb03eadc92cb0df2ac4e1cdc4591f1b578e395afbad882ffbf1fb1a0f2f35";

function getAllowedEmail() {
  return (import.meta.env.VITE_ASAP_AUTH_EMAIL || "").trim().toLowerCase();
}

function getPasswordHash() {
  return (import.meta.env.VITE_ASAP_AUTH_PASSWORD_SHA256 || DEFAULT_PASSWORD_HASH).trim().toLowerCase();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createSession(email) {
  return {
    email,
    createdAt: new Date().toISOString(),
    strategy: "temp-local-hash",
  };
}

export function getCurrentSession() {
  try {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch (error) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function isAuthenticated() {
  const session = getCurrentSession();
  return session?.email?.toLowerCase() === getAllowedEmail();
}

export async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await sha256(password);
  const allowedEmail = getAllowedEmail();

  // TEMP ONLY: replace this module with Supabase Auth before multi-user production access.
  if (!allowedEmail) {
    return { ok: false, message: "Dashboard login email is not configured." };
  }

  if (normalizedEmail !== allowedEmail || passwordHash !== getPasswordHash()) {
    return { ok: false, message: "The email or password did not match this dashboard." };
  }

  const session = createSession(normalizedEmail);
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function logout() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
