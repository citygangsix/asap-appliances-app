import { useState } from "react";
import { formatCurrency, formatPercent } from "../lib/domain/finance";
import { formatStatusLabel, getStatusTone } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

export function TechniciansPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, error, isLoading } = useAsyncValue(() => repository.getTechniciansPageData(), [repository, refreshNonce]);

  const refreshRoster = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshRoster}>Refresh roster</SecondaryButton>
      <PrimaryButton>Add technician</PrimaryButton>
    </>
  );

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

  const { technicians } = data;

  return (
    <PageScaffold
      title="Technicians"
      subtitle="Field performance, current availability, and payout visibility in one place."
      actions={actions}
      tabs={[{ label: "Roster", active: true }, { label: "Scorecards" }]}
      contentClassName="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8"
    >
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
              <p>Skills: {tech.skills.join(", ")}</p>
              <p>Availability: {tech.availabilityLabel}</p>
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
    </PageScaffold>
  );
}
