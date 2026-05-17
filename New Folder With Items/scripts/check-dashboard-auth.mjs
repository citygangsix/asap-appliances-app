#!/usr/bin/env node
import { handleOperationsFetchRequest } from "../server/lib/operationsFetchRouter.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function clearServerAuthEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE;
}

function configureFakeServerAuthEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}

async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function checkMissingServerAuthEnvFailsClosed() {
  clearServerAuthEnv();

  const response = await handleOperationsFetchRequest(
    new Request("https://local.test/api/hiring-candidates"),
  );
  const body = await readJsonResponse(response);

  assert(response.status === 503, `Expected missing server auth env to return 503, received ${response.status}.`);
  assert(body?.message?.includes("Supabase dashboard auth is not configured"), "Expected a clear server auth configuration error.");
}

async function checkAnonymousDashboardApiIsRejected() {
  clearServerAuthEnv();
  configureFakeServerAuthEnv();

  const response = await handleOperationsFetchRequest(
    new Request("https://local.test/api/twilio/voice-token"),
  );
  const body = await readJsonResponse(response);

  assert(response.status === 401, `Expected anonymous dashboard API request to return 401, received ${response.status}.`);
  assert(body?.message?.includes("Supabase dashboard session is required"), "Expected a clear missing session error.");
}

async function checkOldSharedSecretHeaderIsIgnored() {
  clearServerAuthEnv();
  configureFakeServerAuthEnv();

  const response = await handleOperationsFetchRequest(
    new Request("https://local.test/api/hiring-candidates", {
      headers: {
        "X-ASAP-Dashboard-Secret": "old-shared-secret",
      },
    }),
  );
  const body = await readJsonResponse(response);

  assert(response.status === 401, `Expected old shared-secret header to be ignored with 401, received ${response.status}.`);
  assert(body?.message?.includes("Supabase dashboard session is required"), "Expected the old dashboard secret header not to authenticate.");
}

async function checkPublicServiceRequestStaysPublic() {
  clearServerAuthEnv();

  const response = await handleOperationsFetchRequest(
    new Request("https://local.test/api/service-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Auth Smoke Test",
        phone: "5615550100",
        serviceAddress: "123 Test St, Boca Raton, FL",
        applianceType: "Washer",
        issueSummary: "Dry-run auth boundary check",
        preferredTiming: "Tomorrow morning",
        smsConsent: true,
        dryRun: true,
      }),
    }),
  );
  const body = await readJsonResponse(response);

  assert(response.status === 200, `Expected public service request dry run to return 200, received ${response.status}.`);
  assert(body?.ok === true && body?.dryRun === true, "Expected public service request dry run to succeed without dashboard auth.");
}

await checkMissingServerAuthEnvFailsClosed();
await checkAnonymousDashboardApiIsRejected();
await checkOldSharedSecretHeaderIsIgnored();
await checkPublicServiceRequestStaysPublic();

console.log("[dashboard-auth] PASS Supabase Auth route boundaries");
