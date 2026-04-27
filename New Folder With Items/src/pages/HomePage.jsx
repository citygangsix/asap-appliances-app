import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOperationsRepository } from "../lib/repositories";
import { formatStatusLabel, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton, StatCard } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";

export function HomePage() {
  const repository = getOperationsRepository();
  const navigate = useNavigate();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, error, isLoading } = useAsyncValue(() => repository.getHomePageData(), [repository, refreshNonce]);

  const refreshDashboard = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshDashboard}>Refresh dashboard</SecondaryButton>
      <PrimaryButton onClick={() => navigate("/dashboard/dispatch-board")}>Open urgent queue</PrimaryButton>
    </>
  );

  if (isLoading) {
    return (
      <PageScaffold
        title="Home"
        subtitle="A live operations view of the business: queues, tech movement, and what needs attention right now."
        actions={actions}
        tabs={[{ label: "Command Center", active: true }, { label: "Today's Activity" }]}
      >
        <PageStateNotice title="Loading dashboard" message="Fetching the current operations snapshot." />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold
        title="Home"
        subtitle="A live operations view of the business: queues, tech movement, and what needs attention right now."
        actions={actions}
        tabs={[{ label: "Command Center", active: true }, { label: "Today's Activity" }]}
      >
        <PageStateNotice
          title="Dashboard unavailable"
          message={error?.message || "The operations dashboard could not be loaded."}
        />
      </PageScaffold>
    );
  }

  const {
    homeKpis,
    activityFeed,
    callMetrics,
    urgentQueues,
    technicians,
    hiringCandidates,
    watchListJobs,
  } = data;

  return (
    <PageScaffold
      title="Home"
      subtitle="A live operations view of the business: queues, tech movement, and what needs attention right now."
      actions={actions}
      tabs={[{ label: "Command Center", active: true }, { label: "Today's Activity" }]}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {homeKpis.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Today's activity</p>
              <h2 className="mt-2 text-lg font-semibold">Operational feed</h2>
            </div>
            <Badge tone="indigo">Live</Badge>
          </div>
          <div className="mt-6 space-y-4">
            {activityFeed.map((entry) => (
              <div key={entry} className="flex gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <p className="text-sm leading-6 text-slate-600">{entry}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">Calls today</p>
          <h2 className="mt-2 text-lg font-semibold">Who did what</h2>
          <div className="mt-6 space-y-4">
            {callMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-end justify-between">
                  <p className="text-sm text-slate-500">{metric.label}</p>
                  <p className="text-2xl font-semibold">{metric.value}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500">{metric.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card className="p-6">
          <p className="section-title">Urgent queues</p>
          <h2 className="mt-2 text-lg font-semibold">Needs action</h2>
          <div className="mt-6 space-y-4">
            {urgentQueues.map((queue) => (
              <div
                key={queue.label}
                className="flex items-center justify-between rounded-2xl border border-[#dce2ec] bg-slate-50 px-4 py-4"
              >
                <div>
                  <p className="font-medium text-slate-800">{queue.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{queue.jobIds.join(" • ")}</p>
                </div>
                <div className="rounded-full bg-[#1f2430] px-3 py-1 text-sm font-semibold text-white">
                  {queue.count}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">Technician status</p>
          <h2 className="mt-2 text-lg font-semibold">Field snapshot</h2>
          <div className="mt-6 space-y-3">
            {technicians.map((tech) => (
              <div key={tech.techId} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{tech.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{tech.serviceArea}</p>
                  </div>
                  <Badge tone={getStatusTone(tech.statusToday)}>{formatStatusLabel(tech.statusToday)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">Hiring bottlenecks</p>
          <h2 className="mt-2 text-lg font-semibold">What slows onboarding</h2>
          <div className="mt-6 space-y-4">
            {hiringCandidates.slice(0, 3).map((candidate) => (
              <div key={candidate.candidateId} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">{candidate.name}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {[candidate.trade, candidate.city].filter(Boolean).join(" · ") || "Hiring lead"}
                </p>
                {candidate.availabilitySummary ? (
                  <p className="mt-2 text-sm text-slate-500">{candidate.availabilitySummary}</p>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">{candidate.nextStep}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-title">Watch list</p>
            <h2 className="mt-2 text-lg font-semibold">High-friction jobs</h2>
          </div>
          <Badge tone="amber">Escalation view</Badge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {watchListJobs.map((job) => (
            <div key={job.jobId} className="rounded-2xl border border-[#dce2ec] bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{job.customer?.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{job.applianceLabel}</p>
                </div>
                <Badge tone="rose">{formatStatusLabel(job.paymentStatus)}</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{job.internalNotes}</p>
            </div>
          ))}
        </div>
      </Card>
    </PageScaffold>
  );
}
