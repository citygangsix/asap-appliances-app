import { loadServerEnv } from "./loadEnv.js";
import { readServerEnv, readServerNumberEnv } from "./serverEnv.js";

loadServerEnv();

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_ANALYSIS_MODEL = "gpt-4o-mini";
const DEFAULT_LOCAL_WHISPER_CLI_PATH = "whisper-cli";
const DEFAULT_LOCAL_WHISPER_FFMPEG_PATH = "ffmpeg";
const DEFAULT_LOCAL_WHISPER_MODEL_PATH = "/Users/xxx/.cache/whisper-cpp/ggml-base.bin";
const DEFAULT_LOCAL_WHISPER_TIMEOUT_SECONDS = 900;
const HIRING_CANDIDATE_STAGES = new Set([
  "contacted",
  "interviewed",
  "trial_scheduled",
  "documents_pending",
  "offered",
  "onboarded",
  "rejected",
]);
const HIRING_AVAILABILITY_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const HIRING_AVAILABILITY_TIME_PREFERENCES = new Set([
  "weekdays",
  "weekends",
  "mornings",
  "afternoons",
  "evenings",
  "overnights",
  "anytime",
]);

const TECHNICIAN_RECRUITING_PATTERNS = [
  { label: "resume/source", weight: 5, pattern: /\b(resume|indeed|zip\s*recruiter|ziprecruiter|applicant|candidate|applied|application)\b/iu },
  { label: "job offer", weight: 5, pattern: /\b(offer\s+you\s+(some\s+)?work|technician\s+(position|role|job)|appliance\s+repair\s+(position|role|job)|looking\s+for\s+(technicians?|help|work))\b/iu },
  { label: "experience screening", weight: 4, pattern: /\b(do\s+you\s+have\s+(any\s+)?experience|how\s+(many|much)\s+.*experience|years?\s+of\s+experience|worked\s+on\s+(washers?|dryers?|refrigerators?|fridges?|ovens?|stoves?|dishwashers?))\b/iu },
  { label: "tech requirements", weight: 4, pattern: /\b(do\s+you\s+have\s+(a\s+)?(vehicle|car|truck|tools?|multimeter)|reliable\s+(vehicle|car|transportation)|own\s+tools?|tool\s+bag|meters?|epa\s+(universal|certified)|certifications?)\b/iu },
  { label: "current job status", weight: 4, pattern: /\b(current(?:ly)?\s+(?:working|employed|with|doing)|full[- ]?time|part[- ]?time|side\s+(?:work|jobs?)|freelance|self[- ]?employed|contract(?:or|s)?|give\s+(?:notice|two\s+weeks)|after\s+(?:my\s+)?(?:job|work|shift)|before\s+(?:my\s+)?(?:job|work|shift))\b/iu },
  { label: "tools and vehicle", weight: 4, pattern: /\b(my|own|have|got)\s+(?:a\s+)?(?:vehicle|car|truck|suv|van|tools?|tool\s+bag|meter|multimeter|gauges?)\b/iu },
  { label: "tech payout", weight: 4, pattern: /\b(we\s+pay|pay\s+you|payout|paid\s+daily|diagnostics?\s+(?:is|are|pay|pays?)\s*\$?\d+|\$\d+\s*(?:to|-)\s*\$?\d+\s+(?:for\s+)?(?:diagnostics?|installs?|installations?)|gas\s+(?:covered|paid|reimbursement))\b/iu },
  { label: "availability to work", weight: 3, pattern: /\b(what(?:'s| is)\s+your\s+availability|when\s+are\s+you\s+available|available\s+(?:after|before|on|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekends?|weekdays?))\b/iu },
  { label: "field training", weight: 4, pattern: /\b(field\s+training|on[- ]?field\s+training|train(?:ing)?\s+you|get\s+you\s+trained|ride[- ]?along|trial\s+(day|job|route|call))\b/iu },
  { label: "dispatching tech", weight: 3, pattern: /\b(send\s+you\s+(?:out|jobs?|work)|assign\s+you\s+(?:jobs?|work|calls?)|customers?\s+in\s+your\s+(?:area|city|town)|target\s+ads\s+around\s+(?:your|the)\s+home)\b/iu },
  { label: "onboarding", weight: 5, pattern: /\b(onboard(?:ing)?|starter\s+packet|w-?9|direct\s+deposit|paperwork|welcome\s+(?:aboard|to\s+the\s+team)|you(?:'re| are)\s+hired)\b/iu },
];

const CUSTOMER_SERVICE_PATTERNS = [
  { label: "customer appliance issue", weight: 5, pattern: /\b(my|our|the)\s+(washer|dryer|refrigerator|fridge|freezer|dishwasher|oven|stove|range|cooktop|microwave|ac|a\/c|air\s+conditioner)\b/iu },
  { label: "broken/not working", weight: 4, pattern: /\b(not\s+working|stopped\s+working|won't\s+(?:start|turn|spin|drain|heat|cool)|is\s+broken|leaking|making\s+noise|not\s+cooling|not\s+heating|not\s+draining|error\s+code)\b/iu },
  { label: "service appointment", weight: 4, pattern: /\b(schedule\s+(?:service|appointment|repair)|come\s+out|send\s+(?:someone|a\s+tech|the\s+technician)|service\s+call|appointment|eta|arrival|address)\b/iu },
  { label: "customer payment", weight: 4, pattern: /\b(invoice|balance|refund|partial\s+refund|full\s+refund|diagnostic\s+(?:fee|charge|evaluation)|service\s+fee|labor\s+charge|payment|paid|charge\s+card|cash\s+app|zelle)\b/iu },
  { label: "parts/warranty", weight: 3, pattern: /\b(part(?:s)?\s+(?:ordered|arrived|needed|warranty)|warranty|return\s+visit|install\s+the\s+part|replacement\s+part)\b/iu },
  { label: "customer follow-up", weight: 3, pattern: /\b(customer|homeowner|tenant|landlord|property\s+manager|read\s+receipt|texted\s+back|called\s+about\s+(?:a|the)\s+repair)\b/iu },
];

const HIRED_DECISION_PATTERNS = [
  /\byou('re| are)\s+hired\b/iu,
  /\bwe('re| are)\s+hiring\s+you\b/iu,
  /\bwelcome\s+(aboard|to\s+the\s+team)\b/iu,
  /\bbring\s+you\s+on(board)?\b/iu,
  /\bstart(?:ing)?\s+(with\s+us|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week)\b/iu,
  /\b(send|sent|sending)\s+(you\s+)?(the\s+)?(onboarding|paperwork|documents|w-?9|direct\s+deposit)\b/iu,
  /\b(first|trial)\s+(job|day|route|call)\s+(is\s+)?(scheduled|set|booked)\b/iu,
];

const HIRING_OFFER_PROGRESS_PATTERNS = [
  /\b(we|i)\s+(can|could|will|would)\s+(send|get)\s+you\s+(out|jobs?|work|trained|training)\b/iu,
  /\b(we|i)\s+(can|could|will|would)\s+start\s+(you|with\s+you)\b/iu,
  /\b(field\s+training|on[- ]?field\s+training|get\s+you\s+trained|train\s+you\s+up)\b/iu,
  /\bassign(?:ing)?\s+(you\s+)?(jobs?|work|calls?)\b/iu,
  /\b(first|extra)\s+(job|jobs|route|call)\s+after\s+work\b/iu,
];

const HIRING_ACCEPTANCE_PATTERNS = [
  /\bi('m| am)\s+(all\s+game|100\s*%\s+game|up\s+for\s+it|interested|willing|ready)\b/iu,
  /\b(absolutely|sounds\s+good|that\s+sounds\s+good|i\s+can\s+do\s+that|i(?:'ll| will)\s+stick\s+with\s+you|let'?s\s+do\s+it)\b/iu,
  /\b(i\s+want\s+to\s+move\s+forward|looking\s+forward\s+to\s+it|i\s+would\s+like\s+to\s+work\s+with\s+you)\b/iu,
];

const TRIAL_SCHEDULED_PATTERNS = [
  /\btrial\s+(day|job|route|call)\b/iu,
  /\b(first)\s+(job|route|call)\b/iu,
  /\btry\s+you\s+out\b/iu,
  /\bsee\s+how\s+you\s+do\b/iu,
];

function readOptionalEnv(key) {
  const value = readServerEnv(key);
  return value ? value : null;
}

function readOptionalNumberEnv(key, fallback) {
  const value = readServerNumberEnv(key, fallback);
  return value > 0 ? value : fallback;
}

function readOptionalBooleanEnv(key, fallback) {
  const value = readServerEnv(key);

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).trim().toLowerCase());
}

function normalizeOptionalString(value) {
  return String(value || "").trim();
}

function normalizeYesNoUnclear(value) {
  const normalized = normalizeOptionalString(value).toLowerCase();

  if (normalized === "yes" || normalized === "no" || normalized === "unclear") {
    return normalized;
  }

  return normalized ? "unclear" : "";
}

function normalizeOptionalIsoDate(value) {
  const trimmed = normalizeOptionalString(value);
  return /^\d{4}-\d{2}-\d{2}$/u.test(trimmed) ? trimmed : "";
}

function normalizeStringArray(values, allowedValues) {
  const source = Array.isArray(values) ? values : [];
  const normalized = [];
  const seen = new Set();

  source.forEach((value) => {
    const item = normalizeOptionalString(value).toLowerCase();

    if (!item || (allowedValues && !allowedValues.has(item)) || seen.has(item)) {
      return;
    }

    normalized.push(item);
    seen.add(item);
  });

  return normalized;
}

function scoreKeywordPatterns(transcript, patterns) {
  const matches = [];
  let score = 0;

  for (const keyword of patterns) {
    if (keyword.pattern.test(transcript)) {
      score += keyword.weight;
      matches.push(keyword.label);
    }
  }

  return { score, matches };
}

export function classifyTranscriptAudienceForCrm(transcriptText) {
  const transcript = normalizeOptionalString(transcriptText);

  if (!transcript) {
    return {
      audience: "other",
      conversationType: "other",
      confidence: "low",
      technicianScore: 0,
      customerScore: 0,
      technicianKeywords: [],
      customerKeywords: [],
    };
  }

  const technician = scoreKeywordPatterns(transcript, TECHNICIAN_RECRUITING_PATTERNS);
  const customer = scoreKeywordPatterns(transcript, CUSTOMER_SERVICE_PATTERNS);
  const hasStrongTechnicianSignal =
    technician.score >= 8 ||
    technician.matches.some((match) =>
      ["resume/source", "job offer", "onboarding", "tech payout"].includes(match),
    );
  const hasStrongCustomerSignal =
    customer.score >= 8 ||
    customer.matches.some((match) =>
      ["customer appliance issue", "broken/not working", "customer payment"].includes(match),
    );

  if (hasStrongTechnicianSignal && technician.score >= customer.score - 2) {
    return {
      audience: "technician",
      conversationType: "hiring",
      confidence: technician.score >= 10 ? "high" : "medium",
      technicianScore: technician.score,
      customerScore: customer.score,
      technicianKeywords: technician.matches,
      customerKeywords: customer.matches,
    };
  }

  if (hasStrongCustomerSignal && customer.score > technician.score) {
    return {
      audience: "customer",
      conversationType: "service",
      confidence: customer.score >= 10 ? "high" : "medium",
      technicianScore: technician.score,
      customerScore: customer.score,
      technicianKeywords: technician.matches,
      customerKeywords: customer.matches,
    };
  }

  return {
    audience: "other",
    conversationType: "other",
    confidence: "low",
    technicianScore: technician.score,
    customerScore: customer.score,
    technicianKeywords: technician.matches,
    customerKeywords: customer.matches,
  };
}

function buildOpenAiHeaders(apiKey, headers = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...headers,
  };
}

function inferHiringDecisionFromTranscript(transcriptText) {
  const transcript = normalizeOptionalString(transcriptText);

  if (!transcript) {
    return {
      isHired: false,
      stage: null,
      criteria: [],
    };
  }

  const criteria = HIRED_DECISION_PATTERNS.filter((pattern) => pattern.test(transcript)).map((pattern) =>
    pattern.source,
  );

  if (criteria.length) {
    return {
      isHired: true,
      stage: "onboarded",
      criteria,
    };
  }

  const hiringOfferCriteria = HIRING_OFFER_PROGRESS_PATTERNS.filter((pattern) =>
    pattern.test(transcript),
  ).map((pattern) => pattern.source);
  const hiringAcceptanceCriteria = HIRING_ACCEPTANCE_PATTERNS.filter((pattern) =>
    pattern.test(transcript),
  ).map((pattern) => pattern.source);

  if (hiringOfferCriteria.length && hiringAcceptanceCriteria.length) {
    return {
      isHired: true,
      stage: "onboarded",
      criteria: [...hiringOfferCriteria, ...hiringAcceptanceCriteria],
    };
  }

  const trialCriteria = TRIAL_SCHEDULED_PATTERNS.filter((pattern) => pattern.test(transcript)).map(
    (pattern) => pattern.source,
  );

  return {
    isHired: false,
    stage: trialCriteria.length ? "trial_scheduled" : null,
    criteria: trialCriteria,
  };
}

function buildTwilioAuthHeader(accountSid, authToken) {
  return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
}

function stripKnownRecordingExtension(recordingUrl) {
  return String(recordingUrl || "").replace(/\.(?:mp3|wav|json)$/iu, "");
}

function buildAccountLevelRecordingUrl(recordingUrl) {
  try {
    const url = new URL(recordingUrl);
    const accountLevelPathname = url.pathname.replace(
      /\/Calls\/[^/]+(?=\/Recordings\/)/u,
      "",
    );

    if (accountLevelPathname === url.pathname) {
      return null;
    }

    url.pathname = accountLevelPathname;
    return url.toString();
  } catch (error) {
    return null;
  }
}

function buildRecordingDownloadCandidates(recordingUrl) {
  if (!recordingUrl) {
    return [];
  }

  const trimmed = String(recordingUrl).trim();

  if (!trimmed) {
    return [];
  }

  const bases = [
    { label: "callback", url: stripKnownRecordingExtension(trimmed) },
    {
      label: "account",
      url: stripKnownRecordingExtension(buildAccountLevelRecordingUrl(trimmed)),
    },
  ].filter((candidate) => candidate.url);
  const seen = new Set();
  const candidates = [];

  for (const base of bases) {
    for (const url of [`${base.url}.mp3`, `${base.url}.wav`, base.url]) {
      if (seen.has(url)) {
        continue;
      }

      seen.add(url);
      candidates.push({ label: base.label, url });
    }
  }

  return candidates;
}

function inferAudioContentType(downloadUrl, response) {
  const contentType = response.headers.get("content-type");

  if (contentType) {
    return contentType;
  }

  return downloadUrl.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
}

function inferAudioFilename(downloadUrl, contentType) {
  if (downloadUrl.endsWith(".mp3")) {
    return "call-recording.mp3";
  }

  if (downloadUrl.endsWith(".wav")) {
    return "call-recording.wav";
  }

  return contentType?.includes("mpeg") ? "call-recording.mp3" : "call-recording.wav";
}

function isAudioResponse(contentType) {
  return (
    /^audio\//iu.test(contentType || "") ||
    /octet-stream/iu.test(contentType || "") ||
    /application\/x-mpegurl/iu.test(contentType || "")
  );
}

function buildSafeResponsePreview(buffer, contentType) {
  if (!/^text\//iu.test(contentType || "") && !/json/iu.test(contentType || "")) {
    return "";
  }

  return new TextDecoder()
    .decode(buffer.slice(0, Math.min(buffer.byteLength, 160)))
    .replace(/\s+/gu, " ")
    .replace(/[A-Za-z0-9_-]{16,}/gu, "[redacted]")
    .trim();
}

function formatRecordingDownloadAttempts(attempts) {
  if (attempts.length === 0) {
    return "No recording URLs were available.";
  }

  return attempts
    .map((attempt, index) => {
      const preview = attempt.preview ? ` preview="${attempt.preview}"` : "";

      return `#${index + 1} ${attempt.label}/${attempt.authMode}: status ${attempt.status}, content-type ${attempt.contentType || "unknown"}, content-length ${attempt.contentLength || "unknown"}, bytes ${attempt.bytes}${preview}`;
    })
    .join("; ");
}

function getOpenAiConfig() {
  return {
    apiKey: readOptionalEnv("OPENAI_API_KEY"),
    transcriptionModel:
      readOptionalEnv("OPENAI_TRANSCRIPTION_MODEL") || DEFAULT_TRANSCRIPTION_MODEL,
    analysisModel: readOptionalEnv("OPENAI_CALL_ANALYSIS_MODEL") || DEFAULT_ANALYSIS_MODEL,
  };
}

function getTranscriptionConfig() {
  const provider =
    readOptionalEnv("CALL_TRANSCRIPTION_PROVIDER") ||
    readOptionalEnv("TRANSCRIPTION_PROVIDER") ||
    "openai";

  return {
    provider: provider.toLowerCase(),
    whisperCliPath: readOptionalEnv("LOCAL_WHISPER_CLI_PATH") || DEFAULT_LOCAL_WHISPER_CLI_PATH,
    whisperFfmpegPath:
      readOptionalEnv("LOCAL_WHISPER_FFMPEG_PATH") || DEFAULT_LOCAL_WHISPER_FFMPEG_PATH,
    whisperModelPath:
      readOptionalEnv("LOCAL_WHISPER_MODEL_PATH") || DEFAULT_LOCAL_WHISPER_MODEL_PATH,
    whisperLanguage: readOptionalEnv("LOCAL_WHISPER_LANGUAGE") || "auto",
    whisperThreads: readOptionalNumberEnv("LOCAL_WHISPER_THREADS", 4),
    whisperTimeoutSeconds: readOptionalNumberEnv(
      "LOCAL_WHISPER_TIMEOUT_SECONDS",
      DEFAULT_LOCAL_WHISPER_TIMEOUT_SECONDS,
    ),
    whisperNoGpu: readOptionalBooleanEnv("LOCAL_WHISPER_NO_GPU", true),
  };
}

function getAnalysisProvider() {
  return (
    readOptionalEnv("CALL_ANALYSIS_PROVIDER") ||
    readOptionalEnv("ANALYSIS_PROVIDER") ||
    "openai"
  ).toLowerCase();
}

function isLocalWhisperProvider(provider) {
  return ["local-whisper", "whisper", "whisper-cli"].includes(provider);
}

export function isCallIntelligenceConfigured() {
  const transcriptionConfig = getTranscriptionConfig();

  if (isLocalWhisperProvider(transcriptionConfig.provider)) {
    return Boolean(transcriptionConfig.whisperModelPath);
  }

  return Boolean(getOpenAiConfig().apiKey);
}

async function downloadTwilioRecording(payload, twilioConfig) {
  const recordingCandidates = buildRecordingDownloadCandidates(payload.RecordingUrl);
  const authenticatedHeaders = {
    Authorization: buildTwilioAuthHeader(twilioConfig.accountSid, twilioConfig.authToken),
  };
  const attempts = [];

  for (const candidate of recordingCandidates) {
    for (const authMode of ["public", "authenticated"]) {
      const headers = authMode === "authenticated" ? authenticatedHeaders : {};
      let response = null;
      let buffer = new Uint8Array();
      let contentType = "";

      try {
        response = await fetch(candidate.url, { headers });
        buffer = new Uint8Array(await response.arrayBuffer());
        contentType = inferAudioContentType(candidate.url, response);
        attempts.push({
          authMode,
          bytes: buffer.byteLength,
          contentLength: response.headers.get("content-length"),
          contentType,
          label: candidate.label,
          preview: buildSafeResponsePreview(buffer, contentType),
          status: response.status,
        });

        if (!response.ok) {
          continue;
        }

        if (buffer.byteLength < 1024 || !isAudioResponse(contentType)) {
          continue;
        }

        if (buffer.byteLength > MAX_AUDIO_BYTES) {
          throw new Error(
            `Recording is ${Math.round(buffer.byteLength / (1024 * 1024))} MB, above the 25 MB transcription limit.`,
          );
        }

        return {
          buffer,
          contentType,
          filename: inferAudioFilename(candidate.url, contentType),
        };
      } catch (error) {
        attempts.push({
          authMode,
          bytes: 0,
          contentLength: null,
          contentType: null,
          label: candidate.label,
          preview: error?.message || "fetch failed",
          status: response?.status || "error",
        });
      }
    }
  }

  throw new Error(
    `Unable to download Twilio/SignalWire recording audio. ${formatRecordingDownloadAttempts(attempts)}`,
  );
}

async function transcribeRecordingAudioWithOpenAi(recording) {
  const { apiKey, transcriptionModel } = getOpenAiConfig();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the webhook server.");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([recording.buffer], { type: recording.contentType }),
    recording.filename,
  );
  formData.append("model", transcriptionModel);
  formData.append(
    "prompt",
    "This is a business phone call for an appliance company. It may be a customer-service call or a recruiting call. Return an accurate transcript without summarizing.",
  );

  const response = await fetch(`${OPENAI_API_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: buildOpenAiHeaders(apiKey),
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `OpenAI transcription failed with status ${response.status}.`,
    );
  }

  if (!payload?.text) {
    throw new Error("OpenAI transcription response did not include transcript text.");
  }

  return payload.text.trim();
}

function buildLocalWhisperArgs(config, inputPath, outputBasePath) {
  return [
    ...(config.whisperNoGpu ? ["-ng"] : []),
    "-m",
    config.whisperModelPath,
    "-f",
    inputPath,
    "-l",
    config.whisperLanguage,
    "-t",
    String(config.whisperThreads),
    "-otxt",
    "-of",
    outputBasePath,
    "-np",
    "--prompt",
    "This is a business phone call for an appliance company.",
  ];
}

function summarizeProcessOutput(output) {
  return String(output || "")
    .replace(/\s+/gu, " ")
    .slice(0, 600)
    .trim();
}

async function prepareLocalWhisperAudioInput(execFileAsync, config, inputPath, tempDir, pathModule) {
  const normalizedPath = pathModule.join(tempDir, "recording-normalized.wav");

  try {
    await execFileAsync(
      config.whisperFfmpegPath,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        normalizedPath,
      ],
      {
        timeout: 60 * 1000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );

    return { inputPath: normalizedPath, warning: "" };
  } catch (error) {
    const output = summarizeProcessOutput(`${error?.stdout || ""} ${error?.stderr || ""}`);
    const warning = output
      ? `Audio normalization skipped after ffmpeg failed: ${output}`
      : "Audio normalization skipped after ffmpeg failed.";

    return { inputPath, warning };
  }
}

async function readLocalWhisperTranscript(tempDir, outputTextPath, readFile, readdir, pathModule) {
  const entries = await readdir(tempDir).catch(() => []);
  const candidates = [
    outputTextPath,
    ...entries.filter((entry) => entry.endsWith(".txt")).map((entry) => pathModule.join(tempDir, entry)),
  ];
  const seen = new Set();

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);

    try {
      const transcriptText = (await readFile(candidate, "utf8")).trim();

      if (transcriptText) {
        return transcriptText;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return null;
}

async function transcribeRecordingAudioWithLocalWhisper(recording) {
  const config = getTranscriptionConfig();
  const [{ execFile }, { mkdtemp, readFile, readdir, rm, writeFile }, { tmpdir }, pathModule, { promisify }] =
    await Promise.all([
      import("node:child_process"),
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
      import("node:util"),
    ]);
  const execFileAsync = promisify(execFile);
  const tempDir = await mkdtemp(pathModule.join(tmpdir(), "asap-whisper-"));
  const extension = recording.filename?.toLowerCase().endsWith(".wav") ? ".wav" : ".mp3";
  const inputPath = pathModule.join(tempDir, `recording${extension}`);
  const outputBasePath = pathModule.join(tempDir, "transcript");
  const outputTextPath = `${outputBasePath}.txt`;
  let normalizationWarning = "";
  let whisperResult = null;

  try {
    await writeFile(inputPath, recording.buffer);
    const preparedAudio = await prepareLocalWhisperAudioInput(
      execFileAsync,
      config,
      inputPath,
      tempDir,
      pathModule,
    );
    normalizationWarning = preparedAudio.warning;
    whisperResult = await execFileAsync(
      config.whisperCliPath,
      buildLocalWhisperArgs(config, preparedAudio.inputPath, outputBasePath),
      {
        timeout: config.whisperTimeoutSeconds * 1000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const transcriptText = await readLocalWhisperTranscript(
      tempDir,
      outputTextPath,
      readFile,
      readdir,
      pathModule,
    );

    if (!transcriptText) {
      const entries = (await readdir(tempDir).catch(() => [])).join(", ") || "none";
      const stdout = summarizeProcessOutput(whisperResult?.stdout);
      const stderr = summarizeProcessOutput(whisperResult?.stderr);
      const details = [
        normalizationWarning,
        entries ? `files: ${entries}` : "",
        stdout ? `stdout: ${stdout}` : "",
        stderr ? `stderr: ${stderr}` : "",
      ].filter(Boolean);

      throw new Error(
        `Local Whisper did not produce transcript text.${details.length ? ` ${details.join(" ")}` : ""}`,
      );
    }

    return transcriptText;
  } catch (error) {
    const output = summarizeProcessOutput(`${error?.stdout || ""} ${error?.stderr || ""}`);
    const message = [error?.message || "Unknown whisper-cli error.", output].filter(Boolean).join(" ");

    throw new Error(
      `Local Whisper transcription failed: ${message}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function transcribeRecordingAudio(recording) {
  const config = getTranscriptionConfig();

  if (isLocalWhisperProvider(config.provider)) {
    return transcribeRecordingAudioWithLocalWhisper(recording);
  }

  return transcribeRecordingAudioWithOpenAi(recording);
}

function extractJsonStringFromResponse(responsePayload) {
  if (typeof responsePayload?.output_text === "string" && responsePayload.output_text.trim()) {
    return responsePayload.output_text.trim();
  }

  const outputItems = Array.isArray(responsePayload?.output) ? responsePayload.output : [];

  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];

    for (const content of contentItems) {
      if (typeof content?.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}

async function analyzeTranscript(transcriptText) {
  const { apiKey, analysisModel } = getOpenAiConfig();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the webhook server.");
  }

  const response = await fetch(`${OPENAI_API_BASE_URL}/responses`, {
    method: "POST",
    headers: buildOpenAiHeaders(apiKey, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      model: analysisModel,
      instructions:
        "You analyze business phone calls for an appliance company. Some calls are customer service calls, and some are hiring or recruiting calls. Return strict JSON only. Be concise, factual, and never invent details. If a section or hiring field is not mentioned, return an empty string. Mark is_hiring true only when the transcript clearly shows a recruiting, applicant, technician hiring, resume, payout-to-technician, availability-to-work, current-job-status, vehicle/tools, training, onboarding, or job-offer discussion. Hiring key points include: availability to work, whether the candidate currently has a job or side work, whether they have tools, whether they have a reliable vehicle, whether they have appliance repair experience, and what other work experience they have. Treat customer/service calls as service when they mention a broken appliance, service appointment, address, diagnostic fee, invoice, refund, warranty, parts, payment, or a customer asking for repair help. Detect the original spoken language. If the call is not fully English, keep the transcript as originally transcribed, but provide English summaries and translated key details.",
      input: `Transcript:\n${transcriptText}`,
      text: {
        format: {
          type: "json_schema",
          name: "call_summary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "headline",
              "highlights",
              "conversation_type",
              "language",
              "sections",
              "hiring_candidate",
            ],
            properties: {
              headline: {
                type: "string",
                description: "One short CRM headline for the call.",
              },
              highlights: {
                type: "string",
                description: "A short paragraph or bullets summarizing the main points.",
              },
              conversation_type: {
                type: "string",
                enum: ["service", "hiring", "other"],
                description:
                  "Classify the overall conversation. Use hiring for recruiting or technician hiring calls.",
              },
              language: {
                type: "object",
                additionalProperties: false,
                required: [
                  "original_language",
                  "contains_non_english",
                  "english_translation_note",
                  "english_key_details",
                ],
                properties: {
                  original_language: {
                    type: "string",
                    description:
                      "The main original spoken language, for example English, Spanish, Haitian Creole, Portuguese, or Mixed English/Spanish.",
                  },
                  contains_non_english: {
                    type: "boolean",
                    description: "True when any meaningful portion of the call is not English.",
                  },
                  english_translation_note: {
                    type: "string",
                    description:
                      "One sentence saying whether the conversation was originally in another language and translated/summarized in English.",
                  },
                  english_key_details: {
                    type: "string",
                    description:
                      "Important non-English parts translated into English. Leave blank if the call was already English.",
                  },
                },
              },
              sections: {
                type: "object",
                additionalProperties: false,
                required: [
                  "customer_need",
                  "appliance_or_system",
                  "scheduling_and_location",
                  "parts_and_warranty",
                  "billing_and_payment",
                  "follow_up_actions",
                ],
                properties: {
                  customer_need: { type: "string" },
                  appliance_or_system: { type: "string" },
                  scheduling_and_location: { type: "string" },
                  parts_and_warranty: { type: "string" },
                  billing_and_payment: { type: "string" },
                  follow_up_actions: { type: "string" },
                },
              },
              hiring_candidate: {
                type: "object",
                additionalProperties: false,
                required: [
                  "is_hiring",
                  "candidate_name",
                  "email",
                  "source",
                  "stage",
                  "trade",
                  "city",
                  "service_area",
                  "is_hired",
                  "start_date",
                  "availability_summary",
                  "availability_days",
                  "availability_time_preferences",
                  "current_job_status",
                  "tools_status",
                  "vehicle_status",
                  "tools_vehicle_summary",
                  "payout_expectation_summary",
                  "experience_summary",
                  "appliance_experience_summary",
                  "other_work_experience_summary",
                  "next_step",
                ],
                properties: {
                  is_hiring: {
                    type: "boolean",
                    description:
                      "True only if this call is clearly a hiring or recruiting conversation.",
                  },
                  candidate_name: { type: "string" },
                  email: { type: "string" },
                  source: {
                    type: "string",
                    description:
                      "Lead source like Indeed, resume, referral, or blank if not stated.",
                  },
                  stage: {
                    type: "string",
                    enum: [
                      "contacted",
                      "interviewed",
                      "trial_scheduled",
                      "documents_pending",
                      "offered",
                      "onboarded",
                      "rejected",
                    ],
                  },
                  trade: { type: "string" },
                  city: { type: "string" },
                  service_area: { type: "string" },
                  is_hired: {
                    type: "boolean",
                    description:
                      "True only when the call clearly confirms the candidate is hired or officially starting.",
                  },
                  start_date: {
                    type: "string",
                    description:
                      "Use YYYY-MM-DD only when an exact calendar start date is explicitly stated. Otherwise return an empty string.",
                  },
                  availability_summary: { type: "string" },
                  availability_days: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                      ],
                    },
                  },
                  availability_time_preferences: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "weekdays",
                        "weekends",
                        "mornings",
                        "afternoons",
                        "evenings",
                        "overnights",
                        "anytime",
                      ],
                    },
                  },
                  current_job_status: {
                    type: "string",
                    description:
                      "What the candidate said about current employment, side work, freelance work, notice needed, or working around an existing job. Leave blank if not discussed.",
                  },
                  tools_status: {
                    type: "string",
                    enum: ["yes", "no", "unclear"],
                    description:
                      "Use yes only if the candidate clearly has tools; no only if they clearly do not; otherwise unclear.",
                  },
                  vehicle_status: {
                    type: "string",
                    enum: ["yes", "no", "unclear"],
                    description:
                      "Use yes only if the candidate clearly has reliable transportation or a vehicle; no only if they clearly do not; otherwise unclear.",
                  },
                  tools_vehicle_summary: {
                    type: "string",
                    description:
                      "Short summary of tools, vehicle, transportation, mileage, gas, and field-readiness details. Leave blank if not discussed.",
                  },
                  payout_expectation_summary: { type: "string" },
                  experience_summary: { type: "string" },
                  appliance_experience_summary: {
                    type: "string",
                    description:
                      "Specific experience doing appliance repair work, including refrigeration, laundry, cooking, sealed systems, diagnostics, warranty, or out-of-warranty repairs.",
                  },
                  other_work_experience_summary: {
                    type: "string",
                    description:
                      "Other work experience mentioned, such as AC/HVAC, electrical, installs, factory warranty networks, dispatching, sales, or unrelated trades.",
                  },
                  next_step: { type: "string" },
                },
              },
            },
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI analysis failed with status ${response.status}.`);
  }

  const parsed = payload?.output_parsed || null;

  if (parsed && typeof parsed === "object") {
    return parsed;
  }

  const jsonText = extractJsonStringFromResponse(payload);

  if (!jsonText) {
    throw new Error("OpenAI analysis response did not include parsable JSON text.");
  }

  return JSON.parse(jsonText);
}

function buildTranscriptExcerpt(transcriptText, maxLength = 320) {
  const normalized = normalizeOptionalString(transcriptText).replace(/\s+/gu, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

const HIRING_LOCATION_CITIES = [
  "Boca Raton",
  "Boynton Beach",
  "Broward",
  "Clearwater",
  "Coral Springs",
  "Dallas",
  "Deerfield Beach",
  "Delray Beach",
  "Fort Lauderdale",
  "Fort Myers",
  "Fort Pierce",
  "Hialeah",
  "Hollywood",
  "Homestead",
  "Irving",
  "Kissimmee",
  "Lakeland",
  "Margate",
  "Miami",
  "Miramar",
  "Naples",
  "North Miami",
  "Ocala",
  "Orlando",
  "Palm Beach",
  "Pembroke Pines",
  "Plantation",
  "Plano",
  "Pompano",
  "Pompano Beach",
  "Port St. Lucie",
  "St. Petersburg",
  "Tallahassee",
  "Tampa",
  "West Palm Beach",
];

function splitTranscriptSentences(transcriptText) {
  const normalizedTranscript = normalizeOptionalString(transcriptText).replace(/\s+/gu, " ");

  if (!normalizedTranscript) {
    return [];
  }

  return normalizedTranscript
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function findFirstSentence(sentences, pattern) {
  return sentences.find((sentence) => pattern.test(sentence)) || "";
}

function findSentences(sentences, pattern, limit = 2) {
  return sentences.filter((sentence) => pattern.test(sentence)).slice(0, limit);
}

function joinSentenceSummary(sentences, fallback = "") {
  const uniqueSentences = [];
  const seen = new Set();

  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();

    if (!sentence || seen.has(normalized)) {
      continue;
    }

    uniqueSentences.push(sentence);
    seen.add(normalized);
  }

  return uniqueSentences.join(" ") || fallback;
}

function extractHiringLocation(sentences, transcriptText) {
  const transcript = normalizeOptionalString(transcriptText);
  const matchedCity = HIRING_LOCATION_CITIES.find((city) => {
    const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`\\b${escapedCity}\\b`, "iu").test(transcript);
  });
  const locationSentence = findFirstSentence(
    sentences,
    /\b(live|lives|living|from|based|located|area|cover|coverage|service|work\s+(?:in|around|near)|close\s+to\s+where\s+you\s+live)\b/iu,
  );

  return {
    city: matchedCity || "",
    serviceArea: matchedCity ? locationSentence || matchedCity : locationSentence,
  };
}

function extractHiringFactsFromTranscript(transcriptText) {
  const sentences = splitTranscriptSentences(transcriptText);
  const excerpt = buildTranscriptExcerpt(transcriptText);
  const location = extractHiringLocation(sentences, transcriptText);
  const currentJobStatus = joinSentenceSummary(
    findSentences(
      sentences,
      /\b(current(?:ly)?|right\s+now|job|working|work\s+for|employed|side\s+(?:work|jobs?)|contract|notice|after\s+(?:my\s+)?(?:job|work|shift)|before\s+(?:my\s+)?(?:job|work|shift)|for\s+a\s+living)\b/iu,
      2,
    ),
  );
  const applianceExperienceSummary = joinSentenceSummary(
    findSentences(
      sentences,
      /\b(appliance|washer|dryer|refrigerator|fridge|freezer|dishwasher|oven|stove|range|cooktop|microwave|sealed\s+system|diagnostic|repair)\b/iu,
      2,
    ),
  );
  const otherWorkExperienceSummary = joinSentenceSummary(
    findSentences(
      sentences,
      /\b(hvac|a\/c|ac\b|air\s+conditioning|electrical|plumb(?:ing)?|install(?:ation|s)?|maintenance|warranty|sales|dispatch|construction|handyman)\b/iu,
      2,
    ),
  );
  const yearsExperience = findFirstSentence(
    sentences,
    /\b(\d+\s*(?:to|-)?\s*\d*\s*years?|years?\s+of\s+experience|experience\s+(?:in|with|doing)|background)\b/iu,
  );
  const experienceSummary = joinSentenceSummary(
    [yearsExperience, applianceExperienceSummary || otherWorkExperienceSummary].filter(Boolean),
    excerpt,
  );
  const toolsVehicleSentences = findSentences(
    sentences,
    /\b(tools?|tool\s+bag|meter|multimeter|gauges?|vehicle|car|truck|van|suv|transportation|drive|driving|gas|mileage)\b/iu,
    2,
  );
  const toolsVehicleSummary = joinSentenceSummary(toolsVehicleSentences);
  const toolsStatus = /\b(have|has|got|own)\s+(?:my\s+|his\s+|her\s+|their\s+)?(?:own\s+)?tools?\b/iu.test(
    toolsVehicleSummary,
  )
    ? "yes"
    : /\b(no|don'?t|doesn'?t|without)\s+tools?\b/iu.test(toolsVehicleSummary)
      ? "no"
      : "unclear";
  const vehicleStatus = /\b(have|has|got|own|reliable)\s+(?:my\s+|his\s+|her\s+|their\s+)?(?:own\s+)?(?:vehicle|car|truck|van|suv|transportation)\b/iu.test(
    toolsVehicleSummary,
  )
    ? "yes"
    : /\b(no|don'?t|doesn'?t|without)\s+(?:vehicle|car|truck|van|transportation)\b/iu.test(
          toolsVehicleSummary,
        )
      ? "no"
      : "unclear";
  const payoutExpectationSummary = joinSentenceSummary(
    findSentences(
      sentences,
      /\b(pay|paid|payout|diagnostic|installation|install|commission|per\s+(?:call|job)|daily|cash|zelle|gas|mileage|\$\d+)/iu,
      2,
    ),
  );
  const availabilitySummary = joinSentenceSummary(
    findSentences(
      sentences,
      /\b(available|availability|start|after\s+\d|before\s+\d|morning|afternoon|evening|weekend|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|notice)\b/iu,
      2,
    ),
  );

  return {
    city: location.city,
    serviceArea: location.serviceArea,
    currentJobStatus,
    toolsStatus,
    vehicleStatus,
    toolsVehicleSummary,
    payoutExpectationSummary,
    availabilitySummary,
    experienceSummary,
    applianceExperienceSummary,
    otherWorkExperienceSummary,
  };
}

function buildLocalHeuristicAnalysis(transcriptText) {
  const classification = classifyTranscriptAudienceForCrm(transcriptText);
  const conversationType = classification.conversationType || "other";
  const isHiringConversation = conversationType === "hiring";
  const isServiceConversation = conversationType === "service";
  const excerpt = buildTranscriptExcerpt(transcriptText);
  const hiringFacts = isHiringConversation ? extractHiringFactsFromTranscript(transcriptText) : {};

  return {
    headline: isHiringConversation
      ? "Hiring call transcript captured"
      : isServiceConversation
        ? "Customer service call transcript captured"
        : "Call transcript captured",
    highlights: excerpt || "Transcript captured locally with Whisper.",
    conversation_type: conversationType,
    language: {
      original_language: "Auto-detected by local Whisper",
      contains_non_english: false,
      english_translation_note:
        "Local free transcription does not run the paid translation summary step.",
      english_key_details: "",
    },
    sections: {
      customer_need: isServiceConversation ? excerpt : "",
      appliance_or_system: "",
      scheduling_and_location: "",
      parts_and_warranty: "",
      billing_and_payment: "",
      follow_up_actions: "Review the transcript for exact next steps.",
    },
    hiring_candidate: {
      is_hiring: isHiringConversation,
      candidate_name: "",
      email: "",
      source: "",
      stage: "contacted",
      trade: isHiringConversation ? "Appliance repair" : "",
      city: hiringFacts.city || "",
      service_area: hiringFacts.serviceArea || "",
      is_hired: false,
      start_date: "",
      availability_summary: hiringFacts.availabilitySummary || "",
      availability_days: [],
      availability_time_preferences: [],
      current_job_status: hiringFacts.currentJobStatus || "",
      tools_status: hiringFacts.toolsStatus || "unclear",
      vehicle_status: hiringFacts.vehicleStatus || "unclear",
      tools_vehicle_summary: hiringFacts.toolsVehicleSummary || "",
      payout_expectation_summary: hiringFacts.payoutExpectationSummary || "",
      experience_summary: isHiringConversation ? hiringFacts.experienceSummary || excerpt : "",
      appliance_experience_summary: hiringFacts.applianceExperienceSummary || "",
      other_work_experience_summary: hiringFacts.otherWorkExperienceSummary || "",
      next_step: "Review the transcript and update candidate details manually.",
    },
  };
}

async function analyzeTranscriptWithConfiguredProvider(transcriptText) {
  const provider = getAnalysisProvider();

  if (["local", "local-heuristic", "heuristic", "off", "none"].includes(provider)) {
    return buildLocalHeuristicAnalysis(transcriptText);
  }

  try {
    return await analyzeTranscript(transcriptText);
  } catch (error) {
    if (!readOptionalBooleanEnv("CALL_ANALYSIS_FALLBACK_ENABLED", true)) {
      throw error;
    }

    console.error("[call-intelligence][analysis-fallback]", error);
    return buildLocalHeuristicAnalysis(transcriptText);
  }
}

function normalizeAnalysisResult(analysis, transcriptText = "") {
  const keywordClassification = classifyTranscriptAudienceForCrm(transcriptText);
  const modelConversationType =
    analysis?.conversation_type === "hiring" || analysis?.conversation_type === "other"
      ? analysis.conversation_type
      : "service";
  const modelSaysHiring =
    Boolean(analysis?.hiring_candidate?.is_hiring) || modelConversationType === "hiring";
  let normalizedConversationType = modelConversationType;

  if (keywordClassification.audience === "technician" && keywordClassification.confidence !== "low") {
    normalizedConversationType = "hiring";
  } else if (
    keywordClassification.audience === "customer" &&
    (keywordClassification.confidence === "high" || keywordClassification.technicianScore === 0)
  ) {
    normalizedConversationType = "service";
  } else if (modelSaysHiring && keywordClassification.audience !== "customer") {
    normalizedConversationType = "hiring";
  }

  const inferredHiringDecision = inferHiringDecisionFromTranscript(transcriptText);
  const normalizedHiringStage = HIRING_CANDIDATE_STAGES.has(analysis?.hiring_candidate?.stage)
    ? analysis.hiring_candidate.stage
    : "contacted";
  const isHired =
    Boolean(analysis?.hiring_candidate?.is_hired) ||
    normalizedHiringStage === "onboarded" ||
    inferredHiringDecision.isHired;
  const isHiringConversation = normalizedConversationType === "hiring";

  return {
    headline: normalizeOptionalString(analysis?.headline),
    highlights: normalizeOptionalString(analysis?.highlights),
    conversationType: normalizedConversationType,
    classification: keywordClassification,
    language: {
      originalLanguage: normalizeOptionalString(analysis?.language?.original_language) || "English",
      containsNonEnglish: Boolean(analysis?.language?.contains_non_english),
      englishTranslationNote: normalizeOptionalString(analysis?.language?.english_translation_note),
      englishKeyDetails: normalizeOptionalString(analysis?.language?.english_key_details),
    },
    sections: {
      customer_need: normalizeOptionalString(analysis?.sections?.customer_need),
      appliance_or_system: normalizeOptionalString(analysis?.sections?.appliance_or_system),
      scheduling_and_location: normalizeOptionalString(analysis?.sections?.scheduling_and_location),
      parts_and_warranty: normalizeOptionalString(analysis?.sections?.parts_and_warranty),
      billing_and_payment: normalizeOptionalString(analysis?.sections?.billing_and_payment),
      follow_up_actions: normalizeOptionalString(analysis?.sections?.follow_up_actions),
    },
    hiringCandidate: {
      isHiringConversation,
      isHired,
      candidateName: normalizeOptionalString(analysis?.hiring_candidate?.candidate_name),
      email: normalizeOptionalString(analysis?.hiring_candidate?.email),
      source: normalizeOptionalString(analysis?.hiring_candidate?.source),
      stage: isHired ? "onboarded" : inferredHiringDecision.stage || normalizedHiringStage,
      hiredCriteria: inferredHiringDecision.criteria,
      trade: normalizeOptionalString(analysis?.hiring_candidate?.trade),
      city: normalizeOptionalString(analysis?.hiring_candidate?.city),
      serviceArea: normalizeOptionalString(analysis?.hiring_candidate?.service_area),
      startDate: normalizeOptionalIsoDate(analysis?.hiring_candidate?.start_date),
      availabilitySummary: normalizeOptionalString(
        analysis?.hiring_candidate?.availability_summary,
      ),
      availabilityDays: normalizeStringArray(
        analysis?.hiring_candidate?.availability_days,
        HIRING_AVAILABILITY_DAYS,
      ),
      availabilityTimePreferences: normalizeStringArray(
        analysis?.hiring_candidate?.availability_time_preferences,
        HIRING_AVAILABILITY_TIME_PREFERENCES,
      ),
      currentJobStatus: normalizeOptionalString(analysis?.hiring_candidate?.current_job_status),
      toolsStatus: normalizeYesNoUnclear(analysis?.hiring_candidate?.tools_status),
      vehicleStatus: normalizeYesNoUnclear(analysis?.hiring_candidate?.vehicle_status),
      toolsVehicleSummary: normalizeOptionalString(
        analysis?.hiring_candidate?.tools_vehicle_summary,
      ),
      payoutExpectationSummary: normalizeOptionalString(
        analysis?.hiring_candidate?.payout_expectation_summary,
      ),
      experienceSummary: normalizeOptionalString(analysis?.hiring_candidate?.experience_summary),
      applianceExperienceSummary: normalizeOptionalString(
        analysis?.hiring_candidate?.appliance_experience_summary,
      ),
      otherWorkExperienceSummary: normalizeOptionalString(
        analysis?.hiring_candidate?.other_work_experience_summary,
      ),
      nextStep: normalizeOptionalString(analysis?.hiring_candidate?.next_step),
    },
  };
}

export async function transcribeAndAnalyzeTwilioRecording(payload, twilioConfig) {
  const recording = await downloadTwilioRecording(payload, twilioConfig);
  const transcriptText = await transcribeRecordingAudio(recording);
  const analysis = normalizeAnalysisResult(
    await analyzeTranscriptWithConfiguredProvider(transcriptText),
    transcriptText,
  );

  return {
    transcriptText,
    headline: analysis.headline,
    callHighlights: analysis.highlights,
    callSummarySections: analysis.sections,
    conversationType: analysis.conversationType,
    classification: analysis.classification,
    language: analysis.language,
    hiringCandidate: analysis.hiringCandidate,
  };
}

export async function analyzeTranscriptText(transcriptText) {
  const normalizedTranscript = normalizeOptionalString(transcriptText);

  if (!normalizedTranscript) {
    return null;
  }

  const analysis = normalizeAnalysisResult(
    await analyzeTranscriptWithConfiguredProvider(normalizedTranscript),
    normalizedTranscript,
  );

  return {
    transcriptText: normalizedTranscript,
    headline: analysis.headline,
    callHighlights: analysis.highlights,
    callSummarySections: analysis.sections,
    conversationType: analysis.conversationType,
    classification: analysis.classification,
    language: analysis.language,
    hiringCandidate: analysis.hiringCandidate,
  };
}
