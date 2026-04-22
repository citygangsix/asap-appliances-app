import { Badge } from "../ui";

const SECTION_CONFIG = [
  { key: "customerNeed", label: "Customer need" },
  { key: "applianceOrSystem", label: "Appliance / system" },
  { key: "schedulingAndLocation", label: "Scheduling / location" },
  { key: "partsAndWarranty", label: "Parts / warranty" },
  { key: "billingAndPayment", label: "Billing / payment" },
  { key: "followUpActions", label: "Follow-up actions" },
];

const TRANSCRIPTION_STATUS_TONES = {
  pending: "amber",
  completed: "emerald",
  failed: "rose",
};

function getTranscriptionStatusLabel(status) {
  if (status === "pending") {
    return "Transcription pending";
  }

  if (status === "failed") {
    return "Transcription failed";
  }

  return "Transcript ready";
}

function renderSectionValue(value, fallback = "Nothing captured yet.") {
  return value ? value : fallback;
}

export function CallInsightsPanel({
  communication,
  transcriptTitle = "Transcribed conversation",
  highlightsTitle = "Main call points",
}) {
  if (!communication) {
    return null;
  }

  const sections = communication.callSummarySections || null;
  const hasStructuredSections = SECTION_CONFIG.some((section) => sections?.[section.key]);
  const isPending = communication.transcriptionStatus === "pending";
  const hasFailed = communication.transcriptionStatus === "failed";

  return (
    <div className="space-y-4">
      {communication.transcriptionStatus ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={TRANSCRIPTION_STATUS_TONES[communication.transcriptionStatus] || "slate"}>
            {getTranscriptionStatusLabel(communication.transcriptionStatus)}
          </Badge>
          {hasFailed && communication.transcriptionError ? (
            <span className="text-sm text-rose-600">{communication.transcriptionError}</span>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {highlightsTitle}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {communication.callHighlights ||
            communication.extractedEventLabel ||
            communication.previewText ||
            (isPending ? "This call has been logged and is waiting to be transcribed." : "No call summary yet.")}
        </p>
      </div>

      <div className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {transcriptTitle}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {communication.transcriptText ||
            (isPending
              ? "The recording is waiting for transcription."
              : hasFailed
                ? "The transcript could not be generated for this call."
                : "No transcript available for this call.")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTION_CONFIG.map((section) => (
          <div
            key={section.key}
            className={`rounded-2xl border p-4 ${
              hasStructuredSections ? "border-[#e1e6ef] bg-slate-50" : "border-dashed border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {section.label}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {renderSectionValue(sections?.[section.key])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
