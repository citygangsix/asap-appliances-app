import { useEffect, useMemo, useState } from "react";
import { JOB_QUICK_ACTIONS } from "../lib/constants/status";
import {
  filterJobs,
  formatStatusLabel,
  getJobDetailRows,
  getJobFilterOptions,
  getPriorityTone,
  getStatusTone,
} from "../lib/domain/jobs";
import { Badge, Card, FilterSelect, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

const JOBS_PAGE_SCAFFOLD = {
  title: "Jobs",
  subtitle:
    "The main operational control page with separate state dimensions for dispatch, parts, payment, and communication.",
  tabs: [{ label: "Queue View", active: true }, { label: "All Jobs" }],
};

const JOB_ACTION_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const ASSIGNMENT_FIELD_CLASS =
  "rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

const JOB_FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

function formatDatetimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createEmptyJobDraft() {
  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + 2, 0, 0, 0);

  return {
    customerId: "",
    applianceLabel: "",
    applianceBrand: "",
    issueSummary: "",
    serviceAddress: "",
    scheduledStartAt: formatDatetimeLocal(scheduledAt),
    techId: "",
    priority: "normal",
    internalNotes: "",
  };
}

function getQuickActionUpdate(job, action) {
  const eventAt = new Date().toISOString();

  switch (action) {
    case "Mark en route":
      if (!job.techId) {
        return {
          message: "Mark en route is blocked until the job has an assigned technician.",
          tone: "amber",
        };
      }

      return {
        patch: {
          lifecycleStatus: "en_route",
          dispatchStatus: job.dispatchStatus === "unassigned" ? "assigned" : job.dispatchStatus,
          enRouteAt: eventAt,
        },
      };
    case "Mark onsite":
      if (!job.techId) {
        return {
          message: "Mark onsite is blocked until the job has an assigned technician.",
          tone: "amber",
        };
      }

      return {
        patch: {
          lifecycleStatus: "onsite",
          dispatchStatus: job.dispatchStatus === "unassigned" ? "assigned" : job.dispatchStatus,
          onsiteAt: eventAt,
        },
      };
    case "Request parts payment":
      return {
        patch: {
          partsStatus: "awaiting_payment",
          paymentStatus: "parts_due",
        },
      };
    case "Mark part ordered":
      return {
        patch: {
          partsStatus: "ordered",
        },
      };
    case "Schedule return":
      return {
        patch: {
          lifecycleStatus: "return_scheduled",
          returnScheduledAt: eventAt,
        },
      };
    case "Mark labor due":
      return {
        patch: {
          paymentStatus: "labor_due",
        },
      };
    default:
      return {
        message: `Unsupported quick action: ${action}`,
        tone: "rose",
      };
  }
}

export function JobsPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeActionKey, setActiveActionKey] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [newJobDraft, setNewJobDraft] = useState(createEmptyJobDraft);
  const [selectedAssignmentTechId, setSelectedAssignmentTechId] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    technician: "All technicians",
    lifecycle: "All lifecycle",
    payment: "All payment",
    parts: "All parts",
  });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getJobsPageData(),
    [repository, refreshNonce],
  );
  const jobRecords = data?.jobRecords || [];
  const customerQuery = useAsyncValue(() => repository.customers.list(), [repository, refreshNonce]);

  const filterOptions = useMemo(() => getJobFilterOptions(jobRecords), [jobRecords]);
  const filteredJobs = useMemo(() => filterJobs(jobRecords, filters), [filters, jobRecords]);
  const customerOptions = customerQuery.data || [];
  const selectedListJob =
    filteredJobs.find((job) => job.jobId === selectedJobId) ||
    jobRecords.find((job) => job.jobId === selectedJobId) ||
    jobRecords[0] ||
    null;

  const selectedJobDetail = useAsyncValue(
    () => {
      if (!selectedJobId) {
        return null;
      }

      return repository.jobs.getDetail(selectedJobId);
    },
    [repository, selectedJobId, refreshNonce],
  );

  const selectedJob = selectedJobDetail.data || selectedListJob;
  const techniciansQuery = useAsyncValue(() => repository.technicians.list(), [repository, refreshNonce]);
  const technicians = techniciansQuery.data || [];
  const selectedAssignmentTechnician =
    technicians.find((technician) => technician.techId === selectedAssignmentTechId) || null;
  const isAssignmentUnchanged = (selectedJob?.techId || "") === selectedAssignmentTechId;

  useEffect(() => {
    if (!selectedJobId && jobRecords[0]?.jobId) {
      setSelectedJobId(jobRecords[0].jobId);
      return;
    }

    if (selectedJobId && !jobRecords.some((job) => job.jobId === selectedJobId)) {
      setSelectedJobId(jobRecords[0]?.jobId || null);
    }
  }, [jobRecords, selectedJobId]);

  useEffect(() => {
    setSelectedAssignmentTechId(selectedJob?.techId || "");
  }, [selectedJob?.jobId, selectedJob?.techId]);

  useEffect(() => {
    if (!isCreatingJob || newJobDraft.customerId || !customerOptions[0]?.customerId) {
      return;
    }

    setNewJobDraft((current) => ({
      ...current,
      customerId: current.customerId || customerOptions[0].customerId,
    }));
  }, [customerOptions, isCreatingJob, newJobDraft.customerId]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const updateNewJobDraft = (key, value) => {
    setNewJobDraft((current) => ({ ...current, [key]: value }));
  };

  const refreshJobs = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const toggleCreateJobForm = () => {
    setActionFeedback(null);
    setIsCreatingJob((current) => {
      if (current) {
        setNewJobDraft(createEmptyJobDraft());
      }

      return !current;
    });
  };

  const runCreateJob = async () => {
    const requiredFields = [
      ["customer", newJobDraft.customerId],
      ["appliance", newJobDraft.applianceLabel],
      ["issue summary", newJobDraft.issueSummary],
      ["service address", newJobDraft.serviceAddress],
      ["scheduled time", newJobDraft.scheduledStartAt],
    ];
    const missingField = requiredFields.find(([, value]) => !String(value || "").trim());

    if (missingField) {
      setActionFeedback({
        message: `Add the ${missingField[0]} before creating the job.`,
        tone: "amber",
      });
      return;
    }

    const scheduledAt = new Date(newJobDraft.scheduledStartAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      setActionFeedback({
        message: "Choose a valid scheduled time before creating the job.",
        tone: "amber",
      });
      return;
    }

    const actionKey = "job:create";
    setActiveActionKey(actionKey);

    try {
      const result = await repository.jobs.create({
        customerId: newJobDraft.customerId,
        applianceLabel: newJobDraft.applianceLabel.trim(),
        applianceBrand: newJobDraft.applianceBrand.trim(),
        issueSummary: newJobDraft.issueSummary.trim(),
        serviceAddress: newJobDraft.serviceAddress.trim(),
        scheduledStartAt: scheduledAt.toISOString(),
        techId: newJobDraft.techId || null,
        priority: newJobDraft.priority,
        internalNotes: newJobDraft.internalNotes.trim() || null,
      });

      setActionFeedback({
        message: result.message,
        tone:
          result.source === "mock"
            ? "amber"
            : result.ok
              ? "emerald"
              : "rose",
      });

      if (result.ok) {
        setIsCreatingJob(false);
        setNewJobDraft(createEmptyJobDraft());
        if (result.record?.jobId) {
          setSelectedJobId(result.record.jobId);
        }
        refreshJobs();
      }
    } catch (error) {
      setActionFeedback({
        message: error.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const runAssignment = async (jobId) => {
    const actionKey = `${jobId}:assign`;
    setActiveActionKey(actionKey);

    try {
      const result = await repository.jobs.assignTechnician(jobId, {
        techId: selectedAssignmentTechId || null,
      });

      setActionFeedback({
        message: result.message,
        tone:
          result.source === "mock"
            ? "amber"
            : result.ok
              ? "emerald"
              : "rose",
      });

      if (result.ok) {
        refreshJobs();
      }
    } catch (error) {
      setActionFeedback({
        message: error.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const runQuickAction = async (job, action) => {
    if (action === "Assign tech") {
      setSelectedJobId(job.jobId);
      setActionFeedback({
        message: "Select a technician in the Job details panel, then save the assignment.",
        tone: "amber",
      });
      return;
    }

    const update = getQuickActionUpdate(job, action);

    if (!update.patch) {
      setActionFeedback({
        message: update.message,
        tone: update.tone,
      });
      return;
    }

    const actionKey = `${job.jobId}:${action}`;
    setActiveActionKey(actionKey);

    try {
      const result = await repository.jobs.updateWorkflow(job.jobId, update.patch);

      setActionFeedback({
        message: result.message,
        tone:
          result.source === "mock"
            ? "amber"
            : result.ok
              ? "emerald"
              : "rose",
      });

      if (result.ok) {
        refreshJobs();
      }
    } catch (error) {
      setActionFeedback({
        message: error.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshJobs}>Refresh jobs</SecondaryButton>
      <PrimaryButton onClick={toggleCreateJobForm}>{isCreatingJob ? "Close new job" : "+ New Job"}</PrimaryButton>
    </>
  );

  if (isLoading) {
    return (
      <PageScaffold {...JOBS_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="Loading jobs" message="Fetching the job queue from the active data source." />
      </PageScaffold>
    );
  }

  if (error) {
    return (
      <PageScaffold {...JOBS_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="Jobs unavailable" message={error.message} />
      </PageScaffold>
    );
  }

  if (!selectedListJob) {
    return (
      <PageScaffold {...JOBS_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="No jobs found" message="The current data source returned an empty job queue." />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold {...JOBS_PAGE_SCAFFOLD} actions={actions}>
      {actionFeedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${JOB_ACTION_TONES[actionFeedback.tone]}`}>
          {actionFeedback.message}
        </div>
      ) : null}

      {isCreatingJob ? (
        <Card className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="section-title">New job</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Create service job</h2>
              <p className="mt-2 text-sm text-slate-500">
                The job will save through the active repository and land back in the operations queue.
              </p>
            </div>
            <SecondaryButton onClick={toggleCreateJobForm}>Cancel</SecondaryButton>
          </div>

          {customerQuery.error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {customerQuery.error.message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium text-slate-600">
              Customer
              <select
                value={newJobDraft.customerId}
                onChange={(event) => updateNewJobDraft("customerId", event.target.value)}
                disabled={customerQuery.isLoading}
                className={JOB_FIELD_CLASS}
              >
                {customerOptions.length === 0 ? <option value="">No customers available</option> : null}
                {customerOptions.map((customer) => (
                  <option key={customer.customerId} value={customer.customerId}>
                    {customer.name} · {customer.primaryPhone || "No phone"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">
              Appliance
              <input
                value={newJobDraft.applianceLabel}
                onChange={(event) => updateNewJobDraft("applianceLabel", event.target.value)}
                placeholder="Refrigerator, washer, dryer"
                className={JOB_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Brand
              <input
                value={newJobDraft.applianceBrand}
                onChange={(event) => updateNewJobDraft("applianceBrand", event.target.value)}
                placeholder="LG, Carrier, Whirlpool"
                className={JOB_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600 xl:col-span-2">
              Issue summary
              <input
                value={newJobDraft.issueSummary}
                onChange={(event) => updateNewJobDraft("issueSummary", event.target.value)}
                placeholder="No cool, not draining, compressor noise"
                className={JOB_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Scheduled time
              <input
                type="datetime-local"
                value={newJobDraft.scheduledStartAt}
                onChange={(event) => updateNewJobDraft("scheduledStartAt", event.target.value)}
                className={JOB_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600 xl:col-span-2">
              Service address
              <input
                value={newJobDraft.serviceAddress}
                onChange={(event) => updateNewJobDraft("serviceAddress", event.target.value)}
                placeholder="Street, city, ZIP"
                className={JOB_FIELD_CLASS}
              />
            </label>
            <label className="text-sm font-medium text-slate-600">
              Technician
              <select
                value={newJobDraft.techId}
                onChange={(event) => updateNewJobDraft("techId", event.target.value)}
                disabled={techniciansQuery.isLoading}
                className={JOB_FIELD_CLASS}
              >
                <option value="">Auto-assign or leave unassigned</option>
                {technicians.map((technician) => (
                  <option key={technician.techId} value={technician.techId}>
                    {technician.name} · {technician.serviceArea}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600">
              Priority
              <select
                value={newJobDraft.priority}
                onChange={(event) => updateNewJobDraft("priority", event.target.value)}
                className={JOB_FIELD_CLASS}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="escalated">Escalated</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600 md:col-span-2 xl:col-span-3">
              Internal notes
              <textarea
                value={newJobDraft.internalNotes}
                onChange={(event) => updateNewJobDraft("internalNotes", event.target.value)}
                rows={3}
                placeholder="Gate code, parking, warranty context, or office note"
                className={`${JOB_FIELD_CLASS} resize-none`}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton
              onClick={runCreateJob}
              disabled={
                activeActionKey === "job:create" ||
                customerQuery.isLoading ||
                techniciansQuery.isLoading ||
                customerOptions.length === 0
              }
            >
              {activeActionKey === "job:create" ? "Creating job..." : "Create job"}
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <label className="flex flex-1 flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Search
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Customer, appliance, issue, or job ID"
              className="rounded-xl border border-[#cfd6e2] bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <FilterSelect
              label="Technician"
              value={filters.technician}
              onChange={(value) => updateFilter("technician", value)}
              options={filterOptions.technicians}
            />
            <FilterSelect
              label="Lifecycle"
              value={filters.lifecycle}
              onChange={(value) => updateFilter("lifecycle", value)}
              options={filterOptions.lifecycleStatuses}
            />
            <FilterSelect
              label="Payment"
              value={filters.payment}
              onChange={(value) => updateFilter("payment", value)}
              options={filterOptions.paymentStatuses}
            />
            <FilterSelect
              label="Parts"
              value={filters.parts}
              onChange={(value) => updateFilter("parts", value)}
              options={filterOptions.partsStatuses}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="divide-y divide-[#edf0f5] md:hidden">
            {filteredJobs.map((job) => (
              <div
                key={job.jobId}
                className={`p-4 transition ${
                  selectedJob?.jobId === job.jobId ? "bg-indigo-50/70" : "bg-white"
                }`}
              >
                <button
                  className="w-full rounded-2xl border border-[#e1e6ef] bg-white p-4 text-left transition hover:border-slate-300"
                  onClick={() => setSelectedJobId(job.jobId)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{job.customer?.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{job.applianceLabel}</p>
                    </div>
                    <Badge tone={getPriorityTone(job.priority)}>{formatStatusLabel(job.priority)}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{job.issueSummary}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-500">
                    <p>{job.scheduledStartLabel}</p>
                    <p>{job.technician?.name || "Unassigned"}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {job.jobId}
                    </p>
                  </div>
                </button>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    job.lifecycleStatus,
                    job.dispatchStatus,
                    job.paymentStatus,
                    job.partsStatus,
                    job.communicationStatus,
                  ].map((status) => (
                    <Badge key={`${job.jobId}-mobile-${status}`} tone={getStatusTone(status)}>
                      {formatStatusLabel(status)}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {JOB_QUICK_ACTIONS.map((action) => (
                    <button
                      key={`${job.jobId}-mobile-${action}`}
                      onClick={() => runQuickAction(job, action)}
                      disabled={activeActionKey === `${job.jobId}:${action}`}
                      type="button"
                      className="rounded-xl border border-[#d6dce7] bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      {activeActionKey === `${job.jobId}:${action}` ? "Saving..." : action}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Job</th>
                  <th className="px-5 py-4 font-semibold">Time</th>
                  <th className="px-5 py-4 font-semibold">Technician</th>
                  <th className="px-5 py-4 font-semibold">State stack</th>
                  <th className="px-5 py-4 font-semibold">Quick actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr
                    key={job.jobId}
                    className={`border-t border-[#edf0f5] align-top transition hover:bg-slate-50 ${
                      selectedJob?.jobId === job.jobId ? "bg-indigo-50/70" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <button
                        className="text-left"
                        onClick={() => setSelectedJobId(job.jobId)}
                        type="button"
                      >
                        <p className="font-semibold text-slate-900">{job.customer?.name}</p>
                        <p className="mt-1 text-slate-500">{job.applianceLabel}</p>
                        <p className="mt-1 text-slate-500">{job.issueSummary}</p>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p>{job.scheduledStartLabel}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{job.jobId}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{job.technician?.name || "Unassigned"}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {[
                          job.lifecycleStatus,
                          job.dispatchStatus,
                          job.paymentStatus,
                          job.partsStatus,
                          job.communicationStatus,
                        ].map((status) => (
                          <Badge key={`${job.jobId}-${status}`} tone={getStatusTone(status)}>
                            {formatStatusLabel(status)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {JOB_QUICK_ACTIONS.map((action) => (
                          <button
                            key={`${job.jobId}-${action}`}
                            onClick={() => runQuickAction(job, action)}
                            disabled={activeActionKey === `${job.jobId}:${action}`}
                            type="button"
                            className="rounded-full border border-[#d6dce7] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                          >
                            {activeActionKey === `${job.jobId}:${action}` ? "Saving..." : action}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[#e7ebf2] px-6 py-5">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">Job details</h2>
              <p className="mt-1 text-sm text-slate-400">Selected record for dispatch and payment review</p>
            </div>
            <Badge tone="amber">Attention</Badge>
          </div>

          {!selectedJob ? (
            <div className="p-6">
              <PageStateNotice
                title="Job detail unavailable"
                message={selectedJobDetail.error?.message || "Select a job to review dispatch details."}
              />
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{selectedJob.customer?.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedJob.jobId}</p>
                </div>
                <Badge tone={getPriorityTone(selectedJob.priority)}>
                  {formatStatusLabel(selectedJob.priority)}
                </Badge>
              </div>

              <div className="mt-6 grid gap-4">
                {getJobDetailRows(selectedJob).map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-[#e1e6ef] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Technician assignment
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Assign or reassign the selected job through the live repository path.
                    </p>
                  </div>
                  <Badge tone={selectedJob.techId ? "indigo" : "amber"}>
                    {selectedJob.technician?.name || "Needs assignment"}
                  </Badge>
                </div>

                {techniciansQuery.error ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-medium text-rose-700">Technician roster unavailable</p>
                    <p className="mt-2 text-sm text-rose-600">{techniciansQuery.error.message}</p>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Technician
                      <select
                        value={selectedAssignmentTechId}
                        onChange={(event) => setSelectedAssignmentTechId(event.target.value)}
                        disabled={techniciansQuery.isLoading}
                        className={ASSIGNMENT_FIELD_CLASS}
                      >
                        <option value="">Unassigned</option>
                        {technicians.map((technician) => (
                          <option key={technician.techId} value={technician.techId}>
                            {technician.name} · {technician.serviceArea}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PrimaryButton
                      onClick={() => runAssignment(selectedJob.jobId)}
                      disabled={
                        techniciansQuery.isLoading ||
                        activeActionKey === `${selectedJob.jobId}:assign` ||
                        isAssignmentUnchanged
                      }
                    >
                      {activeActionKey === `${selectedJob.jobId}:assign` ? "Saving..." : "Save assignment"}
                    </PrimaryButton>
                  </div>
                )}

                <p className="mt-4 text-sm text-slate-500">
                  {selectedAssignmentTechnician
                    ? `Selected technician: ${selectedAssignmentTechnician.name}`
                    : "Select Unassigned to remove the current technician from this job."}
                </p>
              </div>

              <div className="mt-6 rounded-2xl bg-[#202430] p-5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Field notes</p>
                  {selectedJobDetail.isLoading ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Refreshing detail
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200">{selectedJob.internalNotes}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageScaffold>
  );
}
