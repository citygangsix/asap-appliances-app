import { useEffect, useState } from "react";
import { formatCurrency } from "../lib/domain/finance";
import { getStatusTone, formatStatusLabel } from "../lib/domain/jobs";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { CallInsightsPanel } from "../components/communications/CallInsightsPanel";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";

const CUSTOMERS_PAGE_SCAFFOLD = {
  title: "Customers",
  subtitle: "Customer profiles, communication health, and open balances organized for office follow-up.",
  tabs: [{ label: "Directory", active: true }, { label: "Accounts" }],
  contentClassName: "grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.35fr_0.9fr] lg:p-8",
};

const CUSTOMER_FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500";

const CUSTOMER_FEEDBACK_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const RECORDED_BUSINESS_CALL_OPTIONS = [
  {
    id: "asap-main-9819",
    label: "Call from 561-576-9819",
    phone: "+15615769819",
  },
];

const MANUAL_CALL_PHONE_OPTIONS = [
  {
    id: "asap-main-9819",
    label: "561-576-9819",
    phone: "+15615769819",
  },
  {
    id: "assistant-1545",
    label: "561-564-1545",
    phone: "+15615641545",
  },
];

const MANUAL_CALL_OUTCOME_OPTIONS = [
  { value: "voicemail_left", label: "Voicemail left" },
  { value: "no_answer", label: "No answer" },
  { value: "connected", label: "Connected" },
];

function createEmptyCustomerDraft() {
  return {
    name: "",
    primaryPhone: "",
    secondaryPhone: "",
    email: "",
    city: "",
    serviceArea: "",
    customerSegment: "",
    communicationStatus: "clear",
    notes: "",
  };
}

function buildCustomerDraftFromProfile(customer) {
  return {
    name: customer.name || "",
    primaryPhone: customer.primaryPhone || "",
    secondaryPhone: customer.secondaryPhone || "",
    email: customer.email || "",
    city: customer.city || "",
    serviceArea: customer.serviceArea || "",
    customerSegment: customer.customerSegment || "",
    communicationStatus: customer.communicationStatus || "clear",
    notes: customer.notes || "",
  };
}

function normalizeNullableField(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildCustomerPayload(formState) {
  return {
    name: formState.name.trim(),
    primaryPhone: formState.primaryPhone.trim(),
    secondaryPhone: normalizeNullableField(formState.secondaryPhone),
    email: normalizeNullableField(formState.email),
    city: formState.city.trim(),
    serviceArea: formState.serviceArea.trim(),
    customerSegment: formState.customerSegment.trim(),
    communicationStatus: formState.communicationStatus,
    notes: normalizeNullableField(formState.notes),
  };
}

function buildActionsWithRefresh(onRefresh = undefined, onToggleAdd = undefined, isAdding = false) {
  return (
    <>
      <SecondaryButton onClick={onRefresh}>Refresh customers</SecondaryButton>
      <PrimaryButton onClick={onToggleAdd}>{isAdding ? "Cancel add" : "Add customer"}</PrimaryButton>
    </>
  );
}

async function requestClickToCall(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/twilio/outbound/calls"), {
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

  if (!response.ok || !responseJson) {
    throw new Error(responseJson?.message || `Click-to-call failed with status ${response.status}.`);
  }

  if (!responseJson.ok) {
    throw new Error(responseJson.message || "Click-to-call failed.");
  }

  return responseJson;
}

async function requestManualCallLog(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/manual/calls/log"), {
    method: "POST",
    headers: getLocalOperationsServerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  const responseJson = responseText ? JSON.parse(responseText) : null;

  if (!response.ok || !responseJson?.ok) {
    throw new Error(responseJson?.message || `Manual call log failed with status ${response.status}.`);
  }

  return responseJson;
}

export function CustomersPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState(createEmptyCustomerDraft);
  const [customerEditDraft, setCustomerEditDraft] = useState(createEmptyCustomerDraft);
  const [manualCustomerCallDraft, setManualCustomerCallDraft] = useState({
    agentPhone: MANUAL_CALL_PHONE_OPTIONS[0].phone,
    callOutcome: "voicemail_left",
    note: "",
  });
  const [activeActionKey, setActiveActionKey] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const { data, error, isLoading } = useAsyncValue(() => repository.getCustomersPageData(), [repository, refreshNonce]);
  const directory = data?.customerRecords || [];
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerCallId, setSelectedCustomerCallId] = useState(null);
  const activeSelectedCustomerId = selectedCustomerId || directory[0]?.customerId || null;
  const selectedCustomerSummary =
    directory.find((customer) => customer.customerId === activeSelectedCustomerId) || directory[0] || null;

  const refreshCustomers = () => {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  };

  const actions = buildActionsWithRefresh(
    refreshCustomers,
    () => {
      setActionFeedback(null);
      setIsAddingCustomer((current) => {
        if (current) {
          setCustomerDraft(createEmptyCustomerDraft());
        }

        return !current;
      });
    },
    isAddingCustomer,
  );

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
  const customerCalls =
    selectedCustomerProfile?.communicationRecords?.filter(
      (communication) => communication.communicationChannel === "call",
    ) || [];
  const selectedCustomerCall =
    customerCalls.find((communication) => communication.communicationId === selectedCustomerCallId) ||
    customerCalls[0] ||
    null;

  useEffect(() => {
    if (!selectedCustomerProfile) {
      return;
    }

    setCustomerEditDraft(buildCustomerDraftFromProfile(selectedCustomerProfile));
  }, [selectedCustomerProfile]);

  useEffect(() => {
    if (!selectedCustomerProfile) {
      setSelectedCustomerCallId(null);
      return;
    }

    setSelectedCustomerCallId((current) => {
      if (current && customerCalls.some((communication) => communication.communicationId === current)) {
        return current;
      }

      return customerCalls[0]?.communicationId || null;
    });
  }, [customerCalls, selectedCustomerProfile]);

  useEffect(() => {
    if (!selectedCustomerId && directory[0]?.customerId) {
      setSelectedCustomerId(directory[0].customerId);
      return;
    }

    if (selectedCustomerId && !directory.some((customer) => customer.customerId === selectedCustomerId)) {
      setSelectedCustomerId(directory[0]?.customerId || null);
    }
  }, [directory, selectedCustomerId]);

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

  const runMutation = async (actionKey, operation, options = {}) => {
    setActiveActionKey(actionKey);

    try {
      const result = await operation();
      setMutationFeedback(result);

      if (result.ok) {
        options.onSuccess?.(result);
        refreshCustomers();
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

  const validateCustomerPayload = (payload) =>
    Boolean(
      payload.name &&
        payload.primaryPhone &&
        payload.city &&
        payload.serviceArea &&
        payload.customerSegment,
    );

  const runCreateCustomer = async () => {
    const payload = buildCustomerPayload(customerDraft);

    if (!validateCustomerPayload(payload)) {
      setActionFeedback({
        message: "Name, primary phone, city, service area, and customer segment are required.",
        tone: "amber",
      });
      return;
    }

    return runMutation("customer:create", () => repository.customers.create(payload), {
      onSuccess(result) {
        if (result.record?.customerId) {
          setSelectedCustomerId(result.record.customerId);
        }

        setIsAddingCustomer(false);
        setCustomerDraft(createEmptyCustomerDraft());
      },
    });
  };

  const runUpdateCustomer = async () => {
    if (!selectedCustomerProfile) {
      return;
    }

    const payload = buildCustomerPayload(customerEditDraft);

    if (!validateCustomerPayload(payload)) {
      setActionFeedback({
        message: "Name, primary phone, city, service area, and customer segment are required.",
        tone: "amber",
      });
      return;
    }

    return runMutation(
      `customer:update:${selectedCustomerProfile.customerId}`,
      () => repository.customers.update(selectedCustomerProfile.customerId, payload),
      {
        onSuccess(result) {
          if (result.record?.customerId) {
            setSelectedCustomerId(result.record.customerId);
          }
        },
      },
    );
  };

  const runClickToCall = async (businessPhoneNumber) => {
    if (!selectedCustomerProfile) {
      return;
    }

    const customerPhone = selectedCustomerProfile.primaryPhone || selectedCustomerProfile.secondaryPhone || null;

    if (!customerPhone) {
      setActionFeedback({
        message: "This customer does not have a phone number available for click-to-call.",
        tone: "amber",
      });
      return;
    }

    const actionKey = `customer:call:${selectedCustomerProfile.customerId}:${businessPhoneNumber}`;
    setActiveActionKey(actionKey);

    try {
      const result = await requestClickToCall({
        customerId: selectedCustomerProfile.customerId,
        customerName: selectedCustomerProfile.name,
        customerPhone,
        businessPhoneNumber,
        jobId: selectedCustomerProfile.activeJob?.jobId || null,
        triggerSource: "manual_ui",
      });

      setActionFeedback({
        message:
          result.message ||
          `Twilio is calling the configured office phone first from ${businessPhoneNumber}. After you answer, the customer conversation will be recorded and pushed into the CRM.`,
        tone: "emerald",
      });
    } catch (callError) {
      setActionFeedback({
        message: callError.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const runManualCustomerCallLog = async () => {
    if (!selectedCustomerProfile) {
      return;
    }

    if (!manualCustomerCallDraft.note.trim()) {
      setActionFeedback({
        message: "Add a short note about the voicemail or off-system call before saving it.",
        tone: "amber",
      });
      return;
    }

    const actionKey = `customer:manual-log:${selectedCustomerProfile.customerId}`;
    setActiveActionKey(actionKey);

    try {
      const result = await requestManualCallLog({
        mode: "customer",
        customerId: selectedCustomerProfile.customerId,
        customerPhone: selectedCustomerProfile.primaryPhone || selectedCustomerProfile.secondaryPhone,
        jobId: selectedCustomerProfile.activeJob?.jobId || null,
        agentPhone: manualCustomerCallDraft.agentPhone,
        callOutcome: manualCustomerCallDraft.callOutcome,
        note: manualCustomerCallDraft.note,
      });

      setActionFeedback({
        message: result.message,
        tone: "emerald",
      });
      setManualCustomerCallDraft((current) => ({
        ...current,
        note: "",
      }));
      refreshCustomers();
    } catch (callError) {
      setActionFeedback({
        message: callError.message,
        tone: "rose",
      });
    } finally {
      setActiveActionKey(null);
    }
  };

  const renderCustomerForm = (formState, setFormState, actionLabel, actionKey, onSubmit) => (
    <div className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-600">
          Name
          <input
            value={formState.name}
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Primary phone
          <input
            value={formState.primaryPhone}
            onChange={(event) => setFormState((current) => ({ ...current, primaryPhone: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Secondary phone
          <input
            value={formState.secondaryPhone}
            onChange={(event) => setFormState((current) => ({ ...current, secondaryPhone: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Email
          <input
            value={formState.email}
            onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          City
          <input
            value={formState.city}
            onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Service area
          <input
            value={formState.serviceArea}
            onChange={(event) => setFormState((current) => ({ ...current, serviceArea: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Segment
          <input
            value={formState.customerSegment}
            onChange={(event) => setFormState((current) => ({ ...current, customerSegment: event.target.value }))}
            className={CUSTOMER_FIELD_CLASS}
          />
        </label>
        <label className="text-sm font-medium text-slate-600">
          Communication status
          <select
            value={formState.communicationStatus}
            onChange={(event) =>
              setFormState((current) => ({ ...current, communicationStatus: event.target.value }))
            }
            className={CUSTOMER_FIELD_CLASS}
          >
            <option value="clear">Clear</option>
            <option value="awaiting_callback">Awaiting callback</option>
            <option value="unread_message">Unread message</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-600">
        Notes
        <textarea
          value={formState.notes}
          onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
          rows={4}
          className={`${CUSTOMER_FIELD_CLASS} resize-none`}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <PrimaryButton onClick={onSubmit} disabled={activeActionKey === actionKey}>
          {activeActionKey === actionKey ? "Saving..." : actionLabel}
        </PrimaryButton>
      </div>
    </div>
  );

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
      {actionFeedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${CUSTOMER_FEEDBACK_TONES[actionFeedback.tone]}`}>
          {actionFeedback.message}
        </div>
      ) : null}

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
              type="button"
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
        <p className="section-title">{isAddingCustomer ? "Add customer" : "Customer detail"}</p>
        <h2 className="mt-2 text-lg font-semibold">
          {isAddingCustomer ? "Create customer profile" : selectedCustomerSummary.name}
        </h2>

        {isAddingCustomer ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Create the customer first, then link jobs, communications, and invoices against the new profile.
              </p>
            </div>
            {renderCustomerForm(customerDraft, setCustomerDraft, "Create customer", "customer:create", runCreateCustomer)}
          </div>
        ) : selectedCustomerProfileError ? (
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
              {selectedCustomerProfile.secondaryPhone ? (
                <p className="mt-1 text-sm text-slate-500">{selectedCustomerProfile.secondaryPhone}</p>
              ) : null}
              {selectedCustomerProfile.email ? (
                <p className="mt-1 text-sm text-slate-500">{selectedCustomerProfile.email}</p>
              ) : null}
              <p className="mt-1 text-sm text-slate-500">
                {selectedCustomerProfile.city} · {selectedCustomerProfile.serviceArea}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Start a recorded CRM bridge from the ASAP business line for transcription and auto-population.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {RECORDED_BUSINESS_CALL_OPTIONS.map((option) => {
                  const actionKey = `customer:call:${selectedCustomerProfile.customerId}:${option.phone}`;

                  return (
                    <SecondaryButton
                      key={option.id}
                      onClick={() => runClickToCall(option.phone)}
                      disabled={activeActionKey === actionKey}
                    >
                      {activeActionKey === actionKey ? "Starting call..." : option.label}
                    </SecondaryButton>
                  );
                })}
              </div>
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

            <div className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Off-system Call Fallback
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                If you called from your normal phone app instead of the CRM button, log the voicemail or call notes here so the CRM still captures it.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-600">
                  Phone used
                  <select
                    value={manualCustomerCallDraft.agentPhone}
                    onChange={(event) =>
                      setManualCustomerCallDraft((current) => ({
                        ...current,
                        agentPhone: event.target.value,
                      }))
                    }
                    className={CUSTOMER_FIELD_CLASS}
                  >
                    {MANUAL_CALL_PHONE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.phone}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-600">
                  Outcome
                  <select
                    value={manualCustomerCallDraft.callOutcome}
                    onChange={(event) =>
                      setManualCustomerCallDraft((current) => ({
                        ...current,
                        callOutcome: event.target.value,
                      }))
                    }
                    className={CUSTOMER_FIELD_CLASS}
                  >
                    {MANUAL_CALL_OUTCOME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-600">
                What happened on the call?
                <textarea
                  value={manualCustomerCallDraft.note}
                  onChange={(event) =>
                    setManualCustomerCallDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Example: Called from 561-576-9819, customer did not answer, left voicemail about tomorrow morning availability and asked for callback."
                  className={`${CUSTOMER_FIELD_CLASS} resize-none`}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <PrimaryButton
                  onClick={runManualCustomerCallLog}
                  disabled={activeActionKey === `customer:manual-log:${selectedCustomerProfile.customerId}`}
                >
                  {activeActionKey === `customer:manual-log:${selectedCustomerProfile.customerId}`
                    ? "Saving call note..."
                    : "Save off-system call"}
                </PrimaryButton>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e1e6ef] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Customer calls
              </p>
              {!selectedCustomerCall ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-500">
                    No recorded calls have been linked to this customer yet.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3">
                    {customerCalls.map((communication) => (
                      <button
                        key={communication.communicationId}
                        onClick={() => setSelectedCustomerCallId(communication.communicationId)}
                        type="button"
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selectedCustomerCall?.communicationId === communication.communicationId
                            ? "border-indigo-300 bg-indigo-50/70"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {communication.occurredAtLabel || "Recent"} ·{" "}
                            {formatStatusLabel(communication.communicationStatus)}
                          </p>
                          <Badge tone={getStatusTone(communication.communicationStatus)}>
                            {formatStatusLabel(communication.communicationStatus)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {communication.callHighlights ||
                            communication.extractedEventLabel ||
                            communication.previewText}
                        </p>
                      </button>
                    ))}
                  </div>

                  <CallInsightsPanel communication={selectedCustomerCall} />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#e1e6ef] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Edit profile</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">Basic customer details</h3>
              <div className="mt-4">
                {renderCustomerForm(
                  customerEditDraft,
                  setCustomerEditDraft,
                  "Update customer",
                  `customer:update:${selectedCustomerProfile.customerId}`,
                  runUpdateCustomer,
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </PageScaffold>
  );
}
