import { readServerEnv } from "./serverEnv.js";

const PLACEHOLDER_PHONE_NUMBERS = new Set([
  "+15555550111",
  "+15555550123",
  "+15551234567",
  "+201001234567",
]);

const SERVER_ENV_PROFILES = {
  "signalwire-smoke": {
    label: "SignalWire/Twilio-compatible local webhook smoke test",
    required: [
      {
        keys: ["SUPABASE_URL", "VITE_SUPABASE_URL"],
        purpose: "Supabase project URL for service-role reads and dry-run route setup.",
      },
      {
        keys: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE"],
        purpose: "Supabase service-role key used only by the server/API.",
      },
      {
        keys: ["SIGNALWIRE_PROJECT_ID", "TWILIO_ACCOUNT_SID"],
        purpose: "Voice provider project/account id used to validate webhook AccountSid.",
      },
      {
        keys: ["SIGNALWIRE_API_TOKEN", "TWILIO_AUTH_TOKEN"],
        purpose: "Voice provider API token used to validate Twilio-compatible webhook signatures.",
      },
      {
        keys: ["SIGNALWIRE_PHONE_NUMBER", "TWILIO_PHONE_NUMBER"],
        purpose: "Managed ASAP business caller ID and inbound destination number.",
      },
      {
        keys: ["SIGNALWIRE_WEBHOOK_BASE_URL", "TWILIO_WEBHOOK_BASE_URL"],
        purpose: "Public webhook base URL used when computing provider signatures.",
      },
      {
        keys: [
          "SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER",
          "TWILIO_CLICK_TO_CALL_AGENT_NUMBER",
          "ASSISTANT_OFFICE_PHONE_NUMBER",
          "LUMIA_INVOICE_SMS_PHONE_NUMBER",
          "SIGNALWIRE_VOICE_FORWARD_TO",
          "TWILIO_VOICE_FORWARD_TO",
        ],
        purpose: "Answerable human phone for click-to-call dry-run targeting.",
      },
      {
        keys: [
          "SIGNALWIRE_VOICE_FORWARD_TO",
          "TWILIO_VOICE_FORWARD_TO",
          "LUMIA_INVOICE_SMS_PHONE_NUMBER",
          "ASSISTANT_OFFICE_PHONE_NUMBER",
        ],
        purpose: "Answerable human phone for inbound voice forwarding.",
      },
      {
        keys: ["ASAP_DASHBOARD_AUTH_BEARER_TOKEN", "SUPABASE_AUTH_ACCESS_TOKEN"],
        purpose:
          "Supabase Auth access token for protected dashboard dry-run routes used by the smoke test.",
      },
    ],
    recommended: [
      {
        keys: ["SIGNALWIRE_SPACE_URL", "TELEPHONY_API_BASE_URL", "TWILIO_API_BASE_URL"],
        purpose: "SignalWire Compatibility API base URL for real outbound calls and messages.",
      },
      {
        keys: ["SIGNALWIRE_SIGNING_KEY"],
        purpose: "Allows validation of provider callbacks sent with X-SignalWire-Signature.",
      },
    ],
  },
  hosted: {
    label: "hosted SignalWire/Thumbtack/dashboard API readiness",
    extends: "signalwire-smoke",
    required: [
      {
        keys: ["SIGNALWIRE_SPACE_URL", "TELEPHONY_API_BASE_URL", "TWILIO_API_BASE_URL"],
        purpose: "SignalWire Compatibility API base URL for live outbound calls and SMS.",
      },
      {
        keys: ["THUMBTACK_WEBHOOK_SECRET"],
        purpose: "Shared secret for POST /api/thumbtack/lead.",
      },
      {
        keys: ["TWILIO_API_KEY_SID"],
        purpose: "Browser calling Voice SDK API key SID for GET /api/twilio/voice-token.",
      },
      {
        keys: ["TWILIO_API_KEY_SECRET"],
        purpose: "Browser calling Voice SDK API key secret for GET /api/twilio/voice-token.",
      },
      {
        keys: ["TWILIO_TWIML_APP_SID", "SIGNALWIRE_CXML_APP_SID"],
        purpose: "Browser calling TwiML/CXML app SID for GET /api/twilio/voice-token.",
      },
    ],
    recommended: [
      {
        keys: ["SIGNALWIRE_SIGNING_KEY"],
        purpose: "Recommended when SignalWire sends X-SignalWire-Signature instead of X-Twilio-Signature.",
      },
      {
        keys: ["OPENAI_API_KEY"],
        purpose: "Optional call recording transcription and analysis.",
      },
    ],
  },
};

function readTrimmedEnv(key) {
  const value = readServerEnv(key);
  return typeof value === "string" ? value.trim() : "";
}

function isPlaceholderValue(key, value) {
  const normalizedValue = String(value || "").trim();
  const lowerValue = normalizedValue.toLowerCase();

  if (!normalizedValue) {
    return true;
  }

  if (
    lowerValue.includes("your-") ||
    lowerValue.includes("replace-with") ||
    lowerValue.includes("example.com") ||
    lowerValue.includes("xxxxxxxx")
  ) {
    return true;
  }

  if (PLACEHOLDER_PHONE_NUMBERS.has(normalizedValue)) {
    return true;
  }

  if (key.endsWith("_SECRET") && lowerValue.startsWith("your-")) {
    return true;
  }

  return false;
}

function getConfiguredKey(keys) {
  const placeholderKeys = [];

  for (const key of keys) {
    const value = readTrimmedEnv(key);

    if (!value) {
      continue;
    }

    if (isPlaceholderValue(key, value)) {
      placeholderKeys.push(key);
      continue;
    }

    return {
      key,
      placeholderKeys,
    };
  }

  return {
    key: null,
    placeholderKeys,
  };
}

function resolveProfile(profileName) {
  const profile = SERVER_ENV_PROFILES[profileName];

  if (!profile) {
    return null;
  }

  if (!profile.extends) {
    return profile;
  }

  const parent = resolveProfile(profile.extends);

  return {
    ...profile,
    required: dedupeEntries([...(parent?.required || []), ...(profile.required || [])]),
    recommended: dedupeEntries([...(parent?.recommended || []), ...(profile.recommended || [])]),
  };
}

function buildEntryKey(entry) {
  return entry.keys.join("|");
}

function dedupeEntries(entries = []) {
  const entriesByKey = new Map();

  for (const entry of entries) {
    entriesByKey.set(buildEntryKey(entry), entry);
  }

  return Array.from(entriesByKey.values());
}

function checkEntries(entries = []) {
  return entries.map((entry) => {
    const configured = getConfiguredKey(entry.keys);

    return {
      ...entry,
      configuredKey: configured.key,
      placeholderKeys: configured.placeholderKeys,
      ok: Boolean(configured.key),
    };
  });
}

function buildAliasWarnings() {
  const warnings = [];
  const legacyPairs = [
    ["SIGNALWIRE_PROJECT_ID", "TWILIO_ACCOUNT_SID"],
    ["SIGNALWIRE_API_TOKEN", "TWILIO_AUTH_TOKEN"],
    ["SIGNALWIRE_PHONE_NUMBER", "TWILIO_PHONE_NUMBER"],
    ["SIGNALWIRE_WEBHOOK_BASE_URL", "TWILIO_WEBHOOK_BASE_URL"],
    ["SIGNALWIRE_MANAGED_PHONE_NUMBERS", "TWILIO_MANAGED_PHONE_NUMBERS"],
    ["SIGNALWIRE_CLICK_TO_CALL_AGENT_NUMBER", "TWILIO_CLICK_TO_CALL_AGENT_NUMBER"],
    ["SIGNALWIRE_VOICE_FORWARD_TO", "TWILIO_VOICE_FORWARD_TO"],
  ];

  const fallbackPairs = legacyPairs.filter(([signalWireKey, twilioKey]) => {
    return !readTrimmedEnv(signalWireKey) && Boolean(readTrimmedEnv(twilioKey));
  });

  if (fallbackPairs.length > 0) {
    warnings.push(
      `Using legacy TWILIO_* fallback aliases for ${fallbackPairs
        .map(([, twilioKey]) => twilioKey)
        .join(", ")}. ASAP's current provider is SignalWire, so prefer SIGNALWIRE_* names when updating secrets.`,
    );
  }

  const hasSignalWireCredentials =
    Boolean(readTrimmedEnv("SIGNALWIRE_PROJECT_ID")) ||
    Boolean(readTrimmedEnv("SIGNALWIRE_API_TOKEN")) ||
    Boolean(readTrimmedEnv("SIGNALWIRE_PHONE_NUMBER"));
  const hasSignalWireApiBase =
    Boolean(readTrimmedEnv("SIGNALWIRE_SPACE_URL")) ||
    /signalwire\.com/iu.test(readTrimmedEnv("TELEPHONY_API_BASE_URL")) ||
    /signalwire\.com/iu.test(readTrimmedEnv("TWILIO_API_BASE_URL"));

  if (hasSignalWireCredentials && !hasSignalWireApiBase) {
    warnings.push(
      "SignalWire credentials are set, but no SignalWire API base is configured. Set SIGNALWIRE_SPACE_URL for real outbound calls/SMS.",
    );
  }

  return warnings;
}

export function validateServerEnv(profileName = "signalwire-smoke") {
  const profile = resolveProfile(profileName);

  if (!profile) {
    return {
      ok: false,
      profileName,
      label: profileName,
      missing: [],
      recommendedMissing: [],
      warnings: [`Unknown env validation profile "${profileName}".`],
    };
  }

  const required = checkEntries(profile.required);
  const requiredKeys = new Set(profile.required.map(buildEntryKey));
  const recommended = checkEntries(
    profile.recommended.filter((entry) => !requiredKeys.has(buildEntryKey(entry))),
  );
  const missing = required.filter((entry) => !entry.ok);
  const recommendedMissing = recommended.filter((entry) => !entry.ok);

  return {
    ok: missing.length === 0,
    profileName,
    label: profile.label,
    missing,
    recommendedMissing,
    configured: required.filter((entry) => entry.ok),
    warnings: buildAliasWarnings(),
  };
}

export function validateSignalWireSmokeEnv() {
  return validateServerEnv("signalwire-smoke");
}

function formatCheckEntry(entry) {
  const placeholderNote =
    entry.placeholderKeys?.length > 0
      ? ` Placeholder values were found for ${entry.placeholderKeys.join(", ")} and are treated as missing.`
      : "";

  return `- ${entry.keys.join(" or ")}: ${entry.purpose}${placeholderNote}`;
}

export function formatEnvValidationReport(result) {
  const lines = [
    `[env-check] ${result.ok ? "PASS" : "FAIL"} ${result.label}`,
    "[env-check] Secret values are never printed by this check.",
  ];

  if (result.missing?.length > 0) {
    lines.push("", "Missing required variables:");
    lines.push(...result.missing.map(formatCheckEntry));
  }

  if (result.recommendedMissing?.length > 0) {
    lines.push("", "Recommended for full hosted/live verification:");
    lines.push(...result.recommendedMissing.map(formatCheckEntry));
  }

  if (result.warnings?.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }

  if (!result.ok) {
    lines.push(
      "",
      "Next step: copy .env.server.example to .env.server.local, fill only real local/server secrets, then rerun the check.",
    );
  }

  return lines.join("\n");
}

export const SERVER_ENV_PROFILE_NAMES = Object.keys(SERVER_ENV_PROFILES);
