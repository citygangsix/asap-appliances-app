import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/domain/finance";
import { getStatusTone, formatStatusLabel } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton, StatCard } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

const INVOICES_PAGE_SCAFFOLD = {
  title: "Invoices",
  subtitle: "Open balances, same-day labor collection, and parts deposits laid out for fast follow-up.",
  tabs: [{ label: "Open Invoices", active: true }, { label: "Collections" }],
};

export function InvoicesPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getInvoicesPageData(),
    [repository, refreshNonce],
  );
  const invoiceRecords = data?.invoiceRecords || [];
  const selectedListInvoice =
    invoiceRecords.find((invoice) => invoice.invoiceId === selectedInvoiceId) || invoiceRecords[0] || null;
  const selectedInvoiceDetail = useAsyncValue(
    () => {
      if (!selectedInvoiceId) {
        return null;
      }

      return repository.invoices.getDetail(selectedInvoiceId);
    },
    [repository, selectedInvoiceId, refreshNonce],
  );
  const selectedInvoice = selectedInvoiceDetail.data || selectedListInvoice;

  const collectionPressureInvoices = useMemo(
    () =>
      invoiceRecords
        .filter((invoice) => ["failed", "partial"].includes(invoice.paymentStatus))
        .map((invoice) =>
          invoice.invoiceId === selectedInvoice?.invoiceId && selectedInvoice
            ? selectedInvoice
            : invoice,
        ),
    [invoiceRecords, selectedInvoice],
  );
  const retryInvoices = useMemo(
    () =>
      (data?.failedInvoices || []).map((invoice) =>
        invoice.invoiceId === selectedInvoice?.invoiceId && selectedInvoice ? selectedInvoice : invoice,
      ),
    [data?.failedInvoices, selectedInvoice],
  );

  useEffect(() => {
    if (!selectedInvoiceId && invoiceRecords[0]?.invoiceId) {
      setSelectedInvoiceId(invoiceRecords[0].invoiceId);
      return;
    }

    if (selectedInvoiceId && !invoiceRecords.some((invoice) => invoice.invoiceId === selectedInvoiceId)) {
      setSelectedInvoiceId(invoiceRecords[0]?.invoiceId || null);
    }
  }, [invoiceRecords, selectedInvoiceId]);

  const refreshInvoices = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshInvoices}>Refresh invoices</SecondaryButton>
      <PrimaryButton>Create invoice</PrimaryButton>
    </>
  );

  if (isLoading) {
    return (
      <PageScaffold {...INVOICES_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="Loading invoices" message="Fetching invoice balances and collection summaries." />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold {...INVOICES_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="Invoices unavailable" message={error?.message || "Invoice data could not be loaded."} />
      </PageScaffold>
    );
  }

  const { summaryCards } = data;

  if (invoiceRecords.length === 0) {
    return (
      <PageScaffold {...INVOICES_PAGE_SCAFFOLD} actions={actions}>
        <PageStateNotice title="No invoices found" message="The current data source returned an empty invoice queue." />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold {...INVOICES_PAGE_SCAFFOLD} actions={actions}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#e7ebf2] px-6 py-5">
            <p className="section-title">Invoices</p>
            <h2 className="mt-2 text-lg font-semibold">Collections queue</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Invoice</th>
                  <th className="px-5 py-4 font-semibold">Customer</th>
                  <th className="px-5 py-4 font-semibold">Amount</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Job</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRecords.map((invoice) => (
                  <tr
                    key={invoice.invoiceId}
                    className={`border-t border-[#edf0f5] transition hover:bg-slate-50 ${
                      selectedInvoice?.invoiceId === invoice.invoiceId ? "bg-indigo-50/70" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <button className="text-left" onClick={() => setSelectedInvoiceId(invoice.invoiceId)}>
                        <p className="font-semibold text-slate-900">{invoice.invoiceId}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {formatStatusLabel(invoice.invoiceType)}
                        </p>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{invoice.customer?.name}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatCurrency(invoice.totalAmount)}
                      <p className="mt-1 text-xs text-slate-400">
                        Balance {formatCurrency(invoice.outstandingBalance)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={getStatusTone(invoice.paymentStatus)}>{formatStatusLabel(invoice.paymentStatus)}</Badge>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{invoice.jobId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="section-title">Collection pressure</p>
            <h2 className="mt-2 text-lg font-semibold">Failed and partial payments</h2>
            <div className="mt-6 space-y-4">
              {collectionPressureInvoices.map((invoice) => (
                  <div key={invoice.invoiceId} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{invoice.customer?.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{invoice.jobId}</p>
                      </div>
                      <Badge tone={getStatusTone(invoice.paymentStatus)}>{formatStatusLabel(invoice.paymentStatus)}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      Balance due {formatCurrency(invoice.outstandingBalance)}
                    </p>
                  </div>
                ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="section-title">Retry list</p>
            <h2 className="mt-2 text-lg font-semibold">Needs manual follow-up</h2>
            <div className="mt-6 space-y-3">
              {retryInvoices.map((invoice) => (
                <div key={invoice.invoiceId} className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
                  <p className="font-medium text-slate-800">{invoice.customer?.name}</p>
                  <p className="mt-2 text-sm text-slate-500">{formatCurrency(invoice.outstandingBalance)} still outstanding</p>
                </div>
              ))}
            </div>
            {!selectedInvoice && selectedInvoiceId ? (
              <div className="mt-4">
                <PageStateNotice
                  title="Invoice detail unavailable"
                  message={selectedInvoiceDetail.error?.message || "Select an invoice to review collection details."}
                />
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
