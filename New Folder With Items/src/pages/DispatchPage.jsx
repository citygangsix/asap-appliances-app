import { useState } from "react";
import { DISPATCH_GROUPS } from "../lib/constants/status";
import { formatStatusLabel, getJobsForDispatchGroup, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

export function DispatchPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, error, isLoading } = useAsyncValue(() => repository.getDispatchPageData(), [repository, refreshNonce]);

  const refreshBoard = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshBoard}>Refresh board</SecondaryButton>
      <PrimaryButton>Escalation queue</PrimaryButton>
    </>
  );

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

  const { jobRecords, technicians } = data;

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
                    <div key={job.jobId} className="rounded-2xl border border-[#dce2ec] bg-white p-3">
                      <p className="text-sm font-semibold text-slate-900">{job.customer?.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{job.jobId}</p>
                      <p className="mt-2 text-sm text-slate-500">{job.technician?.name || "Unassigned"}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <span>{job.etaLabel}</span>
                        <span>{job.customerUpdated ? "Updated" : "Not updated"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-6">
          <p className="section-title">Technician assignment</p>
          <h2 className="mt-2 text-lg font-semibold">Availability board</h2>
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
