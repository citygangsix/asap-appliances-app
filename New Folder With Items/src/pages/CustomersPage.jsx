import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/domain/finance";
import { getStatusTone, formatStatusLabel } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

const CUSTOMERS_PAGE_SCAFFOLD = {
  title: "Customers",
  subtitle: "Customer profiles, communication health, and open balances organized for office follow-up.",
  tabs: [{ label: "Directory", active: true }, { label: "Accounts" }],
  contentClassName: "grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.35fr_0.9fr] lg:p-8",
};

function buildActions() {
  return buildActionsWithRefresh();
}

function buildActionsWithRefresh(onRefresh = undefined) {
  return (
    <>
      <SecondaryButton onClick={onRefresh}>Refresh customers</SecondaryButton>
      <PrimaryButton>Add customer</PrimaryButton>
    </>
  );
}

export function CustomersPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data, error, isLoading } = useAsyncValue(() => repository.getCustomersPageData(), [repository, refreshNonce]);
  const directory = data?.customerRecords || [];
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const activeSelectedCustomerId = selectedCustomerId || directory[0]?.customerId || null;
  const selectedCustomerSummary =
    directory.find((customer) => customer.customerId === activeSelectedCustomerId) || directory[0] || null;

  const refreshCustomers = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const actions = buildActionsWithRefresh(refreshCustomers);

  const {
    data: selectedCustomerProfileData,
    error: selectedCustomerProfileError,
    isLoading: isSelectedCustomerProfileLoading,
  } = useAsyncValue(
    () =>
      activeSelectedCustomerId
        ? repository.customers.getProfile(activeSelectedCustomerId)
        : Promise.resolve(null),
    [repository, activeSelectedCustomerId, refreshNonce],
  );
  const selectedCustomerProfile =
    selectedCustomerProfileData?.customerId === activeSelectedCustomerId
      ? selectedCustomerProfileData
      : null;

  useEffect(() => {
    if (!selectedCustomerId && directory[0]?.customerId) {
      setSelectedCustomerId(directory[0].customerId);
      return;
    }

    if (selectedCustomerId && !directory.some((customer) => customer.customerId === selectedCustomerId)) {
      setSelectedCustomerId(directory[0]?.customerId || null);
    }
  }, [directory, selectedCustomerId]);

  if (isLoading) {
    return (
      <PageScaffold {...CUSTOMERS_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="Loading customers" message="Fetching customer profiles and account balances." />
      </PageScaffold>
    );
  }

  if (error) {
    return (
      <PageScaffold {...CUSTOMERS_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="Customers unavailable" message={error.message} />
      </PageScaffold>
    );
  }

  if (!selectedCustomerSummary) {
    return (
      <PageScaffold {...CUSTOMERS_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="No customers found" message="The current data source returned an empty directory." />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold {...CUSTOMERS_PAGE_SCAFFOLD} actions={actions}>
      <Card className="overflow-hidden">
        <div className="border-b border-[#e7ebf2] px-6 py-5">
          <p className="section-title">Customer list</p>
          <h2 className="mt-2 text-lg font-semibold">Service relationships</h2>
        </div>
        <div className="divide-y divide-[#edf0f5]">
          {directory.map((customer) => (
            <button
              key={customer.customerId}
              onClick={() => setSelectedCustomerId(customer.customerId)}
              className={`grid w-full gap-3 px-6 py-5 text-left transition md:grid-cols-[1.1fr_0.8fr_0.6fr_0.6fr] ${
                selectedCustomerSummary.customerId === customer.customerId
                  ? "bg-indigo-50/70"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <div>
                <p className="font-semibold text-slate-900">{customer.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {customer.city} · {customer.customerSegment}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{customer.activeJob?.applianceLabel}</p>
                <p className="mt-1 text-sm text-slate-500">{customer.activeJob?.issueSummary}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{formatCurrency(customer.openBalance)}</p>
                <p className="mt-1 text-sm text-slate-500">Open balance</p>
              </div>
              <div className="flex items-start justify-between gap-3 md:justify-end">
                <Badge tone={getStatusTone(customer.communicationStatus)}>
                  {formatStatusLabel(customer.communicationStatus)}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="section-title">Customer detail</p>
        <h2 className="mt-2 text-lg font-semibold">{selectedCustomerSummary.name}</h2>

        {selectedCustomerProfileError ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-medium text-rose-700">Customer detail unavailable</p>
            <p className="mt-2 text-sm text-rose-600">{selectedCustomerProfileError.message}</p>
          </div>
        ) : isSelectedCustomerProfileLoading || !selectedCustomerProfile ? (
          <div className="mt-6 rounded-2xl border border-[#e1e6ef] bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Loading customer profile</p>
            <p className="mt-2 text-sm text-slate-500">
              Fetching open-job, communication, and balance detail for the selected customer.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Primary contact</p>
              <p className="mt-2 text-sm text-slate-700">{selectedCustomerProfile.primaryPhone}</p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedCustomerProfile.city} · {selectedCustomerProfile.serviceArea}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Account health</p>
              <p className="mt-2 text-sm text-slate-700">
                Lifetime value {formatCurrency(selectedCustomerProfile.lifetimeValue)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedCustomerProfile.jobs.length} jobs ·{" "}
                {selectedCustomerProfile.unresolvedCount} unresolved communications
              </p>
            </div>

            <div className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active job</p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {selectedCustomerProfile.activeJob?.jobId || "No active job"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedCustomerProfile.activeJob?.internalNotes || "No active field notes."}
              </p>
            </div>

            <div className="rounded-2xl bg-[#202430] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest communication</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {selectedCustomerProfile.latestCommunication}
              </p>
            </div>
          </div>
        )}
      </Card>
    </PageScaffold>
  );
}
