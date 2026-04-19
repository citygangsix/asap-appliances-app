import { useEffect, useMemo, useState } from "react";
import { DISPATCH_GROUPS } from "../lib/constants/status";
import { formatStatusLabel, getJobsForDispatchGroup, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

const DISPATCH_ACTION_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const ASSIGNMENT_FIELD_CLASS =
  "rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

function getLocalOperationsServerUrl(pathname) {
  const hostname =
    typeof window !== "undefined" && window.location?.hostname
      ? window.location.hostname
      : "127.0.0.1";

  return new URL(pathname, `http://${hostname}:8787`).toString();
}

async function requestDispatchEtaNotifications(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/dispatch/notify-eta"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    throw new Error(responseJson?.message || `Dispatch notifications failed with status ${response.status}.`);
  }

  return responseJson;
}

export function DispatchPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedAssignmentJobId, setSelectedAssignmentJobId] = useState(null);
  const [selectedAssignmentTechId, setSelectedAssignmentTechId] = useState("");
  const [etaWindowText, setEtaWindowText] = useState("");
  const [notifyTechnicianSms, setNotifyTechnicianSms] = useState(true);
  const [notifyTechnicianCall, setNotifyTechnicianCall] = useState(false);
  const [notifyCustomerSms, setNotifyCustomerSms] = useState(true);
  const [notifyCustomerCall, setNotifyCustomerCall] = useState(false);
  const [selectedEscalationJobId, setSelectedEscalationJobId] = useState(null);
  const [escalationNotes, setEscalationNotes] = useState("");
  const [escalationCustomerUpdated, setEscalationCustomerUpdated] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState(null);
  const [etaFeedback, setEtaFeedback] = useState(null);
  const [escalationFeedback, setEscalationFeedback] = useState(null);
  const [activeAssignmentJobId, setActiveAssignmentJobId] = useState(null);
  const [activeEtaJobId, setActiveEtaJobId] = useState(null);
  const [activeEscalationJobId, setActiveEscalationJobId] = useState(null);
  const { data, error, isLoading } = useAsyncValue(() => repository.getDispatchPageData(), [repository, refreshNonce]);

  const refreshBoard = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const jobRecords = data?.jobRecords || [];
  const technicians = data?.technicians || [];
  const unassignedJobs = data?.unassignedJobs || [];
  const attentionJobs = data?.attentionJobs || [];
  const assignmentJobs = useMemo(() => {
    const orderedJobs = [...unassignedJobs, ...jobRecords];
    const seenJobIds = new Set();

    return orderedJobs.filter((job) => {
      if (seenJobIds.has(job.jobId)) {
        return false;
      }

      seenJobIds.add(job.jobId);
      return true;
    });
  }, [jobRecords, unassignedJobs]);
  const selectedAssignmentJob =
    assignmentJobs.find((job) => job.jobId === selectedAssignmentJobId) || assignmentJobs[0] || null;
  const isAssignmentUnchanged = (selectedAssignmentJob?.techId || "") === selectedAssignmentTechId;
  const escalationJobs = useMemo(() => {
    const orderedJobs = [...attentionJobs, ...jobRecords];
    const seenJobIds = new Set();

    return orderedJobs.filter((job) => {
      if (seenJobIds.has(job.jobId)) {
        return false;
      }

      seenJobIds.add(job.jobId);
      return true;
    });
  }, [attentionJobs, jobRecords]);
  const selectedEscalationJob =
    escalationJobs.find((job) => job.jobId === selectedEscalationJobId) || escalationJobs[0] || null;
  const isSelectedEscalationAlreadyOpen =
    selectedEscalationJob?.dispatchStatus === "escalated" && selectedEscalationJob?.priority === "escalated";

  const focusEscalationQueue = () => {
    setSelectedEscalationJobId((attentionJobs[0] || escalationJobs[0] || selectedAssignmentJob || jobRecords[0])?.jobId || null);
    setEscalationFeedback(null);
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshBoard}>Refresh board</SecondaryButton>
      <PrimaryButton onClick={focusEscalationQueue}>Escalation queue</PrimaryButton>
    </>
  );

  useEffect(() => {
    if (!selectedAssignmentJobId && assignmentJobs[0]?.jobId) {
      setSelectedAssignmentJobId(assignmentJobs[0].jobId);
      return;
    }

    if (selectedAssignmentJobId && !assignmentJobs.some((job) => job.jobId === selectedAssignmentJobId)) {
      setSelectedAssignmentJobId(assignmentJobs[0]?.jobId || null);
    }
  }, [assignmentJobs, selectedAssignmentJobId]);

  useEffect(() => {
    setSelectedAssignmentTechId(selectedAssignmentJob?.techId || "");
  }, [selectedAssignmentJob?.jobId, selectedAssignmentJob?.techId]);

  useEffect(() => {
    if (!selectedAssignmentJob) {
      setEtaWindowText("");
      return;
    }

    setEtaWindowText(selectedAssignmentJob.etaLabel === "Not set" ? "" : selectedAssignmentJob.etaLabel);
  }, [selectedAssignmentJob?.jobId, selectedAssignmentJob?.etaLabel]);

  useEffect(() => {
    if (!selectedEscalationJobId && escalationJobs[0]?.jobId) {
      setSelectedEscalationJobId(escalationJobs[0].jobId);
      return;
    }

    if (selectedEscalationJobId && !escalationJobs.some((job) => job.jobId === selectedEscalationJobId)) {
      setSelectedEscalationJobId(escalationJobs[0]?.jobId || null);
    }
  }, [escalationJobs, selectedEscalationJobId]);

  useEffect(() => {
    setEscalationNotes("");
    setEscalationCustomerUpdated(Boolean(selectedEscalationJob?.customerUpdated));
  }, [selectedEscalationJob?.jobId, selectedEscalationJob?.customerUpdated]);

  if (isLoading) {
    return (
      <PageScaffold
        title="Dispatch"
        subtitle="Track assignment pressure, ETA confidence, and which jobs are slipping before customers call in."
        actions={actions}
        tabs={[{ label: "Live Board", active: true }, { label: "Escalations" }]}
        contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8"
      >
        <PageStateNotice title="Loading dispatch board" message="Fetching jobs and technician availability." />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold
        title="Dispatch"
        subtitle="Track assignment pressure, ETA confidence, and which jobs are slipping before customers call in."
        actions={actions}
        tabs={[{ label: "Live Board", active: true }, { label: "Escalations" }]}
        contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8"
      >
        <PageStateNotice
          title="Dispatch unavailable"
          message={error?.message || "Dispatch data could not be loaded."}
        />
      </PageScaffold>
    );
  }

  const runAssignment = async () => {
    if (!selectedAssignmentJob) {
      return;
    }

    setActiveAssignmentJobId(selectedAssignmentJob.jobId);

    try {
      const result = await repository.dispatch.assignTechnician(selectedAssignmentJob.jobId, {
        techId: selectedAssignmentTechId || null,
      });

      setAssignmentFeedback({
        message: result.message,
        tone:
          result.source === "mock"
            ? "amber"
            : result.ok
              ? "emerald"
              : "rose",
      });

      if (result.ok) {
        refreshBoard();
      }
    } catch (assignmentError) {
      setAssignmentFeedback({
        message: assignmentError.message,
        tone: "rose",
      });
    } finally {
      setActiveAssignmentJobId(null);
    }
  };

  const runEtaUpdate = async () => {
    if (!selectedAssignmentJob) {
      return;
    }

    const nextEtaWindowText = etaWindowText.trim();

    if (!nextEtaWindowText) {
      setEtaFeedback({
        message: "ETA text is required before dispatch notifications can be sent.",
        tone: "amber",
      });
      return;
    }

    setActiveEtaJobId(selectedAssignmentJob.jobId);

    try {
      const updateResult = await repository.dispatch.updateEta(selectedAssignmentJob.jobId, {
        etaWindowText: nextEtaWindowText,
        customerUpdated:
          notifyCustomerSms || notifyCustomerCall ? true : selectedAssignmentJob.customerUpdated,
      });

      if (!updateResult.ok) {
        setEtaFeedback({
          message: updateResult.message,
          tone: updateResult.source === "mock" ? "amber" : "rose",
        });
        return;
      }

      const notificationsRequested =
        notifyTechnicianSms || notifyTechnicianCall || notifyCustomerSms || notifyCustomerCall;

      if (!notificationsRequested) {
        setEtaFeedback({
          message: `${updateResult.message} No ETA notifications were selected.`,
          tone: updateResult.source === "mock" ? "amber" : "emerald",
        });
        refreshBoard();
        return;
      }

      const notificationResult = await requestDispatchEtaNotifications({
        jobId: selectedAssignmentJob.jobId,
        etaWindowText: nextEtaWindowText,
        notifyTechnician: {
          sms: notifyTechnicianSms,
          call: notifyTechnicianCall,
        },
        notifyCustomer: {
          sms: notifyCustomerSms,
          call: notifyCustomerCall,
        },
      });

      setEtaFeedback({
        message: `${updateResult.message} ${notificationResult.message}`,
        tone:
          notificationResult.ok
            ? "emerald"
            : updateResult.source === "mock"
              ? "amber"
              : "rose",
      });

      refreshBoard();
    } catch (etaError) {
      setEtaFeedback({
        message: etaError.message,
        tone: "rose",
      });
    } finally {
      setActiveEtaJobId(null);
    }
  };

  const runEscalation = async () => {
    if (!selectedEscalationJob) {
      return;
    }

    setActiveEscalationJobId(selectedEscalationJob.jobId);

    try {
      const result = await repository.dispatch.escalateJob(selectedEscalationJob.jobId, {
        customerUpdated: escalationCustomerUpdated,
        details: escalationNotes.trim() || null,
        summary:
          selectedEscalationJob.dispatchStatus === "late"
            ? "Late dispatch job escalated for office review."
            : "Job escalated for dispatch review.",
      });

      setEscalationFeedback({
        message: result.message,
        tone:
          result.source === "mock"
            ? "amber"
            : result.ok
              ? "emerald"
              : "rose",
      });

      if (result.ok) {
        refreshBoard();
      }
    } catch (escalationError) {
      setEscalationFeedback({
        message: escalationError.message,
        tone: "rose",
      });
    } finally {
      setActiveEscalationJobId(null);
    }
  };

  return (
    <PageScaffold
      title="Dispatch"
      subtitle="Track assignment pressure, ETA confidence, and which jobs are slipping before customers call in."
      actions={actions}
      tabs={[{ label: "Live Board", active: true }, { label: "Escalations" }]}
      contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8"
    >
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-title">Live jobs today</p>
            <h2 className="mt-2 text-lg font-semibold">Dispatch board</h2>
          </div>
          <Badge tone="indigo">Customer updates tracked</Badge>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-5">
          {jobRecords.length === 0 ? (
            <div className="xl:col-span-5">
              <PageStateNotice
                title="Dispatch board is empty"
                message="No active jobs were returned for the live board."
              />
            </div>
          ) : (
            DISPATCH_GROUPS.map((group) => (
              <div key={group} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold capitalize text-slate-800">{group.replace("_", " ")}</p>
                <div className="mt-4 space-y-3">
                  {getJobsForDispatchGroup(jobRecords, group).map((job) => (
                    <button
                      key={job.jobId}
                      onClick={() => setSelectedAssignmentJobId(job.jobId)}
                      className={`w-full rounded-2xl border bg-white p-3 text-left transition hover:border-slate-400 ${
                        selectedAssignmentJob?.jobId === job.jobId
                          ? "border-indigo-300 bg-indigo-50/70"
                          : "border-[#dce2ec]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{job.customer?.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{job.jobId}</p>
                      <p className="mt-2 text-sm text-slate-500">{job.technician?.name || "Unassigned"}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{job.etaLabel}</span>
                        <span>{job.customerUpdated ? "Updated" : "Not updated"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-6">
          <p className="section-title">Escalation queue</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Escalate dispatch risks</h2>
            <Badge tone="rose">{attentionJobs.length} in queue</Badge>
          </div>

          {escalationFeedback ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${DISPATCH_ACTION_TONES[escalationFeedback.tone]}`}>
              {escalationFeedback.message}
            </div>
          ) : null}

          {!selectedEscalationJob ? (
            <div className="mt-6">
              <PageStateNotice
                title="No dispatch jobs to escalate"
                message="Once the live board has jobs, escalation can be triggered here."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Job
                <select
                  value={selectedEscalationJob.jobId}
                  onChange={(event) => setSelectedEscalationJobId(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                >
                  {escalationJobs.map((job) => (
                    <option key={job.jobId} value={job.jobId}>
                      {job.customer?.name || "Unknown customer"} · {job.jobId} · {formatStatusLabel(job.dispatchStatus)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={getStatusTone(selectedEscalationJob.dispatchStatus)}>
                    {formatStatusLabel(selectedEscalationJob.dispatchStatus)}
                  </Badge>
                  <Badge tone={getStatusTone(selectedEscalationJob.priority)}>
                    {formatStatusLabel(selectedEscalationJob.priority)}
                  </Badge>
                </div>
                <p className="mt-3 font-medium text-slate-800">
                  {selectedEscalationJob.customer?.name || "Unknown customer"}
                </p>
                <p className="mt-1">{selectedEscalationJob.jobId}</p>
                <p className="mt-2">
                  ETA: {selectedEscalationJob.etaLabel} · {selectedEscalationJob.latenessLabel}
                </p>
                <p className="mt-2">{selectedEscalationJob.issueSummary}</p>
              </div>

              {isSelectedEscalationAlreadyOpen ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  This job is already escalated. The current UI blocks duplicate escalation writes to avoid extra timeline noise.
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-2xl border border-[#dce2ec] bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={escalationCustomerUpdated}
                  onChange={(event) => setEscalationCustomerUpdated(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                />
                Customer updated
              </label>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Escalation notes
                <textarea
                  value={escalationNotes}
                  onChange={(event) => setEscalationNotes(event.target.value)}
                  rows={4}
                  placeholder="Optional office note for why this dispatch job is being escalated."
                  className={`${ASSIGNMENT_FIELD_CLASS} resize-y`}
                />
              </label>

              <PrimaryButton
                onClick={runEscalation}
                disabled={
                  !selectedEscalationJob ||
                  isSelectedEscalationAlreadyOpen ||
                  activeEscalationJobId === selectedEscalationJob.jobId
                }
              >
                {activeEscalationJobId === selectedEscalationJob.jobId ? "Saving..." : "Escalate job"}
              </PrimaryButton>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="section-title">Technician assignment</p>
          <h2 className="mt-2 text-lg font-semibold">Assign live board jobs</h2>

          {assignmentFeedback ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${DISPATCH_ACTION_TONES[assignmentFeedback.tone]}`}>
              {assignmentFeedback.message}
            </div>
          ) : null}

          {!selectedAssignmentJob ? (
            <div className="mt-6">
              <PageStateNotice
                title="No dispatch jobs ready"
                message="Once the live board has jobs, you can assign them to technicians here."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Job
                <select
                  value={selectedAssignmentJob.jobId}
                  onChange={(event) => setSelectedAssignmentJobId(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                >
                  {assignmentJobs.map((job) => (
                    <option key={job.jobId} value={job.jobId}>
                      {job.customer?.name || "Unknown customer"} · {job.jobId} · {job.technician?.name || "Unassigned"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Technician
                <select
                  value={selectedAssignmentTechId}
                  onChange={(event) => setSelectedAssignmentTechId(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => (
                    <option key={tech.techId} value={tech.techId}>
                      {tech.name} · {tech.serviceArea}
                    </option>
                  ))}
                </select>
              </label>

              <PrimaryButton
                onClick={runAssignment}
                disabled={
                  !selectedAssignmentJob ||
                  activeAssignmentJobId === selectedAssignmentJob.jobId ||
                  isAssignmentUnchanged
                }
              >
                {activeAssignmentJobId === selectedAssignmentJob.jobId ? "Saving..." : "Save assignment"}
              </PrimaryButton>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{selectedAssignmentJob.customer?.name || "Unknown customer"}</p>
                <p className="mt-1">{selectedAssignmentJob.jobId}</p>
                <p className="mt-2">
                  Current technician: {selectedAssignmentJob.technician?.name || "Unassigned"}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-[#e7ebf2] pt-6">
            <p className="section-title">Live technician roster</p>
            <h3 className="mt-2 text-lg font-semibold">Availability board</h3>
          </div>

          <div className="mt-6 space-y-4">
            {technicians.length === 0 ? (
              <PageStateNotice
                title="No technicians available"
                message="Technician availability has not been loaded for this board yet."
              />
            ) : (
              technicians.map((tech) => (
                <div key={tech.techId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{tech.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{tech.availabilityLabel}</p>
                    </div>
                    <Badge tone={getStatusTone(tech.statusToday)}>{formatStatusLabel(tech.statusToday)}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">ETA notifications</p>
          <h2 className="mt-2 text-lg font-semibold">Text and call updates</h2>

          {etaFeedback ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${DISPATCH_ACTION_TONES[etaFeedback.tone]}`}>
              {etaFeedback.message}
            </div>
          ) : null}

          {!selectedAssignmentJob ? (
            <div className="mt-6">
              <PageStateNotice
                title="No job selected for ETA updates"
                message="Select a dispatch job first, then save the ETA update and notify the customer or technician."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{selectedAssignmentJob.customer?.name || "Unknown customer"}</p>
                <p className="mt-1">{selectedAssignmentJob.jobId}</p>
                <p className="mt-2">
                  Technician: {selectedAssignmentJob.technician?.name || "Unassigned"}
                </p>
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                ETA update text
                <input
                  value={etaWindowText}
                  onChange={(event) => setEtaWindowText(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                  placeholder="Arriving in 20 minutes"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#dce2ec] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Technician</p>
                  <div className="mt-4 space-y-3">
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={notifyTechnicianSms}
                        onChange={(event) => setNotifyTechnicianSms(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                      />
                      Send text
                    </label>
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={notifyTechnicianCall}
                        onChange={(event) => setNotifyTechnicianCall(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                      />
                      Place call
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#dce2ec] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Customer</p>
                  <div className="mt-4 space-y-3">
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={notifyCustomerSms}
                        onChange={(event) => setNotifyCustomerSms(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                      />
                      Send text
                    </label>
                    <label className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={notifyCustomerCall}
                        onChange={(event) => setNotifyCustomerCall(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                      />
                      Place call
                    </label>
                  </div>
                </div>
              </div>

              <PrimaryButton
                onClick={runEtaUpdate}
                disabled={!selectedAssignmentJob || activeEtaJobId === selectedAssignmentJob.jobId}
              >
                {activeEtaJobId === selectedAssignmentJob.jobId ? "Sending..." : "Save ETA and notify"}
              </PrimaryButton>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="section-title">Simple map</p>
          <h2 className="mt-2 text-lg font-semibold">Coverage placeholder</h2>
          <div className="mt-6 rounded-[28px] bg-[#202430] p-6 text-white">
            <div className="grid h-64 place-items-center rounded-[22px] border border-dashed border-white/20 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_34%)]">
              <div className="text-center">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Map preview</p>
                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">
                  Future map view for route clustering, ETA confidence, and territory balancing.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageScaffold>
  );
}
