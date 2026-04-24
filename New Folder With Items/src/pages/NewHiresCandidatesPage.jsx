import { useEffect, useState } from "react";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { Badge, Card, SecondaryButton } from "../components/ui";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import { formatStatusLabel } from "../lib/domain/jobs";

function isCandidateHired(candidate) {
  return candidate.stage === "onboarded" || Boolean(candidate.promotedTechId);
}

function CandidateStatus({ candidate }) {
  if (isCandidateHired(candidate)) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <span aria-hidden="true">✓</span>
        Hired
      </span>
    );
  }

  return <Badge tone="indigo">{formatStatusLabel(candidate.stage)}</Badge>;
}

export function NewHiresCandidatesPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getTechniciansPageData(),
    [repository, refreshNonce],
  );
  const candidates = data?.hiringCandidates || [];
  const selectedCandidate =
    candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ||
    candidates[0] ||
    null;

  useEffect(() => {
    if (!selectedCandidateId && candidates[0]?.candidateId) {
      setSelectedCandidateId(candidates[0].candidateId);
      return;
    }

    if (
      selectedCandidateId &&
      !candidates.some((candidate) => candidate.candidateId === selectedCandidateId)
    ) {
      setSelectedCandidateId(candidates[0]?.candidateId || null);
    }
  }, [candidates, selectedCandidateId]);

  return (
    <PageScaffold
      title="New Hires Candidates"
      subtitle="Recruiting calls that auto-populate from recorded hiring conversations."
      actions={<SecondaryButton onClick={() => setRefreshNonce((current) => current + 1)}>Refresh candidates</SecondaryButton>}
      tabs={[{ label: "New Hires Candidates", active: true }, { label: "Hired Technicians" }]}
      contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.92fr_1.08fr] lg:p-8"
    >
      {isLoading ? (
        <PageStateNotice title="Loading candidates" message="Fetching recorded hiring calls and candidate records." />
      ) : error || !data ? (
        <PageStateNotice
          title="Candidates unavailable"
          message={error?.message || "Candidate data could not be loaded."}
        />
      ) : (
        <>
          <div className="space-y-4">
            {candidates.length === 0 ? (
              <Card className="p-6">
                <PageStateNotice
                  title="No hiring candidates yet"
                  message="After a recorded hiring call is transcribed, new candidate records will land here."
                />
              </Card>
            ) : (
              candidates.map((candidate) => (
                <button
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedCandidate?.candidateId === candidate.candidateId
                      ? "border-indigo-300 bg-indigo-50/70"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  key={candidate.candidateId}
                  onClick={() => setSelectedCandidateId(candidate.candidateId)}
                  type="button"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{candidate.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {[candidate.primaryPhone, candidate.source].filter(Boolean).join(" · ") ||
                          "Hiring candidate"}
                      </p>
                    </div>
                    <CandidateStatus candidate={candidate} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {candidate.callHighlights || candidate.nextStep || "Transcript captured for review."}
                  </p>
                </button>
              ))
            )}
          </div>

          <Card className="p-6">
            {selectedCandidate ? (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="section-title">Candidate detail</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedCandidate.name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedCandidate.primaryPhone || "Phone not captured"} ·{" "}
                      {selectedCandidate.lastContactLabel}
                    </p>
                  </div>
                  <CandidateStatus candidate={selectedCandidate} />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Hiring status
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {isCandidateHired(selectedCandidate)
                        ? "Green check: technician is marked hired."
                        : formatStatusLabel(selectedCandidate.stage)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Starter packet
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.starterPacketSentAtLabel
                        ? `Sent by Twilio ${selectedCandidate.starterPacketSentAtLabel}`
                        : "Not sent yet."}
                    </p>
                    {selectedCandidate.starterPacketUrl ? (
                      <a
                        className="mt-2 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                        href={selectedCandidate.starterPacketUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open packet
                      </a>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Source
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.source || "Not captured"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Language / translation
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Original language: {selectedCandidate.originalLanguage || "English"}
                      {selectedCandidate.containsNonEnglish ? " · Translated and summarized in English" : ""}
                    </p>
                    {selectedCandidate.englishTranslationNote || selectedCandidate.englishKeyDetails ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        {selectedCandidate.englishTranslationNote || selectedCandidate.englishKeyDetails}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Experience
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.experienceSummary || "Not captured"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Availability
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.availabilitySummary || "Not captured"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Payout
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.payoutExpectationSummary || "Not captured"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Next step
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.nextStep || "No follow-up captured yet."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#e1e6ef] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Highlights
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {selectedCandidate.callHighlights || "No hiring summary captured yet."}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-[#e1e6ef] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Transcript
                  </p>
                  <p className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {selectedCandidate.transcriptText || "Transcript not available."}
                  </p>
                </div>
              </>
            ) : (
              <PageStateNotice
                title="Select a candidate"
                message="Captured hiring calls will appear here after transcription."
              />
            )}
          </Card>
        </>
      )}
    </PageScaffold>
  );
}
