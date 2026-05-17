import { useState } from "react";
import { formatCurrency } from "../lib/domain/finance";
import { formatStatusLabel } from "../lib/domain/jobs";
import { Card, PrimaryButton, SecondaryButton, StatCard } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import { downloadTextFile } from "../lib/download";

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsvRow(values) {
  return values.map(escapeCsvCell).join(",");
}

export function RevenuePage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, error, isLoading } = useAsyncValue(() => repository.getRevenuePageData(), [repository, refreshNonce]);

  const refreshRevenue = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const exportRevenueSummary = () => {
    if (!data) {
      return;
    }

    const { payoutRecords, pendingBalance, revenueCards } = data;
    const rows = [
      ["Section", "Label", "Value", "Detail"],
      ...revenueCards.map((card) => ["Revenue KPI", card.label, card.value, card.detail]),
      ["Cash posture", "Pending balance", formatCurrency(pendingBalance), "Open balance to collect"],
      ...payoutRecords.map((batch) => [
        "Technician payout",
        batch.technician?.name || batch.payoutId,
        formatCurrency(batch.amount),
        formatStatusLabel(batch.status),
      ]),
    ];

    downloadTextFile(
      "asap-revenue-summary.csv",
      `${rows.map(toCsvRow).join("\n")}\n`,
      "text/csv;charset=utf-8",
    );
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshRevenue}>Refresh revenue</SecondaryButton>
      <PrimaryButton onClick={exportRevenueSummary} disabled={!data}>
        Export summary
      </PrimaryButton>
    </>
  );

  if (isLoading) {
    return (
      <PageScaffold
        title="Revenue"
        subtitle="Booked revenue, collections progress, and technician payout readiness from the active repository source."
        actions={actions}
        tabs={[{ label: "Overview", active: true }, { label: "Collections" }]}
      >
        <PageStateNotice title="Loading revenue" message="Fetching invoice totals, collections, and payout batches." />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold
        title="Revenue"
        subtitle="Booked revenue, collections progress, and technician payout readiness from the active repository source."
        actions={actions}
        tabs={[{ label: "Overview", active: true }, { label: "Collections" }]}
      >
        <PageStateNotice title="Revenue unavailable" message={error?.message || "Revenue data could not be loaded."} />
      </PageScaffold>
    );
  }

  const { payoutRecords, trendBars, pendingBalance, revenueCards } = data;

  return (
    <PageScaffold
      title="Revenue"
      subtitle="Booked revenue, collections progress, and technician payout readiness from the active repository source."
      actions={actions}
      tabs={[{ label: "Overview", active: true }, { label: "Collections" }]}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {revenueCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <p className="section-title">Weekly trend</p>
          <h2 className="mt-2 text-lg font-semibold">Invoiced vs collected</h2>
          <div className="mt-8 grid h-72 grid-cols-5 gap-4">
            {trendBars.map((entry) => (
              <div key={entry.periodLabel} className="flex flex-col justify-end gap-2">
                <div className="flex h-full items-end gap-2">
                  <div className="w-full rounded-t-2xl bg-slate-200" style={{ height: entry.invoicedHeight }} />
                  <div className="w-full rounded-t-2xl bg-indigo-500" style={{ height: entry.collectedHeight }} />
                </div>
                <div className="text-center text-sm font-medium text-slate-500">{entry.periodLabel}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-slate-200" />
              Invoiced
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-indigo-500" />
              Collected
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="section-title">Technician payouts</p>
            <h2 className="mt-2 text-lg font-semibold">Release readiness</h2>
            <div className="mt-6 space-y-4">
              {payoutRecords.map((batch) => (
                <div key={batch.payoutId} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800">{batch.technician?.name}</p>
                    <p className="font-semibold text-slate-900">{formatCurrency(batch.amount)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{formatStatusLabel(batch.status)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="section-title">Cash posture</p>
            <h2 className="mt-2 text-lg font-semibold">Open balance to collect</h2>
            <div className="mt-6 rounded-2xl bg-[#202430] p-5 text-white">
              <p className="text-3xl font-semibold">{formatCurrency(pendingBalance)}</p>
              <p className="mt-3 text-sm text-slate-300">
                Remaining across labor, parts deposits, and failed payment retries.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
