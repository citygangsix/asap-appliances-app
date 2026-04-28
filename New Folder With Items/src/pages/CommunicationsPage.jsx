import { useEffect, useMemo, useState } from "react";
import { getCommunicationJobContext } from "../lib/domain/communications";
import { formatStatusLabel, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { CallInsightsPanel } from "../components/communications/CallInsightsPanel";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

const COMMUNICATIONS_PAGE_SCAFFOLD = {
  title: "Communications",
  subtitle:
    "A Twilio-ready mock interface for calls, texts, transcript review, and approving extracted operational events.",
  tabs: [{ label: "Calls & Texts", active: true }, { label: "Event Review" }],
  contentClassName: "grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr_0.9fr] lg:p-8",
};

const COMMUNICATION_ACTION_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const COMMUNICATION_FIELD_CLASS =
  "rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

function buildActions(onRefresh, onReview, disabled) {
  return (
    <>
      <SecondaryButton onClick={onRefresh}>Refresh inbox</SecondaryButton>
      <PrimaryButton onClick={onReview} disabled={disabled}>
        Review unresolved
      </PrimaryButton>
    </>
  );
}

function normalizePhoneNumber(value) {
  if (!value) {
    return null;
  }

  const digits = String(value).replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function getUnmatchedMatchTone(matchStatus) {
  if (matchStatus === "ambiguous") {
    return "amber";
  }

  if (matchStatus === "missing_phone") {
    return "rose";
  }

  return "slate";
}

function formatUnmatchedMatchLabel(matchStatus) {
  if (matchStatus === "missing_phone") {
    return "Missing phone";
  }

  if (matchStatus === "not_found") {
    return "No customer match";
  }

  if (matchStatus === "ambiguous") {
    return "Multiple customer matches";
  }

  return "Needs review";
}

function getCommunicationPhoneLabel(item) {
  if (!item) {
    return null;
  }

  return item.direction === "outbound"
    ? item.toNumber || item.fromNumber || null
    : item.fromNumber || item.toNumber || null;
}

function getCommunicationContactLabel(item) {
  return item?.customer?.name || getCommunicationPhoneLabel(item) || "Unknown caller";
}

export function CommunicationsPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedCommunicationId, setSelectedCommunicationId] = useState(null);
  const [selectedAttachJobId, setSelectedAttachJobId] = useState("");
  const [selectedUnmatchedCommunicationId, setSelectedUnmatchedCommunicationId] = useState(null);
  const [selectedUnmatchedCustomerId, setSelectedUnmatchedCustomerId] = useState("");
  const [selectedUnmatchedJobId, setSelectedUnmatchedJobId] = useState("");
  const [activeActionKey, setActiveActionKey] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getCommunicationsPageData(),
    [repository, refreshNonce],
  );
  const jobsQuery = useAsyncValue(() => repository.jobs.list(), [repository, refreshNonce]);
  const customersQuery = useAsyncValue(() => repository.customers.list(), [repository, refreshNonce]);
  const communicationRecords = data?.communicationRecords || [];
  const unmatchedInboundRecords = data?.unmatchedInboundRecords || [];
  const jobs = jobsQuery.data || [];
  const customers = customersQuery.data || [];
  const unresolvedRecords = useMemo(
    () => communicationRecords.filter((item) => item.communicationStatus !== "clear"),
    [communicationRecords],
  );
  const selectedCommunication =
    communicationRecords.find((item) => item.communicationId === selectedCommunicationId) ||
    unresolvedRecords[0] ||
    communicationRecords[0] ||
    null;
  const selectedAttachJob = jobs.find((job) => job.jobId === selectedAttachJobId) || null;
  const selectedEventLabel =
    selectedCommunication?.extractedEventLabel &&
    selectedCommunication.extractedEventLabel !== "No extracted event"
      ? selectedCommunication.extractedEventLabel
      : null;
  const selectedUnmatchedInbound =
    unmatchedInboundRecords.find(
      (item) => item.unmatchedCommunicationId === selectedUnmatchedCommunicationId,
    ) ||
    unmatchedInboundRecords[0] ||
    null;
  const phoneMatchedCustomers = useMemo(() => {
    const targetPhone = normalizePhoneNumber(selectedUnmatchedInbound?.fromNumber);

    if (!targetPhone) {
      return [];
    }

    return customers.filter((customer) =>
      [customer.primaryPhone, customer.secondaryPhone]
        .map(normalizePhoneNumber)
        .some((phone) => phone && phone === targetPhone),
    );
  }, [customers, selectedUnmatchedInbound]);
  const unmatchedCustomerOptions = useMemo(() => {
    const matchedIds = new Set(phoneMatchedCustomers.map((customer) => customer.customerId));
    const sortedCustomers = [...customers].sort((left, right) => left.name.localeCompare(right.name));

    return sortedCustomers.sort((left, right) => {
      const leftMatched = matchedIds.has(left.customerId);
      const rightMatched = matchedIds.has(right.customerId);

      if (leftMatched === rightMatched) {
        return left.name.localeCompare(right.name);
      }

      return leftMatched ? -1 : 1;
    });
  }, [customers, phoneMatchedCustomers]);
  const unmatchedJobs = useMemo(() => {
    if (!selectedUnmatchedCustomerId) {
      return [];
    }

    return jobs.filter((job) => job.customerId === selectedUnmatchedCustomerId);
  }, [jobs, selectedUnmatchedCustomerId]);
  const selectedUnmatchedJob =
    unmatchedJobs.find((job) => job.jobId === selectedUnmatchedJobId) || null;

  const refreshInbox = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  useEffect(() => {
    if (!selectedCommunicationId && (unresolvedRecords[0] || communicationRecords[0])) {
      setSelectedCommunicationId((unresolvedRecords[0] || communicationRecords[0]).communicationId);
      return;
    }

    if (
      selectedCommunicationId &&
      !communicationRecords.some((item) => item.communicationId === selectedCommunicationId)
    ) {
      setSelectedCommunicationId((unresolvedRecords[0] || communicationRecords[0])?.communicationId || null);
    }
  }, [communicationRecords, selectedCommunicationId, unresolvedRecords]);

  useEffect(() => {
    if (!selectedCommunication) {
      setSelectedAttachJobId("");
      return;
    }

    setSelectedAttachJobId((current) => {
      if (selectedCommunication.linkedJobId) {
        return selectedCommunication.linkedJobId;
      }

      if (current && jobs.some((job) => job.jobId === current)) {
        return current;
      }

      return jobs[0]?.jobId || "";
    });
  }, [jobs, selectedCommunication]);

  useEffect(() => {
    if (!selectedUnmatchedCommunicationId && unmatchedInboundRecords[0]) {
      setSelectedUnmatchedCommunicationId(unmatchedInboundRecords[0].unmatchedCommunicationId);
      return;
    }

    if (
      selectedUnmatchedCommunicationId &&
      !unmatchedInboundRecords.some(
        (item) => item.unmatchedCommunicationId === selectedUnmatchedCommunicationId,
      )
    ) {
      setSelectedUnmatchedCommunicationId(unmatchedInboundRecords[0]?.unmatchedCommunicationId || null);
    }
  }, [selectedUnmatchedCommunicationId, unmatchedInboundRecords]);

  useEffect(() => {
    if (!selectedUnmatchedInbound) {
      setSelectedUnmatchedCustomerId("");
      setSelectedUnmatchedJobId("");
      return;
    }

    setSelectedUnmatchedCustomerId((current) => {
      if (current && customers.some((customer) => customer.customerId === current)) {
        return current;
      }

      return phoneMatchedCustomers.length === 1 ? phoneMatchedCustomers[0].customerId : "";
    });
  }, [customers, phoneMatchedCustomers, selectedUnmatchedInbound]);

  useEffect(() => {
    if (!selectedUnmatchedCustomerId) {
      setSelectedUnmatchedJobId("");
      return;
    }

    setSelectedUnmatchedJobId((current) => {
      if (current && unmatchedJobs.some((job) => job.jobId === current)) {
        return current;
      }

      return "";
    });
  }, [selectedUnmatchedCustomerId, unmatchedJobs]);

  const setMutationFeedback = (result) => {
    setActionFeedback({
      message: result.message,
      tone:
        result.source === "mock"
          ? "amber"
          : result.ok
            ? "emerald"
            : "rose",
    });
  };

  const runMutation = async (actionKey, operation) => {
    setActiveActionKey(actionKey);

    try {
      const result = await operation();
      setMutationFeedback(result);

      if (result.ok) {
        refreshInbox();
      }
    } catch (mutationError) {
      setActionFeedback({
        message: mutationError.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const runReviewUnresolved = async () => {
    const targetCommunication =
      selectedCommunication?.communicationStatus !== "clear"
        ? selectedCommunication
        : unresolvedRecords[0] || null;
    const targetEventLabel =
      targetCommunication?.extractedEventLabel &&
      targetCommunication.extractedEventLabel !== "No extracted event"
        ? targetCommunication.extractedEventLabel
        : null;

    if (!targetCommunication) {
      setActionFeedback({
        message: "No unresolved communications are waiting for review.",
        tone: "amber",
      });
      return;
    }

    setSelectedCommunicationId(targetCommunication.communicationId);

    return runMutation(`review:${targetCommunication.communicationId}`, () =>
      repository.communications.markReviewed(targetCommunication.communicationId, {
        communicationStatus: "clear",
        timelineSummary: targetCommunication.linkedJobId ? targetEventLabel : null,
        timelineDetails: targetCommunication.previewText,
      }),
    );
  };

  const runApprove = async () => {
    if (!selectedCommunication) {
      return;
    }

    if (selectedCommunication.linkedJobId) {
      return runMutation(`approve:${selectedCommunication.communicationId}`, () =>
        repository.communications.markReviewed(selectedCommunication.communicationId, {
          communicationStatus: "clear",
          timelineSummary: selectedEventLabel || "Communication event approved.",
          timelineDetails: selectedCommunication.previewText,
        }),
      );
    }

    if (!selectedAttachJobId) {
      setActionFeedback({
        message: "Select a job before approving an event for an unlinked communication.",
        tone: "amber",
      });
      return;
    }

    return runMutation(`approve:${selectedCommunication.communicationId}`, () =>
      repository.communications.attachToJob(selectedCommunication.communicationId, {
        jobId: selectedAttachJobId,
        invoiceId: selectedCommunication.invoiceId || null,
        communicationStatus: "clear",
        timelineSummary: selectedEventLabel || "Communication event approved.",
        timelineDetails: selectedCommunication.previewText,
      }),
    );
  };

  const runReject = async () => {
    if (!selectedCommunication) {
      return;
    }

    return runMutation(`reject:${selectedCommunication.communicationId}`, () =>
      repository.communications.updateStatus(selectedCommunication.communicationId, {
        communicationStatus: "clear",
        extractedEventLabel: null,
      }),
    );
  };

  const runAttachToJob = async () => {
    if (!selectedCommunication) {
      return;
    }

    if (!selectedAttachJobId) {
      setActionFeedback({
        message: "Select a job before attaching the communication.",
        tone: "amber",
      });
      return;
    }

    return runMutation(`attach:${selectedCommunication.communicationId}`, () =>
      repository.communications.attachToJob(selectedCommunication.communicationId, {
        jobId: selectedAttachJobId,
        invoiceId: selectedCommunication.invoiceId || null,
        communicationStatus: selectedCommunication.communicationStatus,
        timelineSummary: selectedEventLabel || "Communication attached to job.",
        timelineDetails: selectedCommunication.previewText,
      }),
    );
  };

  const runLinkUnmatchedInbound = async () => {
    if (!selectedUnmatchedInbound) {
      return;
    }

    if (!selectedUnmatchedCustomerId) {
      setActionFeedback({
        message: "Select an existing customer before linking the inbound event.",
        tone: "amber",
      });
      return;
    }

    return runMutation(`triage:${selectedUnmatchedInbound.unmatchedCommunicationId}`, () =>
      repository.communications.resolveUnmatchedInbound(
        selectedUnmatchedInbound.unmatchedCommunicationId,
        {
          customerId: selectedUnmatchedCustomerId,
          jobId: selectedUnmatchedJobId || null,
        },
      ),
    );
  };

  if (isLoading) {
    return (
      <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox, runReviewUnresolved, true)}>
        <PageStateNotice
          title="Loading communications"
          message="Fetching calls, texts, extracted event summaries, and unmatched inbound triage items."
        />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox, runReviewUnresolved, true)}>
        <PageStateNotice
          title="Communications unavailable"
          message={error?.message || "Communication logs could not be loaded."}
        />
      </PageScaffold>
    );
  }

  if (communicationRecords.length === 0 && unmatchedInboundRecords.length === 0) {
    return (
      <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox, runReviewUnresolved, true)}>
        <PageStateNotice
          title="No communications found"
          message="The current data source returned an empty communications and unmatched inbound queue."
        />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      {...COMMUNICATIONS_PAGE_SCAFFOLD}
      actions={buildActions(
        refreshInbox,
        runReviewUnresolved,
        activeActionKey !== null || unresolvedRecords.length === 0,
      )}
    >
      {actionFeedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${COMMUNICATION_ACTION_TONES[actionFeedback.tone]}`}>
          {actionFeedback.message}
        </div>
      ) : null}

      {unmatchedInboundRecords.length > 0 ? (
        <Card className="p-6 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-title">Unmatched inbound</p>
              <h2 className="mt-2 text-lg font-semibold">Twilio triage queue</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                These inbound calls and texts were accepted by the webhook but could not be written to
                `communications` because no unique customer phone match was available yet.
              </p>
            </div>
            <Badge tone="amber">{unmatchedInboundRecords.length} pending</Badge>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              {unmatchedInboundRecords.map((item) => (
                <button
                  key={item.unmatchedCommunicationId}
                  onClick={() => setSelectedUnmatchedCommunicationId(item.unmatchedCommunicationId)}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedUnmatchedInbound?.unmatchedCommunicationId === item.unmatchedCommunicationId
                      ? "border-amber-300 bg-amber-50/70"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">
                      {formatStatusLabel(item.communicationChannel)} · {item.fromNumber || "No inbound number"}
                    </p>
                    <Badge tone={getUnmatchedMatchTone(item.matchStatus)}>
                      {formatUnmatchedMatchLabel(item.matchStatus)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.previewText}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {item.occurredAtLabel || "Recent"} · {formatStatusLabel(item.communicationStatus)}
                  </p>
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              {!selectedUnmatchedInbound ? (
                <PageStateNotice
                  title="No unmatched inbound selected"
                  message="Select an unmatched inbound event to review and link it to an existing customer."
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="indigo">{formatStatusLabel(selectedUnmatchedInbound.communicationChannel)}</Badge>
                    <Badge tone={getStatusTone(selectedUnmatchedInbound.communicationStatus)}>
                      {formatStatusLabel(selectedUnmatchedInbound.communicationStatus)}
                    </Badge>
                    <Badge tone={getUnmatchedMatchTone(selectedUnmatchedInbound.matchStatus)}>
                      {formatUnmatchedMatchLabel(selectedUnmatchedInbound.matchStatus)}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">From</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {selectedUnmatchedInbound.fromNumber || "No inbound number captured"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">To</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {selectedUnmatchedInbound.toNumber || "No destination number captured"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Preview
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedUnmatchedInbound.transcriptText || selectedUnmatchedInbound.previewText}
                    </p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Link to existing customer
                    </p>
                    {customersQuery.error ? (
                      <p className="mt-2 text-sm text-rose-600">{customersQuery.error.message}</p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-slate-500">
                          {phoneMatchedCustomers.length > 0
                            ? `${phoneMatchedCustomers.length} existing customer phone match${
                                phoneMatchedCustomers.length === 1 ? "" : "es"
                              } found.`
                            : "No existing customer phone match was found. Add the customer on the Customers page first if needed, then return here."}
                        </p>
                        <select
                          value={selectedUnmatchedCustomerId}
                          onChange={(event) => setSelectedUnmatchedCustomerId(event.target.value)}
                          disabled={customersQuery.isLoading || unmatchedCustomerOptions.length === 0}
                          className={`${COMMUNICATION_FIELD_CLASS} mt-3 w-full`}
                        >
                          <option value="">Select a customer</option>
                          {unmatchedCustomerOptions.map((customer) => (
                            <option key={customer.customerId} value={customer.customerId}>
                              {customer.name} · {customer.primaryPhone}
                              {phoneMatchedCustomers.some(
                                (match) => match.customerId === customer.customerId,
                              )
                                ? " · Phone match"
                                : ""}
                            </option>
                          ))}
                        </select>

                        <select
                          value={selectedUnmatchedJobId}
                          onChange={(event) => setSelectedUnmatchedJobId(event.target.value)}
                          disabled={!selectedUnmatchedCustomerId || unmatchedJobs.length === 0}
                          className={`${COMMUNICATION_FIELD_CLASS} mt-3 w-full`}
                        >
                          <option value="">No linked job</option>
                          {unmatchedJobs.map((job) => (
                            <option key={job.jobId} value={job.jobId}>
                              {job.applianceLabel} · {job.jobId}
                            </option>
                          ))}
                        </select>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <PrimaryButton
                            onClick={runLinkUnmatchedInbound}
                            disabled={
                              !selectedUnmatchedCustomerId ||
                              activeActionKey === `triage:${selectedUnmatchedInbound.unmatchedCommunicationId}`
                            }
                          >
                            {activeActionKey ===
                            `triage:${selectedUnmatchedInbound.unmatchedCommunicationId}`
                              ? "Linking..."
                              : "Link to customer"}
                          </PrimaryButton>
                          {selectedUnmatchedJob ? (
                            <span className="self-center text-sm text-slate-500">
                              Optional job link: {selectedUnmatchedJob.applianceLabel} ·{" "}
                              {selectedUnmatchedJob.jobId}
                            </span>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <p className="section-title">Logs</p>
        <h2 className="mt-2 text-lg font-semibold">Calls and texts</h2>
        {communicationRecords.length === 0 ? (
          <div className="mt-6">
            <PageStateNotice
              title="No matched communications yet"
              message="The live feed is empty right now, but unmatched inbound triage can still be reviewed above."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {communicationRecords.map((item) => (
              <button
                key={item.communicationId}
                onClick={() => setSelectedCommunicationId(item.communicationId)}
                type="button"
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedCommunication?.communicationId === item.communicationId
                    ? "border-indigo-300 bg-indigo-50/70"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {getCommunicationContactLabel(item)}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {formatStatusLabel(item.communicationChannel)}
                      {getCommunicationPhoneLabel(item)
                        ? ` · ${getCommunicationPhoneLabel(item)}`
                        : ""}
                    </p>
                  </div>
                  <Badge tone={getStatusTone(item.communicationStatus)}>
                    {formatStatusLabel(item.communicationStatus)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.previewText}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                  {item.linkedJobId || "No linked job"}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <p className="section-title">Transcript preview</p>
        <h2 className="mt-2 text-lg font-semibold">Unresolved communications queue</h2>
        {!selectedCommunication ? (
          <div className="mt-6">
            <PageStateNotice
              title="No communication selected"
              message="Select a communication to review transcript and attachment context."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="indigo">{formatStatusLabel(selectedCommunication.communicationChannel)}</Badge>
                <Badge tone={getStatusTone(selectedCommunication.communicationStatus)}>
                  {formatStatusLabel(selectedCommunication.communicationStatus)}
                </Badge>
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-slate-950">
                {getCommunicationContactLabel(selectedCommunication)}
              </h3>
              {getCommunicationPhoneLabel(selectedCommunication) ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {getCommunicationPhoneLabel(selectedCommunication)}
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {selectedCommunication.communicationChannel === "call"
                  ? selectedCommunication.previewText
                  : selectedCommunication.transcriptText || selectedCommunication.previewText}
              </p>
              {selectedCommunication.communicationChannel === "call" ? (
                <div className="mt-4">
                  <CallInsightsPanel
                    communication={selectedCommunication}
                    transcriptTitle="Full call transcript"
                    highlightsTitle="Call highlights"
                  />
                </div>
              ) : null}
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Linked job context
                </p>
                <p className="mt-2 text-sm text-slate-700">{getCommunicationJobContext(selectedCommunication)}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Attach to job</p>
                {jobsQuery.error ? (
                  <p className="mt-2 text-sm text-rose-600">{jobsQuery.error.message}</p>
                ) : (
                  <>
                    <select
                      value={selectedAttachJobId}
                      onChange={(event) => setSelectedAttachJobId(event.target.value)}
                      disabled={jobsQuery.isLoading || jobs.length === 0}
                      className={`${COMMUNICATION_FIELD_CLASS} mt-3 w-full`}
                    >
                      <option value="">Select a job</option>
                      {jobs.map((job) => (
                        <option key={job.jobId} value={job.jobId}>
                          {job.customer?.name || "Unknown customer"} · {job.jobId}
                        </option>
                      ))}
                    </select>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <SecondaryButton
                        onClick={runAttachToJob}
                        disabled={
                          !selectedAttachJobId ||
                          activeActionKey === `attach:${selectedCommunication.communicationId}`
                        }
                      >
                        {activeActionKey === `attach:${selectedCommunication.communicationId}`
                          ? "Saving..."
                          : "Attach to job"}
                      </SecondaryButton>
                      {selectedAttachJob ? (
                        <span className="self-center text-sm text-slate-500">
                          {selectedAttachJob.applianceLabel} · {selectedAttachJob.jobId}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <p className="section-title">Extracted events</p>
        <h2 className="mt-2 text-lg font-semibold">Approve or reject</h2>
        {!selectedCommunication ? (
          <div className="mt-6">
            <PageStateNotice
              title="No event selected"
              message="Select a communication to approve, reject, or clear its extracted event."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-900">{selectedCommunication.extractedEventLabel}</p>
              <p className="mt-2 text-sm text-slate-500">
                {getCommunicationContactLabel(selectedCommunication)}
              </p>
              <p className="mt-3 text-sm text-slate-500">{selectedCommunication.previewText}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={runApprove}
                  disabled={activeActionKey === `approve:${selectedCommunication.communicationId}`}
                  type="button"
                  className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  {activeActionKey === `approve:${selectedCommunication.communicationId}` ? "Saving..." : "Approve"}
                </button>
                <button
                  onClick={runReject}
                  disabled={activeActionKey === `reject:${selectedCommunication.communicationId}`}
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  {activeActionKey === `reject:${selectedCommunication.communicationId}` ? "Saving..." : "Reject"}
                </button>
                <button
                  onClick={runReviewUnresolved}
                  disabled={activeActionKey === `review:${selectedCommunication.communicationId}`}
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  {activeActionKey === `review:${selectedCommunication.communicationId}` ? "Saving..." : "Mark reviewed"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageScaffold>
  );
}
