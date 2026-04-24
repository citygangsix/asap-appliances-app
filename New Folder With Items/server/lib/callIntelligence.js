import { loadServerEnv } from "./loadEnv.js";

loadServerEnv();

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_ANALYSIS_MODEL = "gpt-4o-mini";
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

const HIRED_DECISION_PATTERNS = [
  /\byou('re| are)\s+hired\b/iu,
  /\bwe('re| are)\s+hiring\s+you\b/iu,
  /\bwelcome\s+(aboard|to\s+the\s+team)\b/iu,
  /\bbring\s+you\s+on(board)?\b/iu,
  /\bstart(?:ing)?\s+(with\s+us|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week)\b/iu,
  /\b(send|sent|sending)\s+(you\s+)?(the\s+)?(onboarding|paperwork|documents|w-?9|direct\s+deposit)\b/iu,
  /\b(first|trial)\s+(job|day|route|call)\s+(is\s+)?(scheduled|set|booked)\b/iu,
];

const TRIAL_SCHEDULED_PATTERNS = [
  /\btrial\s+(day|job|route|call)\b/iu,
  /\b(first)\s+(job|route|call)\b/iu,
  /\btry\s+you\s+out\b/iu,
  /\bsee\s+how\s+you\s+do\b/iu,
];

function readOptionalEnv(key) {
  const value = process.env[key];
  return value ? value : null;
}

function normalizeOptionalString(value) {
  return String(value || "").trim();
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
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function buildRecordingDownloadCandidates(recordingUrl) {
  if (!recordingUrl) {
    return [];
  }

  const trimmed = String(recordingUrl).trim();

  if (!trimmed) {
    return [];
  }

  return trimmed.endsWith(".mp3") || trimmed.endsWith(".wav") ? [trimmed] : [`${trimmed}.mp3`, trimmed];
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

function getOpenAiConfig() {
  return {
    apiKey: readOptionalEnv("OPENAI_API_KEY"),
    transcriptionModel:
      readOptionalEnv("OPENAI_TRANSCRIPTION_MODEL") || DEFAULT_TRANSCRIPTION_MODEL,
    analysisModel: readOptionalEnv("OPENAI_CALL_ANALYSIS_MODEL") || DEFAULT_ANALYSIS_MODEL,
  };
}

export function isCallIntelligenceConfigured() {
  return Boolean(getOpenAiConfig().apiKey);
}

async function downloadTwilioRecording(payload, twilioConfig) {
  const recordingCandidates = buildRecordingDownloadCandidates(payload.RecordingUrl);
  const headers = {
    Authorization: buildTwilioAuthHeader(twilioConfig.accountSid, twilioConfig.authToken),
  };

  let lastError = null;

  for (const recordingUrl of recordingCandidates) {
    try {
      const response = await fetch(recordingUrl, { headers });

      if (!response.ok) {
        lastError = new Error(`Twilio recording download failed with status ${response.status}.`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.byteLength > MAX_AUDIO_BYTES) {
        throw new Error(
          `Recording is ${Math.round(buffer.byteLength / (1024 * 1024))} MB, above the 25 MB transcription limit.`,
        );
      }

      const contentType = inferAudioContentType(recordingUrl, response);

      return {
        buffer,
        contentType,
        filename: inferAudioFilename(recordingUrl, contentType),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to download the Twilio recording.");
}

async function transcribeRecordingAudio(recording) {
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
        "You analyze business phone calls for an appliance company. Some calls are customer service calls, and some are hiring or recruiting calls. Return strict JSON only. Be concise, factual, and never invent details. If a section or hiring field is not mentioned, return an empty string. Mark is_hiring true only when the transcript clearly shows a recruiting, applicant, technician hiring, resume, payout, availability, or job-offer discussion.",
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
                  "payout_expectation_summary",
                  "experience_summary",
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
                  payout_expectation_summary: { type: "string" },
                  experience_summary: { type: "string" },
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

function normalizeAnalysisResult(analysis, transcriptText = "") {
  const normalizedConversationType =
    analysis?.conversation_type === "hiring" || analysis?.conversation_type === "other"
      ? analysis.conversation_type
      : "service";
  const inferredHiringDecision = inferHiringDecisionFromTranscript(transcriptText);
  const normalizedHiringStage = HIRING_CANDIDATE_STAGES.has(analysis?.hiring_candidate?.stage)
    ? analysis.hiring_candidate.stage
    : "contacted";
  const isHired =
    Boolean(analysis?.hiring_candidate?.is_hired) ||
    normalizedHiringStage === "onboarded" ||
    inferredHiringDecision.isHired;
  const isHiringConversation =
    Boolean(analysis?.hiring_candidate?.is_hiring) || normalizedConversationType === "hiring";

  return {
    headline: normalizeOptionalString(analysis?.headline),
    highlights: normalizeOptionalString(analysis?.highlights),
    conversationType: normalizedConversationType,
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
      payoutExpectationSummary: normalizeOptionalString(
        analysis?.hiring_candidate?.payout_expectation_summary,
      ),
      experienceSummary: normalizeOptionalString(analysis?.hiring_candidate?.experience_summary),
      nextStep: normalizeOptionalString(analysis?.hiring_candidate?.next_step),
    },
  };
}

export async function transcribeAndAnalyzeTwilioRecording(payload, twilioConfig) {
  const recording = await downloadTwilioRecording(payload, twilioConfig);
  const transcriptText = await transcribeRecordingAudio(recording);
  const analysis = normalizeAnalysisResult(await analyzeTranscript(transcriptText), transcriptText);

  return {
    transcriptText,
    headline: analysis.headline,
    callHighlights: analysis.highlights,
    callSummarySections: analysis.sections,
    conversationType: analysis.conversationType,
    hiringCandidate: analysis.hiringCandidate,
  };
}

export async function analyzeTranscriptText(transcriptText) {
  const normalizedTranscript = normalizeOptionalString(transcriptText);

  if (!normalizedTranscript) {
    return null;
  }

  const analysis = normalizeAnalysisResult(
    await analyzeTranscript(normalizedTranscript),
    normalizedTranscript,
  );

  return {
    transcriptText: normalizedTranscript,
    headline: analysis.headline,
    callHighlights: analysis.highlights,
    callSummarySections: analysis.sections,
    conversationType: analysis.conversationType,
    hiringCandidate: analysis.hiringCandidate,
  };
}
