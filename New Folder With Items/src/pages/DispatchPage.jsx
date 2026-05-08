import { useEffect, useMemo, useRef, useState } from "react";
import { DISPATCH_GROUPS } from "../lib/constants/status";
import { formatStatusLabel, getJobsForDispatchGroup, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { DispatchMapWorkspace } from "../components/dispatch/DispatchMapWorkspace";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import { buildMasterDispatchRecommendation } from "../lib/domain/masterDispatch";
import { extractZipCode } from "../lib/domain/technicianCoverage";
import {
  buildDefaultVehicleProfile,
  buildDispatchMapPoints,
  buildDispatchRoutePlans,
  buildLeadRecommendations,
  calculateFuelReimbursement,
  formatMiles,
  formatMoney,
  getAvailableRouteDates,
  getTomorrowDateKey,
} from "../lib/domain/dispatchRouting";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";

const DISPATCH_ACTION_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const ASSIGNMENT_FIELD_CLASS =
  "rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

function formatCandidateMiles(candidate) {
  return Number.isFinite(candidate.directMiles) ? formatMiles(candidate.directMiles) : "Unknown";
}

function MasterDispatchCandidateCard({ candidate, label, selected, onStage }) {
  const isFarCandidate = ["Far but possible", "Last-resort distance"].includes(candidate.distanceLabel);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        selected ? "border-indigo-300 bg-indigo-50/80" : "border-[#dce2ec] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={label === "Primary" ? "indigo" : isFarCandidate ? "amber" : "slate"}>
              {label}
            </Badge>
            {candidate.isCurrentWorkerStale ? <Badge tone="rose">No response</Badge> : null}
            {candidate.exactZipMatch ? <Badge tone="emerald">ZIP owner</Badge> : null}
          </div>
          <p className="mt-3 font-semibold text-slate-950">{candidate.technician.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {candidate.distanceLabel} · {formatCandidateMiles(candidate)} · Score {candidate.score}
          </p>
        </div>
        <button
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#cfd6e2] bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => onStage(candidate)}
          type="button"
        >
          Stage
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {candidate.reasons.slice(0, 4).map((reason) => (
          <span
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
            key={`${candidate.techId}-${reason}`}
          >
            {reason}
          </span>
        ))}
      </div>
    </div>
  );
}

async function requestDispatchEtaNotifications(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/workflows/dispatch"), {
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
    throw new Error(responseJson?.message || `Dispatch notifications failed with status ${response.status}.`);
  }

  return responseJson;
}

async function requestFinalWorkWorkflow(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/workflows/final-work"), {
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
    throw new Error(responseJson?.message || `Final work workflow failed with status ${response.status}.`);
  }

  return responseJson;
}

export function DispatchPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedAssignmentJobId, setSelectedAssignmentJobId] = useState(null);
  const [selectedAssignmentTechId, setSelectedAssignmentTechId] = useState("");
  const [etaAtInput, setEtaAtInput] = useState("");
  const [etaWindowText, setEtaWindowText] = useState("");
  const [notifyTechnicianSms, setNotifyTechnicianSms] = useState(true);
  const [notifyTechnicianCall, setNotifyTechnicianCall] = useState(false);
  const [notifyCustomerSms, setNotifyCustomerSms] = useState(true);
  const [notifyCustomerCall, setNotifyCustomerCall] = useState(false);
  const [technicianConfirmedGoing, setTechnicianConfirmedGoing] = useState(false);
  const [technicianConfirmationResponse, setTechnicianConfirmationResponse] = useState("");
  const [paymentCollectedBeforeTechLeft, setPaymentCollectedBeforeTechLeft] = useState(false);
  const [laborAmount, setLaborAmount] = useState("150");
  const [finalWorkNotes, setFinalWorkNotes] = useState("");
  const [selectedEscalationJobId, setSelectedEscalationJobId] = useState(null);
  const [escalationNotes, setEscalationNotes] = useState("");
  const [escalationCustomerUpdated, setEscalationCustomerUpdated] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState(null);
  const [etaFeedback, setEtaFeedback] = useState(null);
  const [finalWorkFeedback, setFinalWorkFeedback] = useState(null);
  const [escalationFeedback, setEscalationFeedback] = useState(null);
  const [activeAssignmentJobId, setActiveAssignmentJobId] = useState(null);
  const [activeEtaJobId, setActiveEtaJobId] = useState(null);
  const [activeFinalWorkJobId, setActiveFinalWorkJobId] = useState(null);
  const [activeEscalationJobId, setActiveEscalationJobId] = useState(null);
  const [selectedRouteDateKey, setSelectedRouteDateKey] = useState("all");
  const [includeReturnToBase, setIncludeReturnToBase] = useState(true);
  const [activeRouteTechId, setActiveRouteTechId] = useState("");
  const [vehicleProfilesByTechId, setVehicleProfilesByTechId] = useState({});
  const [routeShareFeedback, setRouteShareFeedback] = useState(null);
  const [stagedRouteAssignment, setStagedRouteAssignment] = useState(null);
  const [activeDispatchSection, setActiveDispatchSection] = useState("map");
  const mapSectionRef = useRef(null);
  const routeSectionRef = useRef(null);
  const boardSectionRef = useRef(null);
  const escalationSectionRef = useRef(null);
  const { data, error, isLoading } = useAsyncValue(() => repository.getDispatchPageData(), [repository, refreshNonce]);

  const refreshBoard = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const jobRecords = data?.jobRecords || [];
  const technicians = data?.technicians || [];
  const unassignedJobs = data?.unassignedJobs || [];
  const attentionJobs = data?.attentionJobs || [];
  const routeDateKey = selectedRouteDateKey === "all" ? null : selectedRouteDateKey;
  const availableRouteDates = useMemo(() => getAvailableRouteDates(jobRecords), [jobRecords]);
  const routeDateOptions = useMemo(() => {
    const tomorrowDateKey = getTomorrowDateKey();
    const optionMap = new Map([
      ["all", "All active jobs"],
      [tomorrowDateKey, `Tomorrow (${tomorrowDateKey})`],
    ]);

    availableRouteDates.forEach((dateKey) => {
      if (!optionMap.has(dateKey)) {
        optionMap.set(dateKey, dateKey);
      }
    });

    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }, [availableRouteDates]);
  const mapPoints = useMemo(
    () => buildDispatchMapPoints({ jobs: jobRecords, technicians }),
    [jobRecords, technicians],
  );
  const routePlans = useMemo(
    () =>
      buildDispatchRoutePlans({
        jobs: jobRecords,
        technicians,
        routeDateKey,
        includeReturnToBase,
      }),
    [jobRecords, technicians, routeDateKey, includeReturnToBase],
  );
  const leadRecommendations = useMemo(
    () =>
      buildLeadRecommendations({
        jobs: jobRecords,
        routePlans,
        routeDateKey,
        includeReturnToBase,
      }),
    [jobRecords, routePlans, routeDateKey, includeReturnToBase],
  );
  const activeRoutePlan =
    routePlans.find((plan) => plan.techId === activeRouteTechId) ||
    routePlans.find((plan) => plan.stopCount > 0) ||
    routePlans[0] ||
    null;
  const activeVehicleProfile = activeRoutePlan
    ? vehicleProfilesByTechId[activeRoutePlan.techId] || buildDefaultVehicleProfile(activeRoutePlan.technician)
    : null;
  const activeFuelMath =
    activeRoutePlan && activeVehicleProfile
      ? calculateFuelReimbursement(activeRoutePlan.totalMiles, activeVehicleProfile)
      : null;
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
  const selectedAssignmentJobZipCode = selectedAssignmentJob
    ? extractZipCode(selectedAssignmentJob.serviceAddress)
    : null;
  const masterDispatchRecommendation = useMemo(
    () =>
      buildMasterDispatchRecommendation({
        job: selectedAssignmentJob,
        jobs: jobRecords,
        technicians,
        routePlans,
      }),
    [selectedAssignmentJob, jobRecords, technicians, routePlans],
  );
  const recommendedAssignmentTech = masterDispatchRecommendation?.primary?.technician || null;
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

  const stageLeadAssignment = (jobId, techId) => {
    setStagedRouteAssignment({ jobId, techId });
    setSelectedAssignmentJobId(jobId);
    setSelectedAssignmentTechId(techId);
    setActiveRouteTechId(techId);
    setAssignmentFeedback({
      message: "Route recommendation staged. Review the assignment panel, then save when ready.",
      tone: "emerald",
    });
  };

  const stageMasterDispatchCandidate = (candidate) => {
    setStagedRouteAssignment({ jobId: selectedAssignmentJob?.jobId || null, techId: candidate.techId });
    setSelectedAssignmentTechId(candidate.techId);
    setActiveRouteTechId(candidate.techId);
    setAssignmentFeedback({
      message: `${candidate.technician.name} staged as the next dispatch worker.`,
      tone: "emerald",
    });
  };

  const updateActiveVehicleProfile = (field, value) => {
    if (!activeRoutePlan) {
      return;
    }

    setVehicleProfilesByTechId((current) => ({
      ...current,
      [activeRoutePlan.techId]: {
        ...buildDefaultVehicleProfile(activeRoutePlan.technician),
        ...(current[activeRoutePlan.techId] || {}),
        [field]: field === "vehicleLabel" ? value : Number(value),
      },
    }));
  };

  const copyActiveRouteMessage = async () => {
    if (!activeRoutePlan?.shareMessage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeRoutePlan.shareMessage);
      setRouteShareFeedback({ tone: "emerald", message: "Route message copied for dispatch." });
    } catch (clipboardError) {
      setRouteShareFeedback({
        tone: "amber",
        message: "Clipboard access was blocked. Use the map links or text route button instead.",
      });
    }
  };

  const jumpToDispatchSection = (section, ref) => {
    setActiveDispatchSection(section);
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    setSelectedAssignmentTechId(
      stagedRouteAssignment && stagedRouteAssignment.jobId === selectedAssignmentJob?.jobId
        ? stagedRouteAssignment.techId
        : masterDispatchRecommendation?.shouldBypassCurrentWorker
          ? masterDispatchRecommendation?.primary?.techId || ""
          : selectedAssignmentJob?.techId || recommendedAssignmentTech?.techId || "",
    );
  }, [
    selectedAssignmentJob?.jobId,
    selectedAssignmentJob?.techId,
    masterDispatchRecommendation?.primary?.techId,
    masterDispatchRecommendation?.shouldBypassCurrentWorker,
    recommendedAssignmentTech?.techId,
    stagedRouteAssignment?.jobId,
    stagedRouteAssignment?.techId,
  ]);

  useEffect(() => {
    setVehicleProfilesByTechId((current) => {
      const nextProfiles = { ...current };
      let changed = false;

      technicians.forEach((technician) => {
        if (!nextProfiles[technician.techId]) {
          nextProfiles[technician.techId] = buildDefaultVehicleProfile(technician);
          changed = true;
        }
      });

      return changed ? nextProfiles : current;
    });
  }, [technicians]);

  useEffect(() => {
    if (!routePlans.length) {
      setActiveRouteTechId("");
      return;
    }

    if (!activeRouteTechId || !routePlans.some((plan) => plan.techId === activeRouteTechId)) {
      setActiveRouteTechId(routePlans.find((plan) => plan.stopCount > 0)?.techId || routePlans[0].techId);
    }
  }, [routePlans, activeRouteTechId]);

  useEffect(() => {
    if (!selectedAssignmentJob) {
      setEtaAtInput("");
      setEtaWindowText("");
      setFinalWorkNotes("");
      setTechnicianConfirmedGoing(false);
      setTechnicianConfirmationResponse("");
      setPaymentCollectedBeforeTechLeft(false);
      return;
    }

    setEtaWindowText(selectedAssignmentJob.etaLabel === "Not set" ? "" : selectedAssignmentJob.etaLabel);
    setTechnicianConfirmedGoing(Boolean(selectedAssignmentJob.dispatchConfirmationReceivedAt));
    setTechnicianConfirmationResponse(selectedAssignmentJob.technicianConfirmationResponse || "");
    setPaymentCollectedBeforeTechLeft(Boolean(selectedAssignmentJob.paymentCollectedBeforeTechLeft));
  }, [
    selectedAssignmentJob?.jobId,
    selectedAssignmentJob?.etaLabel,
    selectedAssignmentJob?.dispatchConfirmationReceivedAt,
    selectedAssignmentJob?.technicianConfirmationResponse,
    selectedAssignmentJob?.paymentCollectedBeforeTechLeft,
  ]);

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
        setStagedRouteAssignment(null);
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
    let nextEtaAt = null;

    if (etaAtInput.trim()) {
      const parsedEtaDate = new Date(etaAtInput);

      if (Number.isNaN(parsedEtaDate.getTime())) {
        setEtaFeedback({
          message: "Arrival time must be a valid date and time.",
          tone: "amber",
        });
        return;
      }

      nextEtaAt = parsedEtaDate.toISOString();
    }

    if (!nextEtaWindowText) {
      setEtaFeedback({
        message: "ETA text is required before dispatch notifications can be sent.",
        tone: "amber",
      });
      return;
    }

    if (technicianConfirmedGoing && !selectedAssignmentJob.techId) {
      setEtaFeedback({
        message: "Assign a technician before logging ETA confirmation for this job.",
        tone: "amber",
      });
      return;
    }

    if (technicianConfirmedGoing && !technicianConfirmationResponse.trim()) {
      setEtaFeedback({
        message: "Capture the technician response before sending the office ETA confirmation alert.",
        tone: "amber",
      });
      return;
    }

    setActiveEtaJobId(selectedAssignmentJob.jobId);

    try {
      const updateResult = await repository.dispatch.updateEta(selectedAssignmentJob.jobId, {
        etaAt: nextEtaAt,
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
        notifyTechnicianSms ||
        notifyTechnicianCall ||
        notifyCustomerSms ||
        notifyCustomerCall ||
        technicianConfirmedGoing;

      if (!notificationsRequested) {
        setEtaFeedback({
          message: `${updateResult.message} No ETA notifications or technician confirmations were selected.`,
          tone: updateResult.source === "mock" ? "amber" : "emerald",
        });
        refreshBoard();
        return;
      }

      const notificationResult = await requestDispatchEtaNotifications({
        jobId: selectedAssignmentJob.jobId,
        etaAt: nextEtaAt,
        etaWindowText: nextEtaWindowText,
        customerLeadMinutes: 60,
        notifyTechnician: {
          sms: notifyTechnicianSms,
          call: notifyTechnicianCall,
        },
        notifyCustomer: {
          sms: notifyCustomerSms,
          call: notifyCustomerCall,
        },
        technicianConfirmation: {
          confirmedGoing: technicianConfirmedGoing,
          response: technicianConfirmationResponse.trim() || null,
          paymentCollectedBeforeTechLeft: technicianConfirmedGoing
            ? paymentCollectedBeforeTechLeft
            : null,
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

  const runFinalWorkWorkflow = async () => {
    if (!selectedAssignmentJob) {
      return;
    }

    const nextLaborAmount = Number.parseFloat(laborAmount);

    if (!Number.isFinite(nextLaborAmount) || nextLaborAmount <= 0) {
      setFinalWorkFeedback({
        message: "Labor amount must be greater than zero.",
        tone: "amber",
      });
      return;
    }

    setActiveFinalWorkJobId(selectedAssignmentJob.jobId);

    try {
      const workflowResult = await requestFinalWorkWorkflow({
        jobId: selectedAssignmentJob.jobId,
        laborAmount: nextLaborAmount,
        notes: finalWorkNotes.trim() || null,
      });

      setFinalWorkFeedback({
        message: workflowResult.message,
        tone: workflowResult.ok ? "emerald" : "amber",
      });

      if (workflowResult.ok) {
        refreshBoard();
      }
    } catch (workflowError) {
      setFinalWorkFeedback({
        message: workflowError.message,
        tone: "rose",
      });
    } finally {
      setActiveFinalWorkJobId(null);
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
      subtitle="Map workers, place incoming leads, build lowest-mileage routes, and prepare technician route links."
      actions={actions}
      tabs={[
        {
          label: "Map Workspace",
          active: activeDispatchSection === "map",
          onClick: () => jumpToDispatchSection("map", mapSectionRef),
        },
        {
          label: "Route Builder",
          active: activeDispatchSection === "routes",
          onClick: () => jumpToDispatchSection("routes", routeSectionRef),
        },
        {
          label: "Live Board",
          active: activeDispatchSection === "board",
          onClick: () => jumpToDispatchSection("board", boardSectionRef),
        },
        {
          label: "Escalations",
          active: activeDispatchSection === "escalations",
          onClick: () => jumpToDispatchSection("escalations", escalationSectionRef),
        },
      ]}
      contentClassName="space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <div ref={mapSectionRef} className="scroll-mt-6">
        <DispatchMapWorkspace
          activeRouteTechId={activeRouteTechId}
          jobs={jobRecords}
          leadRecommendations={leadRecommendations}
          mapPoints={mapPoints}
          onSelectJob={(jobId) => setSelectedAssignmentJobId(jobId)}
          onSelectRouteTechnician={(techId) => setActiveRouteTechId(techId)}
          onSelectTechnician={(techId) => {
            setSelectedAssignmentTechId(techId);
            setActiveRouteTechId(techId);
          }}
          onStageLead={stageLeadAssignment}
          routePlans={routePlans}
          selectedJobId={selectedAssignmentJob?.jobId || null}
          selectedTechId={activeRouteTechId || selectedAssignmentTechId}
          technicians={technicians}
        />
      </div>

      <div ref={routeSectionRef} className="grid scroll-mt-6 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-title">Route builder</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Lowest-mileage daily routes</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Routes are ordered by estimated driving miles, then turned into Google Maps, Apple Maps, and text-message links for the technician.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Route day
                <select
                  value={selectedRouteDateKey}
                  onChange={(event) => setSelectedRouteDateKey(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                >
                  {routeDateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-[#dce2ec] bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeReturnToBase}
                  onChange={(event) => setIncludeReturnToBase(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                />
                Include return drive
              </label>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {routePlans.map((plan) => (
              <button
                key={plan.techId}
                type="button"
                onClick={() => setActiveRouteTechId(plan.techId)}
                className={`rounded-2xl border p-4 text-left transition hover:border-indigo-300 ${
                  activeRoutePlan?.techId === plan.techId
                    ? "border-indigo-300 bg-indigo-50/70"
                    : "border-[#dce2ec] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{plan.technicianName}</p>
                    <p className="mt-1 text-sm text-slate-500">{plan.stopCount} route stops</p>
                  </div>
                  <Badge tone={plan.stopCount ? "indigo" : "slate"}>{formatMiles(plan.totalMiles)}</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {plan.stops.slice(0, 3).map((stop, index) => (
                    <p key={stop.id} className="text-sm text-slate-600">
                      {index + 1}. {stop.customerName} · {stop.scheduledStartLabel}
                    </p>
                  ))}
                  {plan.stops.length > 3 ? (
                    <p className="text-sm font-medium text-indigo-700">+{plan.stops.length - 3} more stops</p>
                  ) : null}
                  {plan.stops.length === 0 ? (
                    <p className="text-sm text-slate-500">No scheduled stops for this route day.</p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          {activeRoutePlan ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activeRoutePlan.technicianName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatMiles(activeRoutePlan.totalMiles)} total · {activeRoutePlan.stopCount} stops
                    </p>
                  </div>
                  <Badge tone={getStatusTone(activeRoutePlan.technician.statusToday)}>
                    {formatStatusLabel(activeRoutePlan.technician.statusToday)}
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {activeRoutePlan.legs.length === 0 ? (
                    <p className="text-sm text-slate-500">Assign jobs or pick another route day to generate a route.</p>
                  ) : (
                    activeRoutePlan.legs.map((leg, index) => (
                      <div key={`${leg.to.label}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {index + 1}. {leg.to.customerName || leg.to.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {leg.from.label} to {leg.to.address || leg.to.label}
                        </p>
                        <p className="mt-2 text-sm text-indigo-700">{formatMiles(leg.miles)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#dce2ec] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Route links</p>
                {routeShareFeedback ? (
                  <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${DISPATCH_ACTION_TONES[routeShareFeedback.tone]}`}>
                    {routeShareFeedback.message}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeRoutePlan.mapsLinks.googleMapsUrl ? (
                    <a
                      className="inline-flex min-h-11 items-center rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
                      href={activeRoutePlan.mapsLinks.googleMapsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Google Maps
                    </a>
                  ) : null}
                  {activeRoutePlan.mapsLinks.appleMapsUrl ? (
                    <a
                      className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd6e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      href={activeRoutePlan.mapsLinks.appleMapsUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Apple Maps
                    </a>
                  ) : null}
                  {activeRoutePlan.smsUrl ? (
                    <a
                      className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd6e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      href={activeRoutePlan.smsUrl}
                    >
                      Text tech
                    </a>
                  ) : null}
                  <SecondaryButton className="rounded-xl py-2" onClick={copyActiveRouteMessage}>
                    Copy route
                  </SecondaryButton>
                </div>

                <textarea
                  readOnly
                  rows={8}
                  value={activeRoutePlan.shareMessage || "No route is available yet."}
                  className="mt-4 w-full resize-y rounded-xl border border-[#dce2ec] bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600 outline-none"
                />
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <p className="section-title">Gas reimbursement</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">Vehicle fuel profile</h2>

          {!activeRoutePlan || !activeFuelMath || !activeVehicleProfile ? (
            <div className="mt-6">
              <PageStateNotice
                title="No active route"
                message="Select a technician route before calculating fuel reimbursement."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{activeRoutePlan.technicianName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatMiles(activeFuelMath.miles)} · {activeFuelMath.gallonsUsed.toFixed(2)} gallons · {activeFuelMath.tankPercentUsed.toFixed(0)}% tank
                </p>
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Vehicle
                <input
                  value={activeVehicleProfile.vehicleLabel}
                  onChange={(event) => updateActiveVehicleProfile("vehicleLabel", event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  MPG
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={activeVehicleProfile.milesPerGallon}
                    onChange={(event) => updateActiveVehicleProfile("milesPerGallon", event.target.value)}
                    className={ASSIGNMENT_FIELD_CLASS}
                  />
                </label>

                <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Tank gallons
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={activeVehicleProfile.tankGallons}
                    onChange={(event) => updateActiveVehicleProfile("tankGallons", event.target.value)}
                    className={ASSIGNMENT_FIELD_CLASS}
                  />
                </label>

                <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Fuel price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={activeVehicleProfile.fuelPricePerGallon}
                    onChange={(event) => updateActiveVehicleProfile("fuelPricePerGallon", event.target.value)}
                    className={ASSIGNMENT_FIELD_CLASS}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-indigo-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Per mile</p>
                  <p className="mt-2 text-2xl font-semibold text-indigo-700">
                    {formatMoney(activeFuelMath.costPerMile)}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Pay gas</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">
                    {formatMoney(activeFuelMath.reimbursementAmount)}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-500">
                Estimated range: {formatMiles(activeFuelMath.estimatedTankRangeMiles)} per tank. Live GPS mileage and persisted vehicle records can plug into this same calculator when those fields are added to Supabase.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div ref={boardSectionRef} className="grid scroll-mt-6 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
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
                      type="button"
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
        <div ref={escalationSectionRef} className="scroll-mt-6">
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
        </div>

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

              {masterDispatchRecommendation?.primary ? (
                <div className="rounded-2xl border border-[#dce2ec] bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="section-title">Master dispatcher</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-950">
                        {masterDispatchRecommendation.headline}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {masterDispatchRecommendation.instruction}
                      </p>
                    </div>
                    <Badge tone={masterDispatchRecommendation.shouldBypassCurrentWorker ? "rose" : "emerald"}>
                      {masterDispatchRecommendation.shouldBypassCurrentWorker ? "Reassign now" : "Primary ready"}
                    </Badge>
                  </div>

                  {masterDispatchRecommendation.currentWorker?.isCurrentWorkerStale ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {masterDispatchRecommendation.currentWorker.technician.name} has not confirmed for{" "}
                      {masterDispatchRecommendation.currentResponseAgeMinutes} minutes. Do not let this job wait on that one worker.
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    <MasterDispatchCandidateCard
                      candidate={masterDispatchRecommendation.primary}
                      label="Primary"
                      onStage={stageMasterDispatchCandidate}
                      selected={selectedAssignmentTechId === masterDispatchRecommendation.primary.techId}
                    />

                    {masterDispatchRecommendation.fallbacks.map((candidate, index) => (
                      <MasterDispatchCandidateCard
                        candidate={candidate}
                        key={candidate.techId}
                        label={`Fallback ${index + 1}`}
                        onStage={stageMasterDispatchCandidate}
                        selected={selectedAssignmentTechId === candidate.techId}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

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
                {recommendedAssignmentTech && !selectedAssignmentJob.techId ? (
                  <p className="mt-2 text-indigo-700">
                    Master pick for ZIP {selectedAssignmentJobZipCode || "unknown"}: {recommendedAssignmentTech.name}
                  </p>
                ) : null}
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
                {selectedAssignmentJobZipCode ? (
                  <p className="mt-2">Service ZIP: {selectedAssignmentJobZipCode}</p>
                ) : null}
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Arrival time
                <input
                  type="datetime-local"
                  value={etaAtInput}
                  onChange={(event) => setEtaAtInput(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                ETA update text
                <input
                  value={etaWindowText}
                  onChange={(event) => setEtaWindowText(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                  placeholder="Arriving in 20 minutes"
                />
              </label>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                If an arrival time is set, customer notifications are scheduled about 1 hour before arrival. Technician updates still go out immediately.
              </div>

              <div className="rounded-2xl border border-[#dce2ec] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Technician confirmation
                </p>
                <div className="mt-4 space-y-4">
                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={technicianConfirmedGoing}
                      onChange={(event) => setTechnicianConfirmedGoing(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                    />
                    Technician confirmed ETA and accepted the job
                  </label>

                  <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Technician response
                    <textarea
                      value={technicianConfirmationResponse}
                      onChange={(event) => setTechnicianConfirmationResponse(event.target.value)}
                      rows={3}
                      placeholder="Example: On my way, 25 minutes out and I will wait for payment."
                      className={`${ASSIGNMENT_FIELD_CLASS} resize-y`}
                    />
                  </label>

                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={paymentCollectedBeforeTechLeft}
                      onChange={(event) => setPaymentCollectedBeforeTechLeft(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                    />
                    Technician stayed until payment was collected
                  </label>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    When this confirmation is checked, the office number linked to Twilio is alerted by both text and call with the ETA, technician response, and payment-stay note.
                  </div>
                </div>
              </div>

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
          <p className="section-title">Final work automation</p>
          <h2 className="mt-2 text-lg font-semibold">10-minute finish workflow</h2>

          {finalWorkFeedback ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${DISPATCH_ACTION_TONES[finalWorkFeedback.tone]}`}>
              {finalWorkFeedback.message}
            </div>
          ) : null}

          {!selectedAssignmentJob ? (
            <div className="mt-6">
              <PageStateNotice
                title="No job selected for final-work automation"
                message="Select a dispatch job first, then trigger the assistant alert and automatic labor invoice workflow."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-800">{selectedAssignmentJob.customer?.name || "Unknown customer"}</p>
                <p className="mt-1">{selectedAssignmentJob.jobId}</p>
                <p className="mt-2">This workflow alerts the assistant, creates a labor invoice, notifies the customer, and schedules an 8-minute unpaid follow-up.</p>
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Labor amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={laborAmount}
                  onChange={(event) => setLaborAmount(event.target.value)}
                  className={ASSIGNMENT_FIELD_CLASS}
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Workflow notes
                <textarea
                  value={finalWorkNotes}
                  onChange={(event) => setFinalWorkNotes(event.target.value)}
                  rows={3}
                  placeholder="Optional note for the automatic labor invoice."
                  className={`${ASSIGNMENT_FIELD_CLASS} resize-y`}
                />
              </label>

              <PrimaryButton
                onClick={runFinalWorkWorkflow}
                disabled={!selectedAssignmentJob || activeFinalWorkJobId === selectedAssignmentJob.jobId}
              >
                {activeFinalWorkJobId === selectedAssignmentJob.jobId
                  ? "Running..."
                  : "Trigger 10-minute finish workflow"}
              </PrimaryButton>
            </div>
          )}
        </Card>

      </div>
      </div>
    </PageScaffold>
  );
}
