#!/usr/bin/env node
import process from "node:process";
import {
  SERVER_ENV_PROFILE_NAMES,
  formatEnvValidationReport,
  validateServerEnv,
} from "../server/lib/envValidation.js";
import { loadServerEnv } from "../server/lib/loadEnv.js";

loadServerEnv();

const profileName = process.argv[2] || "signalwire-smoke";

if (!SERVER_ENV_PROFILE_NAMES.includes(profileName)) {
  console.error(`[env-check] Unknown profile "${profileName}".`);
  console.error(`[env-check] Available profiles: ${SERVER_ENV_PROFILE_NAMES.join(", ")}`);
  process.exitCode = 2;
} else {
  const result = validateServerEnv(profileName);
  console.log(formatEnvValidationReport(result));

  if (!result.ok) {
    process.exitCode = 1;
  }
}
