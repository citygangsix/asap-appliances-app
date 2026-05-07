import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import {
  buildContactDirectory,
  contactMatchesSearch,
  formatUsPhone,
  getContactTypeTone,
} from "../lib/domain/contacts";
import { getOperationsRepository } from "../lib/repositories";

const CONTACT_FILTERS = [
  { value: "all", label: "All contacts" },
  { value: "customer", label: "Customers" },
  { value: "technician", label: "Technicians" },
];

function buildPhoneRoute(contact, mode) {
  const params = new URLSearchParams({
    contactType: contact.contactType,
    mode,
    name: contact.name || "",
    phone: contact.primaryPhone || "",
  });

  return `/dashboard/phone?${params.toString()}`;
}

function getContactCounts(contacts) {
  const customers = contacts.filter((contact) => contact.contactType === "customer");
  const technicians = contacts.filter((contact) => contact.contactType === "technician");

  return {
    total: contacts.length,
    customers: customers.length,
    technicians: technicians.length,
    customerFollowUps: customers.filter((contact) => contact.status !== "clear").length,
    activeTechnicians: technicians.filter((contact) => ["en_route", "onsite", "late"].includes(contact.status)).length,
  };
}

function SummaryTile({ label, value, detail }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </Card>
  );
}

function ContactRow({ contact, active, onSelect }) {
  return (
    <button
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? "border-indigo-300 bg-indigo-50 shadow-sm"
          : "border-[#d8ddea] bg-white hover:border-indigo-200 hover:bg-slate-50"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-slate-950">{contact.name}</p>
        <Badge tone={getContactTypeTone(contact.contactType)}>{contact.typeLabel}</Badge>
        <Badge tone={contact.statusTone}>{contact.statusLabel}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {[formatUsPhone(contact.primaryPhone) || "No phone", contact.summaryLine].filter(Boolean).join(" · ")}
      </p>
    </button>
  );
}

function ContactDetailPanel({ contact }) {
  if (!contact) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-500">No contact selected.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 lg:sticky lg:top-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-slate-950">{contact.name}</h2>
            <Badge tone={getContactTypeTone(contact.contactType)}>{contact.typeLabel}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{contact.summaryLine}</p>
        </div>
        <Badge tone={contact.statusTone}>{contact.statusLabel}</Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          to={buildPhoneRoute(contact, "call")}
        >
          Call
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600"
          to={buildPhoneRoute(contact, "text")}
        >
          Text
        </Link>
      </div>

      <div className="mt-6 grid gap-3">
        {contact.detailRows.map((row) => (
          <div
            className="rounded-xl border border-[#d8ddea] bg-slate-50 px-4 py-3"
            key={`${contact.id}:${row.label}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {row.label}
            </p>
            <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-800">{row.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ContactsPage() {
  const repository = getOperationsRepository();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const [contactFilter, setContactFilter] = useState("all");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const customersQuery = useAsyncValue(() => repository.customers.list(), [repository, refreshNonce]);
  const techniciansQuery = useAsyncValue(() => repository.technicians.list(), [repository, refreshNonce]);
  const contactDirectory = useMemo(
    () => buildContactDirectory(customersQuery.data || [], techniciansQuery.data || []),
    [customersQuery.data, techniciansQuery.data],
  );
  const filteredContacts = useMemo(
    () =>
      contactDirectory
        .filter((contact) => contactFilter === "all" || contact.contactType === contactFilter)
        .filter((contact) => contactMatchesSearch(contact, searchValue)),
    [contactDirectory, contactFilter, searchValue],
  );
  const selectedContact =
    filteredContacts.find((contact) => contact.id === selectedContactId) || filteredContacts[0] || null;
  const counts = useMemo(() => getContactCounts(contactDirectory), [contactDirectory]);
  const pageError = customersQuery.error || techniciansQuery.error;
  const isLoading = customersQuery.isLoading || techniciansQuery.isLoading;
  const tabs = CONTACT_FILTERS.map((filter) => ({
    id: filter.value,
    label: filter.label,
    active: contactFilter === filter.value,
    onClick: () => setContactFilter(filter.value),
  }));

  useEffect(() => {
    if (!selectedContactId && selectedContact?.id) {
      setSelectedContactId(selectedContact.id);
      return;
    }

    if (selectedContactId && !filteredContacts.some((contact) => contact.id === selectedContactId)) {
      setSelectedContactId(selectedContact?.id || null);
    }
  }, [filteredContacts, selectedContact, selectedContactId]);

  function refreshContacts() {
    repository.clearRuntimeCaches?.();
    setRefreshNonce((current) => current + 1);
  }

  const actions = (
    <>
      <SecondaryButton onClick={refreshContacts}>Refresh contacts</SecondaryButton>
      <PrimaryButton onClick={() => setSearchValue("")}>Clear search</PrimaryButton>
    </>
  );

  if (isLoading && contactDirectory.length === 0) {
    return (
      <PageScaffold
        title="Contacts"
        subtitle="All customers and technicians in one searchable CRM directory."
        actions={actions}
        tabs={tabs}
      >
        <PageStateNotice title="Loading contacts" message="Fetching customer and technician records." />
      </PageScaffold>
    );
  }

  if (pageError && contactDirectory.length === 0) {
    return (
      <PageScaffold
        title="Contacts"
        subtitle="All customers and technicians in one searchable CRM directory."
        actions={actions}
        tabs={tabs}
      >
        <PageStateNotice title="Contacts unavailable" message={pageError.message} />
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Contacts"
      subtitle="All customers and technicians in one searchable CRM directory."
      actions={actions}
      tabs={tabs}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="All contacts"
          value={counts.total}
          detail={`${counts.customers} customers and ${counts.technicians} technicians`}
        />
        <SummaryTile
          label="Customer follow-up"
          value={counts.customerFollowUps}
          detail="Customers with callbacks, unread messages, or unresolved communication"
        />
        <SummaryTile
          label="Active technicians"
          value={counts.activeTechnicians}
          detail="Technicians en route, onsite, or running late today"
        />
      </div>

      <Card className="p-5">
        <label className="block text-sm font-semibold text-slate-600">
          Search contacts
          <input
            className="mt-2 w-full rounded-2xl border border-[#cfd6e2] bg-white px-4 py-3 text-base font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name, phone, area, skill, status, or email"
            type="search"
            value={searchValue}
          />
        </label>
        {pageError ? <p className="mt-3 text-sm leading-6 text-rose-600">{pageError.message}</p> : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="section-title">Directory</p>
            <Badge tone="slate">{filteredContacts.length} shown</Badge>
          </div>
          {filteredContacts.length ? (
            filteredContacts.map((contact) => (
              <ContactRow
                active={selectedContact?.id === contact.id}
                contact={contact}
                key={contact.id}
                onSelect={() => setSelectedContactId(contact.id)}
              />
            ))
          ) : (
            <Card className="p-5">
              <p className="text-sm text-slate-500">No matching contacts.</p>
            </Card>
          )}
        </div>

        <ContactDetailPanel contact={selectedContact} />
      </div>
    </PageScaffold>
  );
}
