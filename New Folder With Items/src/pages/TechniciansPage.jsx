import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatPercent } from "../lib/domain/finance";
import { formatStatusLabel, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";

const TECHNICIAN_FEEDBACK_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const RECORDED_BUSINESS_CALL_OPTIONS = [
  {
    id: "asap-main-4212",
    label: "Call from 844-542-4212",
    phone: "+18445424212",
  },
];

const MANUAL_CALL_PHONE_OPTIONS = [
  {
    id: "asap-main-4212",
    label: "844-542-4212",
    phone: "+18445424212",
  },
  {
    id: "assistant-1674",
    label: "561-878-1674",
    phone: "+15618781674",
  },
];

const MANUAL_CALL_OUTCOME_OPTIONS = [
  { value: "voicemail_left", label: "Voicemail left" },
  { value: "no_answer", label: "No answer" },
  { value: "connected", label: "Connected" },
];

const TECHNICIAN_FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

async function requestClickToCall(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/twilio/outbound/calls"), {
    method: "POST",
    headers: getLocalOperationsServerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let responseJson = null;

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch (error) {
      responseJson = null;
    }
  }

  if (!response.ok || !responseJson) {
    throw new Error(responseJson?.message || `Click-to-call failed with status ${response.status}.`);
  }

  if (!responseJson.ok) {
    throw new Error(responseJson.message || "Click-to-call failed.");
  }

  return responseJson;
}

function formatManualOutreachOutcome(value) {
  switch (value) {
    case "voicemail_left":
      return "Voicemail left";
    case "no_answer":
      return "No answer";
    case "connected":
      return "Connected";
    default:
      return "No manual outreach logged yet";
  }
}

async function requestManualCallLog(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/manual/calls/log"), {
    method: "POST",
    headers: getLocalOperationsServerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  const responseJson = responseText ? JSON.parse(responseText) : null;

  if (!response.ok || !responseJson?.ok) {
    throw new Error(responseJson?.message || `Manual call log failed with status ${response.status}.`);
  }

  return responseJson;
}

export function TechniciansPage() {
  const repository = getOperationsRepository();
  const manualCallSectionRef = useRef(null);
  const candidateNameInputRef = useRef(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeActionKey, setActiveActionKey] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [manualHiringCallDraft, setManualHiringCallDraft] = useState({
    candidateName: "",
    candidatePhone: "",
    email: "",
    agentPhone: MANUAL_CALL_PHONE_OPTIONS[0].phone,
    callOutcome: "voicemail_left",
    note: "",
  });
  const { data, error, isLoading } = useAsyncValue(() => repository.getTechniciansPageData(), [repository, refreshNonce]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const technicians = data?.technicians || [];
  const hiringCandidates = data?.hiringCandidates || [];
  const selectedCandidate =
    hiringCandidates.find((candidate) => candidate.candidateId === selectedCandidateId) ||
    hiringCandidates[0] ||
    null;

  const refreshRoster = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const focusTechnicianIntake = () => {
    setActionFeedback({
      message: "Add technician starts here. Enter a recruiting call note or use a captured hiring candidate below.",
      tone: "amber",
    });
    manualCallSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => candidateNameInputRef.current?.focus(), 250);
  };

  const runCandidateClickToCall = async (businessPhoneNumber) => {
    if (!selectedCandidate) {
      return;
    }

    if (!selectedCandidate.primaryPhone) {
      setActionFeedback({
        message: "This candidate does not have a phone number available for click-to-call.",
        tone: "amber",
      });
      return;
    }

    const actionKey = `candidate:call:${selectedCandidate.candidateId}:${businessPhoneNumber}`;
    setActiveActionKey(actionKey);

    try {
      const result = await requestClickToCall({
        customerName: selectedCandidate.name,
        customerPhone: selectedCandidate.primaryPhone,
        businessPhoneNumber,
        triggerSource: "manual_hiring_ui",
      });

      setActionFeedback({
        message:
          result.message ||
          `Twilio is calling the configured office phone first from ${businessPhoneNumber}. After you answer, the candidate leg will be recorded and analyzed automatically.`,
        tone: "emerald",
      });
    } catch (callError) {
      setActionFeedback({
        message: callError.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const runManualHiringCallLog = async () => {
    if (!manualHiringCallDraft.note.trim()) {
      setActionFeedback({
        message: "Add a short summary of what happened on the call before saving it.",
        tone: "amber",
      });
      return;
    }

    if (!manualHiringCallDraft.candidateName.trim() && !manualHiringCallDraft.candidatePhone.trim()) {
      setActionFeedback({
        message: "Add the candidate name or phone number so the recruiting CRM knows who this call was about.",
        tone: "amber",
      });
      return;
    }

    const actionKey = "candidate:manual-log";
    setActiveActionKey(actionKey);

    try {
      const result = await requestManualCallLog({
        mode: "hiring",
        candidateName: manualHiringCallDraft.candidateName,
        candidatePhone: manualHiringCallDraft.candidatePhone,
        email: manualHiringCallDraft.email,
        agentPhone: manualHiringCallDraft.agentPhone,
        callOutcome: manualHiringCallDraft.callOutcome,
        note: manualHiringCallDraft.note,
      });

      setActionFeedback({
        message: result.message,
        tone: "emerald",
      });
      setManualHiringCallDraft((current) => ({
        ...current,
        note: "",
      }));
      if (result.record?.candidate_id) {
        setSelectedCandidateId(result.record.candidate_id);
      }
      refreshRoster();
    } catch (callError) {
      setActionFeedback({
        message: callError.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshRoster}>Refresh roster</SecondaryButton>
      <PrimaryButton onClick={focusTechnicianIntake} disabled={isLoading || Boolean(error) || !data}>
        Add technician
      </PrimaryButton>
    </>
  );

  useEffect(() => {
    if (!selectedCandidateId && hiringCandidates[0]?.candidateId) {
      setSelectedCandidateId(hiringCandidates[0].candidateId);
      return;
    }

    if (
      selectedCandidateId &&
      !hiringCandidates.some((candidate) => candidate.candidateId === selectedCandidateId)
    ) {
      setSelectedCandidateId(hiringCandidates[0]?.candidateId || null);
    }
  }, [hiringCandidates, selectedCandidateId]);

  useEffect(() => {
    if (!selectedCandidate) {
      return;
    }

    setManualHiringCallDraft((current) => ({
      ...current,
      candidateName: selectedCandidate.name || current.candidateName,
      candidatePhone: selectedCandidate.primaryPhone || current.candidatePhone,
      email: selectedCandidate.email || current.email,
    }));
  }, [selectedCandidate]);

  if (isLoading) {
    return (
      <PageScaffold
        title="Technicians"
        subtitle="Field performance, current availability, and payout visibility in one place."
        actions={actions}
        tabs={[{ label: "Roster", active: true }, { label: "Scorecards" }]}
        contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8"
      >
        <PageStateNotice title="Loading technicians" message="Fetching technician roster and scorecards." />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold
        title="Technicians"
        subtitle="Field performance, current availability, and payout visibility in one place."
        actions={actions}
        tabs={[{ label: "Roster", active: true }, { label: "Scorecards" }]}
        contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8"
      >
        <PageStateNotice title="Technicians unavailable" message={error?.message || "Technician data could not be loaded."} />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Technicians"
      subtitle="Field performance, current availability, and payout visibility in one place."
      actions={actions}
      tabs={[{ label: "Roster", active: true }, { label: "Scorecards" }]}
      contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {technicians.map((tech) => (
            <Card key={tech.techId} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{tech.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{tech.serviceArea}</p>
                </div>
                <Badge tone={getStatusTone(tech.statusToday)}>{formatStatusLabel(tech.statusToday)}</Badge>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p>Phone: {tech.primaryPhone || "Not set"}</p>
                <p>Skills: {tech.skills.join(", ")}</p>
                <p>Hire start date: {tech.hireStartDateLabel || "Not set"}</p>
                <p>Availability: {tech.availabilityLabel}</p>
                <p>ZIP coverage: {tech.serviceZipCodes?.length || 0} ZIP codes</p>
                <p>
                  Avg dispatch response:{" "}
                  {tech.averageDispatchResponseMinutes !== null && tech.averageDispatchResponseMinutes !== undefined
                    ? `${tech.averageDispatchResponseMinutes} min`
                    : "No confirmations yet"}
                </p>
                <p>
                  Last dispatch response:{" "}
                  {tech.lastDispatchResponseMinutes !== null && tech.lastDispatchResponseMinutes !== undefined
                    ? `${tech.lastDispatchResponseMinutes} min`
                    : "No recent confirmation"}
                </p>
                <p>Pending dispatch confirmations: {tech.pendingDispatchConfirmationCount || 0}</p>
                <p>
                  Stayed-for-payment rate:{" "}
                  {tech.stayedForCollectionRatePercent !== null && tech.stayedForCollectionRatePercent !== undefined
                    ? `${tech.stayedForCollectionRatePercent}%`
                    : "Not tracked yet"}
                </p>
                <p>
                  Last collection behavior:{" "}
                  {tech.lastCollectionBehavior === "stayed"
                    ? "Stayed until collected"
                    : tech.lastCollectionBehavior === "left_early"
                      ? "Left before collection"
                      : "Unknown"}
                </p>
                <p>Jobs completed this week: {tech.jobsCompletedThisWeek}</p>
                <p>Callback rate: {formatPercent(tech.callbackRatePercent)}</p>
                <p>Payout total: {formatCurrency(tech.payoutTotal)}</p>
                <p>Gas reimbursement: {formatCurrency(tech.gasReimbursementTotal)}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <p className="section-title">Scorecard</p>
          <h2 className="mt-2 text-lg font-semibold">Technician accountability panel</h2>
          <div className="mt-6 space-y-5">
            {technicians.map((tech) => (
              <div key={tech.techId} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{tech.name}</p>
                  <p className="text-lg font-semibold text-slate-900">{tech.score}</p>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-indigo-500" style={{ width: `${tech.score}%` }} />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Weighted from callback rate, completed jobs, schedule discipline, and payout efficiency.
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <div ref={manualCallSectionRef} />
        <Card className="p-6">
          <p className="section-title">Off-system Call Fallback</p>
          <h2 className="mt-2 text-lg font-semibold">Manual recruiting call log</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Use this after a direct phone call or voicemail from your normal dialer. The CRM will save the note and update or create the hiring candidate record.
          </p>
          {actionFeedback ? (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                TECHNICIAN_FEEDBACK_TONES[actionFeedback.tone] || TECHNICIAN_FEEDBACK_TONES.amber
              }`}
            >
              {actionFeedback.message}
            </div>
          ) : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-600">
              Candidate name
              <input
                ref={candidateNameInputRef}
                value={manualHiringCallDraft.candidateName}
                onChange={(event) =>
                  setManualHiringCallDraft((current) => ({
                    ...current,
                    candidateName: event.target.value,
                  }))
                }
                className={TECHNICIAN_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Candidate phone
              <input
                value={manualHiringCallDraft.candidatePhone}
                onChange={(event) =>
                  setManualHiringCallDraft((current) => ({
                    ...current,
                    candidatePhone: event.target.value,
                  }))
                }
                className={TECHNICIAN_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Candidate email
              <input
                value={manualHiringCallDraft.email}
                onChange={(event) =>
                  setManualHiringCallDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className={TECHNICIAN_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Phone used
              <select
                value={manualHiringCallDraft.agentPhone}
                onChange={(event) =>
                  setManualHiringCallDraft((current) => ({
                    ...current,
                    agentPhone: event.target.value,
                  }))
                }
                className={TECHNICIAN_FIELD_CLASS}
              >
                {MANUAL_CALL_PHONE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.phone}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600 md:col-span-2">
              Outcome
              <select
                value={manualHiringCallDraft.callOutcome}
                onChange={(event) =>
                  setManualHiringCallDraft((current) => ({
                    ...current,
                    callOutcome: event.target.value,
                  }))
                }
                className={TECHNICIAN_FIELD_CLASS}
              >
                {MANUAL_CALL_OUTCOME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-600">
            What happened on the call?
            <textarea
              value={manualHiringCallDraft.note}
              onChange={(event) =>
                setManualHiringCallDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              rows={5}
              placeholder="Example: Called from 844-542-4212, candidate did not answer, left voicemail about appliance repair work in Broward and asked for callback."
              className={`${TECHNICIAN_FIELD_CLASS} resize-none`}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton
              onClick={runManualHiringCallLog}
              disabled={activeActionKey === "candidate:manual-log"}
            >
              {activeActionKey === "candidate:manual-log" ? "Saving call note..." : "Save off-system recruiting call"}
            </PrimaryButton>
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">Recruiting CRM</p>
          <h2 className="mt-2 text-lg font-semibold">Candidates captured from hiring calls</h2>
          {hiringCandidates.length === 0 ? (
            <div className="mt-6">
              <PageStateNotice
                title="No hiring calls captured yet"
                message="When recruiting conversations are transcribed, candidate availability, location, payout, and transcript details will land here automatically."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {hiringCandidates.map((candidate) => (
                <button
                  key={candidate.candidateId}
                  onClick={() => setSelectedCandidateId(candidate.candidateId)}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedCandidate?.candidateId === candidate.candidateId
                      ? "border-indigo-300 bg-indigo-50/70"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{candidate.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {candidate.promotedTechId ? <Badge tone="emerald">Added to roster</Badge> : null}
                      <Badge tone="indigo">{formatStatusLabel(candidate.stage)}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {[candidate.trade, candidate.city, candidate.source].filter(Boolean).join(" · ") || "Hiring lead"}
                  </p>
                  {candidate.manualOutreachTotalCalls ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Called {candidate.manualOutreachTotalCalls} time{candidate.manualOutreachTotalCalls === 1 ? "" : "s"}
                      {candidate.manualOutreachVoicemailLeftCount
                        ? ` · ${candidate.manualOutreachVoicemailLeftCount} voicemail${candidate.manualOutreachVoicemailLeftCount === 1 ? "" : "s"} left`
                        : ""}
                      {candidate.manualOutreachNoAnswerCount
                        ? ` · ${candidate.manualOutreachNoAnswerCount} no-answer attempt${candidate.manualOutreachNoAnswerCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {candidate.callHighlights || candidate.nextStep || "Transcript captured for review."}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selectedCandidate ? (
          <Card className="p-6">
            <p className="section-title">Candidate detail</p>
            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedCandidate.name}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Start a recorded CRM bridge from the ASAP business line for automatic recording, transcription, and CRM population after the conversation.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {RECORDED_BUSINESS_CALL_OPTIONS.map((option) => {
                  const actionKey = `candidate:call:${selectedCandidate.candidateId}:${option.phone}`;

                  return (
                    <PrimaryButton
                      key={option.id}
                      onClick={() => runCandidateClickToCall(option.phone)}
                      disabled={activeActionKey === actionKey || !selectedCandidate.primaryPhone}
                    >
                      {activeActionKey === actionKey ? "Calling candidate..." : option.label}
                    </PrimaryButton>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Start date</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.structuredStartDateLabel || "Not captured yet."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Availability</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.availabilitySummary || "Not captured yet."}
                </p>
                {(selectedCandidate.availabilityDays?.length ||
                  selectedCandidate.availabilityTimePreferences?.length) ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {[selectedCandidate.availabilityDays?.join(", "), selectedCandidate.availabilityTimePreferences?.join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current job</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.currentJobStatus || "Not captured yet."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tools / vehicle</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {[
                    selectedCandidate.toolsStatus ? `Tools: ${selectedCandidate.toolsStatus}` : null,
                    selectedCandidate.vehicleStatus ? `Vehicle: ${selectedCandidate.vehicleStatus}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Not captured yet."}
                </p>
                {selectedCandidate.toolsVehicleSummary ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {selectedCandidate.toolsVehicleSummary}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Location</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {[selectedCandidate.city, selectedCandidate.serviceArea].filter(Boolean).join(" · ") ||
                    "Not captured yet."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payout</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.payoutExpectationSummary || "Not captured yet."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Work experience</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.experienceSummary || "Not captured yet."}
                </p>
                {selectedCandidate.applianceExperienceSummary ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Appliance: {selectedCandidate.applianceExperienceSummary}
                  </p>
                ) : null}
                {selectedCandidate.otherWorkExperienceSummary ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Other: {selectedCandidate.otherWorkExperienceSummary}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next step</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.nextStep || "No follow-up captured yet."}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {selectedCandidate.promotedTechId
                    ? `Live roster sync completed${selectedCandidate.promotedAtLabel ? ` on ${selectedCandidate.promotedAtLabel}` : "."}`
                    : "Not yet added to the live technician roster."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Outreach status</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedCandidate.manualOutreachTotalCalls
                    ? `Candidate called ${selectedCandidate.manualOutreachTotalCalls} time${selectedCandidate.manualOutreachTotalCalls === 1 ? "" : "s"}.`
                    : "No off-system outreach logged yet."}
                </p>
                {selectedCandidate.manualOutreachTotalCalls ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {[
                      `${selectedCandidate.manualOutreachVoicemailLeftCount || 0} voicemail${selectedCandidate.manualOutreachVoicemailLeftCount === 1 ? "" : "s"} left`,
                      `${selectedCandidate.manualOutreachNoAnswerCount || 0} no-answer attempt${selectedCandidate.manualOutreachNoAnswerCount === 1 ? "" : "s"}`,
                      `${selectedCandidate.manualOutreachConnectedCount || 0} connected call${selectedCandidate.manualOutreachConnectedCount === 1 ? "" : "s"}`,
                    ].join(" · ")}
                  </p>
                ) : null}
                {selectedCandidate.manualOutreachLastOutcome ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Last outcome: {formatManualOutreachOutcome(selectedCandidate.manualOutreachLastOutcome)}
                    {selectedCandidate.manualOutreachLastAgentPhone
                      ? ` from ${selectedCandidate.manualOutreachLastAgentPhone}`
                      : ""}
                    {selectedCandidate.manualOutreachLastOccurredAtLabel
                      ? ` · ${selectedCandidate.manualOutreachLastOccurredAtLabel}`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e1e6ef] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Highlights</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {selectedCandidate.callHighlights || "No hiring summary captured yet."}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e1e6ef] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Transcript</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedCandidate.transcriptText || "Transcript not available."}
              </p>
            </div>

            <div className="mt-4 text-sm text-slate-500">
              Last contact: {selectedCandidate.lastContactLabel}
              {selectedCandidate.primaryPhone ? ` · ${selectedCandidate.primaryPhone}` : ""}
              {selectedCandidate.email ? ` · ${selectedCandidate.email}` : ""}
            </div>
          </Card>
        ) : null}
      </div>
    </PageScaffold>
  );
}
