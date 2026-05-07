import { useCallback, useEffect, useState } from "react";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { Badge, Card, SecondaryButton } from "../components/ui";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import { requestLiveHiringCandidates } from "../lib/repositories/liveHiringCandidates";
import { formatStatusLabel } from "../lib/domain/jobs";

const LIVE_REFRESH_INTERVAL_MS = 15000;

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
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [liveCandidates, setLiveCandidates] = useState(null);
  const [liveCandidatesError, setLiveCandidatesError] = useState(null);
  const [isLiveCandidatesLoading, setIsLiveCandidatesLoading] = useState(true);
  const [lastLiveCandidatesFetchAt, setLastLiveCandidatesFetchAt] = useState(null);
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getTechniciansPageData(),
    [repository, refreshNonce],
  );
  const loadLiveCandidates = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLiveCandidatesLoading(true);
    }

    try {
      const result = await requestLiveHiringCandidates();
      setLiveCandidates(result.candidates);
      setLastLiveCandidatesFetchAt(result.fetchedAt);
      setLiveCandidatesError(null);
    } catch (liveError) {
      setLiveCandidatesError(liveError);
    } finally {
      setIsLiveCandidatesLoading(false);
    }
  }, []);
  const allCandidates = liveCandidates ?? data?.hiringCandidates ?? [];
  const hiredCandidates = allCandidates.filter(isCandidateHired);
  const candidates = activeTab === "hired" ? hiredCandidates : allCandidates;
  const selectedCandidate =
    candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ||
    candidates[0] ||
    null;
  const isPageLoading = isLoading && isLiveCandidatesLoading && !liveCandidates;
  const pageError = liveCandidates ? null : liveCandidatesError || error;
  const lastLiveSyncLabel = lastLiveCandidatesFetchAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(lastLiveCandidatesFetchAt))
    : null;

  const handleRefresh = useCallback(() => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
    loadLiveCandidates();
  }, [loadLiveCandidates, repository]);

  useEffect(() => {
    loadLiveCandidates();
    const intervalId = window.setInterval(
      () => loadLiveCandidates({ silent: true }),
      LIVE_REFRESH_INTERVAL_MS,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadLiveCandidates({ silent: true });
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadLiveCandidates]);

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
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {lastLiveSyncLabel ? (
            <span className="text-sm font-medium text-slate-500">Live sync {lastLiveSyncLabel}</span>
          ) : null}
          <SecondaryButton onClick={handleRefresh}>
            {isLiveCandidatesLoading ? "Refreshing..." : "Refresh candidates"}
          </SecondaryButton>
        </div>
      }
      tabs={[
        {
          id: "all",
          label: `New Hires Candidates (${allCandidates.length})`,
          active: activeTab === "all",
          onClick: () => setActiveTab("all"),
        },
        {
          id: "hired",
          label: `Hired Technicians (${hiredCandidates.length})`,
          active: activeTab === "hired",
          onClick: () => setActiveTab("hired"),
        },
      ]}
      contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.92fr_1.08fr] lg:p-8"
    >
      {isPageLoading ? (
        <PageStateNotice title="Loading candidates" message="Fetching recorded hiring calls and candidate records." />
      ) : pageError && candidates.length === 0 ? (
        <PageStateNotice
          title="Candidates unavailable"
          message={pageError?.message || "Candidate data could not be loaded."}
        />
      ) : (
        <>
          <div className="space-y-4">
            {candidates.length === 0 ? (
              <Card className="p-6">
                <PageStateNotice
                  title={activeTab === "hired" ? "No hired technicians yet" : "No hiring candidates yet"}
                  message={
                    activeTab === "hired"
                      ? "When a candidate is promoted to the technician roster, they will show here with a green check."
                      : "After a recorded hiring call is transcribed, new candidate records will land here."
                  }
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
                      Current job status
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {selectedCandidate.currentJobStatus || "Not captured"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Tools / vehicle
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {[
                        selectedCandidate.toolsStatus ? `Tools: ${selectedCandidate.toolsStatus}` : null,
                        selectedCandidate.vehicleStatus
                          ? `Vehicle: ${selectedCandidate.vehicleStatus}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Not captured"}
                    </p>
                    {selectedCandidate.toolsVehicleSummary ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        {selectedCandidate.toolsVehicleSummary}
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
                    {selectedCandidate.applianceExperienceSummary ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        Appliance: {selectedCandidate.applianceExperienceSummary}
                      </p>
                    ) : null}
                    {selectedCandidate.otherWorkExperienceSummary ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        Other: {selectedCandidate.otherWorkExperienceSummary}
                      </p>
                    ) : null}
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
