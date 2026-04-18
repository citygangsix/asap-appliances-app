import { useState } from "react";
import { getCommunicationJobContext } from "../lib/domain/communications";
import { formatStatusLabel, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
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

function buildActions(onRefresh) {
  return (
    <>
      <SecondaryButton onClick={onRefresh}>Refresh inbox</SecondaryButton>
      <PrimaryButton>Review unresolved</PrimaryButton>
    </>
  );
}

export function CommunicationsPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getCommunicationsPageData(),
    [repository, refreshNonce],
  );

  const refreshInbox = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  if (isLoading) {
    return (
      <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox)}>
        <PageStateNotice
          title="Loading communications"
          message="Fetching calls, texts, and extracted event summaries."
        />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox)}>
        <PageStateNotice
          title="Communications unavailable"
          message={error?.message || "Communication logs could not be loaded."}
        />
      </PageScaffold>
    );
  }

  const { communicationRecords } = data;

  if (communicationRecords.length === 0) {
    return (
      <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox)}>
        <PageStateNotice
          title="No communications found"
          message="The current data source returned an empty communications feed."
        />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold {...COMMUNICATIONS_PAGE_SCAFFOLD} actions={buildActions(refreshInbox)}>
      <Card className="p-6">
        <p className="section-title">Logs</p>
        <h2 className="mt-2 text-lg font-semibold">Calls and texts</h2>
        <div className="mt-6 space-y-4">
          {communicationRecords.map((item) => (
            <div
              key={item.communicationId}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">
                  {formatStatusLabel(item.communicationChannel)} ·{" "}
                  {item.customer?.name || "Unknown customer"}
                </p>
                <Badge tone={getStatusTone(item.communicationStatus)}>
                  {formatStatusLabel(item.communicationStatus)}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.previewText}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                {item.linkedJobId || "No linked job"}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="section-title">Transcript preview</p>
        <h2 className="mt-2 text-lg font-semibold">Unresolved communications queue</h2>
        <div className="mt-6 space-y-4">
          {communicationRecords.map((item) => (
            <div key={item.communicationId} className="rounded-2xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="indigo">{formatStatusLabel(item.communicationChannel)}</Badge>
                <Badge tone={getStatusTone(item.communicationStatus)}>
                  {formatStatusLabel(item.communicationStatus)}
                </Badge>
                <span className="text-sm text-slate-500">
                  {item.customer?.name || "Unknown customer"}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{item.transcriptText}</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Linked job context
                </p>
                <p className="mt-2 text-sm text-slate-700">{getCommunicationJobContext(item)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="section-title">Extracted events</p>
        <h2 className="mt-2 text-lg font-semibold">Approve or reject</h2>
        <div className="mt-6 space-y-4">
          {communicationRecords.map((item) => (
            <div
              key={item.communicationId}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-medium text-slate-900">{item.extractedEventLabel}</p>
              <p className="mt-2 text-sm text-slate-500">
                {item.customer?.name || "Unknown customer"}
              </p>
              <div className="mt-4 flex gap-3">
                <button className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">
                  Approve
                </button>
                <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageScaffold>
  );
}
