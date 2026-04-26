import fs from "node:fs";
import path from "node:path";

function parseEnvValue(rawValue) {
  const value = rawValue.trim();

  if (!value) {
    return "";
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      return;
    }
  } catch (error) {
    return;
  }

  let contents = "";

  try {
    contents = fs.readFileSync(filepath, "utf8");
  } catch (error) {
    return;
  }

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    process.env[key] = parseEnvValue(trimmed.slice(separatorIndex + 1));
  }
}

export function loadServerEnv() {
  if (!globalThis.process?.cwd || !globalThis.process?.env) {
    return;
  }

  const cwd = process.cwd();

  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env.server.local"));
}
