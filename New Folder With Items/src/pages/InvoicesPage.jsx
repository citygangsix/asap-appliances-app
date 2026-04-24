import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/domain/finance";
import { getStatusTone, formatStatusLabel } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton, StatCard } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";

const INVOICES_PAGE_SCAFFOLD = {
  title: "Invoices",
  subtitle: "Open balances, same-day labor collection, and parts deposits laid out for fast follow-up.",
  tabs: [{ label: "Open Invoices", active: true }, { label: "Collections" }],
};

const INVOICE_FIELD_CLASS =
  "rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

const INVOICE_ACTION_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

async function postOperationsJson(pathname, payload, options = {}) {
  const { allowErrorResponse = false } = options;
  const response = await fetch(getLocalOperationsServerUrl(pathname), {
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

  if (!responseJson) {
    throw new Error(responseJson?.message || `Operations request failed with status ${response.status}.`);
  }

  if (!response.ok && !allowErrorResponse) {
    throw new Error(responseJson.message || `Operations request failed with status ${response.status}.`);
  }

  return responseJson;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDueStatusForInvoiceType(invoiceType) {
  return invoiceType === "labor" ? "labor_due" : "parts_due";
}

function getPaidStatusForInvoiceType(invoiceType) {
  return invoiceType === "labor" ? "labor_paid" : "parts_paid";
}

function getPaymentStatusOptions(invoiceType) {
  return [
    getDueStatusForInvoiceType(invoiceType),
    "partial",
    getPaidStatusForInvoiceType(invoiceType),
    "failed",
  ];
}

function buildCreateInvoiceDraft(invoice) {
  const invoiceType = invoice?.invoiceType || "labor";
  const totalAmount = invoice?.outstandingBalance || invoice?.totalAmount || 0;
  const issuedOn = getTodayDate();

  return {
    jobId: invoice?.jobId || "",
    invoiceNumber: "",
    invoiceType,
    paymentStatus: getDueStatusForInvoiceType(invoiceType),
    issuedOn,
    dueOn: issuedOn,
    totalAmount: String(totalAmount),
    collectedAmount: "0",
    techId: invoice?.techId || "",
    processorReference: "",
    notes: "",
  };
}

function buildPaymentDraft(invoice) {
  if (!invoice) {
    return {
      paymentStatus: "labor_due",
      collectedAmount: "0",
    };
  }

  return {
    paymentStatus: invoice.paymentStatus,
    collectedAmount: String(invoice.collectedAmount),
  };
}

function parseAmount(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InvoicesPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeMutationKey, setActiveMutationKey] = useState(null);
  const [invoiceFeedback, setInvoiceFeedback] = useState(null);
  const [createDraft, setCreateDraft] = useState(() => buildCreateInvoiceDraft(null));
  const [paymentDraft, setPaymentDraft] = useState(() => buildPaymentDraft(null));
  const { data, error, isLoading } = useAsyncValue(
    () => repository.getInvoicesPageData(),
    [repository, refreshNonce],
  );
  const invoiceRecords = data?.invoiceRecords || [];
  const techniciansQuery = useAsyncValue(() => repository.technicians.list(), [repository, refreshNonce]);
  const technicians = techniciansQuery.data || [];
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
  const createTotalAmount = parseAmount(createDraft.totalAmount);
  const createCollectedAmount = parseAmount(createDraft.collectedAmount);
  const createOutstandingBalance = createTotalAmount - createCollectedAmount;
  const paymentCollectedAmount = parseAmount(paymentDraft.collectedAmount);
  const paymentOutstandingBalance = Math.max((selectedInvoice?.totalAmount || 0) - paymentCollectedAmount, 0);

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

  useEffect(() => {
    setPaymentDraft(buildPaymentDraft(selectedInvoice));
  }, [selectedInvoice?.invoiceId, selectedInvoice?.paymentStatus, selectedInvoice?.collectedAmount]);

  const refreshInvoices = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const updateCreateDraft = (key, value) => {
    setCreateDraft((current) => {
      const next = { ...current, [key]: value };

      if (key === "invoiceType") {
        next.paymentStatus = getDueStatusForInvoiceType(value);
      }

      return next;
    });
  };

  const openCreateForm = () => {
    setCreateDraft(buildCreateInvoiceDraft(selectedInvoice || selectedListInvoice));
    setShowCreateForm(true);
  };

  const runCreateInvoice = async () => {
    if (!createDraft.jobId.trim()) {
      setInvoiceFeedback({
        message: "Job ID is required before creating an invoice.",
        tone: "amber",
      });
      return;
    }

    if (createTotalAmount <= 0) {
      setInvoiceFeedback({
        message: "Total amount must be greater than zero.",
        tone: "amber",
      });
      return;
    }

    if (createCollectedAmount < 0 || createCollectedAmount > createTotalAmount) {
      setInvoiceFeedback({
        message: "Collected amount must be between zero and the total amount.",
        tone: "amber",
      });
      return;
    }

    const actionKey = "create-invoice";
    setActiveMutationKey(actionKey);

    try {
      const result = await postOperationsJson(
        "/api/workflows/generate-invoice",
        {
          jobId: createDraft.jobId.trim(),
          invoiceNumber: createDraft.invoiceNumber.trim() || null,
          invoiceType: createDraft.invoiceType,
          paymentStatus: createDraft.paymentStatus,
          issuedOn: createDraft.issuedOn,
          dueOn: createDraft.dueOn || null,
          totalAmount: createTotalAmount,
          collectedAmount: createCollectedAmount,
          outstandingBalance: createOutstandingBalance,
          techId: createDraft.techId || null,
          processorReference: createDraft.processorReference.trim() || null,
          notes: createDraft.notes.trim() || null,
        },
        { allowErrorResponse: true },
      );

      setInvoiceFeedback({
        message: result.message,
        tone: result.ok ? "emerald" : "amber",
      });

      if (result.invoice?.invoiceId) {
        setSelectedInvoiceId(result.invoice.invoiceId);
        setShowCreateForm(false);
        refreshInvoices();
      }
    } catch (mutationError) {
      setInvoiceFeedback({
        message: mutationError.message,
        tone: "rose",
      });
    } finally {
      setActiveMutationKey(null);
    }
  };

  const runPaymentUpdate = async () => {
    if (!selectedInvoice) {
      return;
    }

    if (paymentCollectedAmount < 0 || paymentCollectedAmount > selectedInvoice.totalAmount) {
      setInvoiceFeedback({
        message: "Collected amount must be between zero and the invoice total.",
        tone: "amber",
      });
      return;
    }

    const paidStatus = getPaidStatusForInvoiceType(selectedInvoice.invoiceType);
    const isPaid = paymentDraft.paymentStatus === paidStatus;
    const isFailed = paymentDraft.paymentStatus === "failed";
    const patch = {
      paymentStatus: paymentDraft.paymentStatus,
      collectedAmount: paymentCollectedAmount,
      outstandingBalance: paymentOutstandingBalance,
      paidAt: isPaid ? new Date().toISOString() : null,
      paymentFailedAt: isFailed ? new Date().toISOString() : null,
    };

    const actionKey = `update-payment:${selectedInvoice.invoiceId}`;
    setActiveMutationKey(actionKey);

    try {
      const result = await repository.invoices.updatePaymentStatus(selectedInvoice.invoiceId, patch);

      setInvoiceFeedback({
        message: result.message,
        tone:
          result.source === "mock"
            ? "amber"
            : result.ok
              ? "emerald"
              : "rose",
      });

      if (result.ok) {
        if (isPaid) {
          try {
            const paidWorkflowResult = await postOperationsJson("/api/workflows/invoice-paid", {
              invoiceId: selectedInvoice.invoiceId,
            });

            setInvoiceFeedback({
              message: `${result.message} ${paidWorkflowResult.message}`,
              tone: paidWorkflowResult.ok ? "emerald" : "amber",
            });
          } catch (workflowError) {
            setInvoiceFeedback({
              message: `${result.message} Paid confirmation failed: ${workflowError.message}`,
              tone: "amber",
            });
          }
        }

        refreshInvoices();
      }
    } catch (mutationError) {
      setInvoiceFeedback({
        message: mutationError.message,
        tone: "rose",
      });
    } finally {
      setActiveMutationKey(null);
    }
  };

  const actions = (
    <>
      <SecondaryButton onClick={refreshInvoices}>Refresh invoices</SecondaryButton>
      <PrimaryButton onClick={openCreateForm}>Create invoice</PrimaryButton>
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

  return (
    <PageScaffold {...INVOICES_PAGE_SCAFFOLD} actions={actions}>
      {invoiceFeedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${INVOICE_ACTION_TONES[invoiceFeedback.tone]}`}>
          {invoiceFeedback.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      {showCreateForm ? (
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-title">Create invoice</p>
              <h2 className="mt-2 text-lg font-semibold">Add a billable record for a job</h2>
            </div>
            <SecondaryButton onClick={() => setShowCreateForm(false)}>Close</SecondaryButton>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Invoice number
              <input
                value={createDraft.invoiceNumber}
                onChange={(event) => updateCreateDraft("invoiceNumber", event.target.value)}
                className={INVOICE_FIELD_CLASS}
                placeholder="Optional override"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Job ID
              <input
                value={createDraft.jobId}
                onChange={(event) => updateCreateDraft("jobId", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Invoice type
              <select
                value={createDraft.invoiceType}
                onChange={(event) => updateCreateDraft("invoiceType", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              >
                <option value="parts_deposit">Parts deposit</option>
                <option value="parts_payment">Parts payment</option>
                <option value="labor">Labor</option>
                <option value="parts_and_labor">Parts and labor</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Payment status
              <select
                value={createDraft.paymentStatus}
                onChange={(event) => updateCreateDraft("paymentStatus", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              >
                {getPaymentStatusOptions(createDraft.invoiceType).map((status) => (
                  <option key={`create-${status}`} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Issued on
              <input
                type="date"
                value={createDraft.issuedOn}
                onChange={(event) => updateCreateDraft("issuedOn", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Due on
              <input
                type="date"
                value={createDraft.dueOn}
                onChange={(event) => updateCreateDraft("dueOn", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Total amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={createDraft.totalAmount}
                onChange={(event) => updateCreateDraft("totalAmount", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Collected amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={createDraft.collectedAmount}
                onChange={(event) => updateCreateDraft("collectedAmount", event.target.value)}
                className={INVOICE_FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Technician
              <select
                value={createDraft.techId}
                onChange={(event) => updateCreateDraft("techId", event.target.value)}
                className={INVOICE_FIELD_CLASS}
                disabled={techniciansQuery.isLoading}
              >
                <option value="">No technician</option>
                {technicians.map((tech) => (
                  <option key={tech.techId} value={tech.techId}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Processor reference
              <input
                value={createDraft.processorReference}
                onChange={(event) => updateCreateDraft("processorReference", event.target.value)}
                className={INVOICE_FIELD_CLASS}
                placeholder="txn_..."
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400 md:col-span-2 xl:col-span-2">
              Notes
              <textarea
                value={createDraft.notes}
                onChange={(event) => updateCreateDraft("notes", event.target.value)}
                className={`${INVOICE_FIELD_CLASS} min-h-[104px]`}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>Create uses the live invoice workflow and will send the existing assistant and customer notifications.</span>
            <span>Outstanding balance will be {formatCurrency(createOutstandingBalance)}</span>
            <PrimaryButton
              onClick={runCreateInvoice}
              disabled={
                activeMutationKey === "create-invoice" ||
                techniciansQuery.isLoading
              }
            >
              {activeMutationKey === "create-invoice" ? "Saving..." : "Create invoice"}
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      {invoiceRecords.length === 0 ? (
        <PageStateNotice title="No invoices found" message="Create the first invoice to start the collections queue." />
      ) : (
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
              <p className="section-title">Selected invoice</p>
              <h2 className="mt-2 text-lg font-semibold">
                {selectedInvoice?.invoiceId || "Select an invoice"}
              </h2>

              {!selectedInvoice && selectedInvoiceId ? (
                <div className="mt-4">
                  <PageStateNotice
                    title="Invoice detail unavailable"
                    message={selectedInvoiceDetail.error?.message || "Select an invoice to review collection details."}
                  />
                </div>
              ) : selectedInvoice ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">{selectedInvoice.customer?.name || "Unknown customer"}</p>
                    <p className="mt-1">{selectedInvoice.jobId}</p>
                    <p className="mt-2">Total {formatCurrency(selectedInvoice.totalAmount)}</p>
                    <p className="mt-1">Collected {formatCurrency(selectedInvoice.collectedAmount)}</p>
                    <p className="mt-1">Outstanding {formatCurrency(selectedInvoice.outstandingBalance)}</p>
                  </div>

                  <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Payment status
                    <select
                      value={paymentDraft.paymentStatus}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({ ...current, paymentStatus: event.target.value }))
                      }
                      className={INVOICE_FIELD_CLASS}
                    >
                      {getPaymentStatusOptions(selectedInvoice.invoiceType).map((status) => (
                        <option key={`payment-${status}`} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Collected amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentDraft.collectedAmount}
                      onChange={(event) =>
                        setPaymentDraft((current) => ({ ...current, collectedAmount: event.target.value }))
                      }
                      className={INVOICE_FIELD_CLASS}
                    />
                  </label>

                  <div className="rounded-2xl border border-[#e1e6ef] bg-white p-4 text-sm text-slate-600">
                    New outstanding balance: {formatCurrency(paymentOutstandingBalance)}
                  </div>

                  <PrimaryButton
                    onClick={runPaymentUpdate}
                    disabled={activeMutationKey === `update-payment:${selectedInvoice.invoiceId}`}
                  >
                    {activeMutationKey === `update-payment:${selectedInvoice.invoiceId}`
                      ? "Saving..."
                      : "Update payment status"}
                  </PrimaryButton>
                </div>
              ) : null}
            </Card>

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
            </Card>
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
