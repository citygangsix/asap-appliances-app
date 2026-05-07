import { formatCurrency } from "./finance";
import { formatStatusLabel, getStatusTone } from "./jobs";

export function onlyPhoneDigits(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 11);
}

export function normalizePhoneLookup(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function sanitizeDialValue(value) {
  return String(value ?? "").replace(/[^\d*#]/g, "").slice(0, 32);
}

export function toE164(value) {
  if (/[*#]/u.test(String(value ?? ""))) {
    return "";
  }

  const digits = onlyPhoneDigits(value);
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return "";
}

export function formatUsPhone(value) {
  if (/[*#]/u.test(String(value ?? ""))) {
    return value;
  }

  const digits = onlyPhoneDigits(value);
  const nationalDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (nationalDigits.length <= 3) {
    return nationalDigits;
  }

  if (nationalDigits.length <= 6) {
    return `(${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3)}`;
  }

  return `(${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3, 6)}-${nationalDigits.slice(6, 10)}`;
}

export function getContactTypeLabel(contactType) {
  return contactType === "technician" ? "technician" : "customer";
}

export function getContactTypeTitle(contactType) {
  return contactType === "technician" ? "Technician" : "Customer";
}

export function getContactTypeTone(contactType) {
  return contactType === "technician" ? "blue" : "emerald";
}

function joinDetails(values, separator = " · ") {
  return values.filter(Boolean).join(separator);
}

function createDetailRow(label, value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return null;
  }

  return { label, value: normalizedValue };
}

function compactRows(rows) {
  return rows.filter(Boolean);
}

function formatOptionalCurrency(value) {
  return typeof value === "number" ? formatCurrency(value) : null;
}

function buildCustomerDetailRows(customer) {
  const activeJob = customer.activeJob || null;

  return compactRows([
    createDetailRow("Primary phone", formatUsPhone(customer.primaryPhone) || customer.primaryPhone),
    createDetailRow("Secondary phone", formatUsPhone(customer.secondaryPhone) || customer.secondaryPhone),
    createDetailRow("Email", customer.email),
    createDetailRow("City", customer.city),
    createDetailRow("Service area", customer.serviceArea),
    createDetailRow("Segment", customer.customerSegment),
    createDetailRow("Open balance", formatOptionalCurrency(customer.openBalance)),
    createDetailRow(
      "Active job",
      activeJob
        ? joinDetails([activeJob.jobId, activeJob.applianceLabel, activeJob.scheduledStartLabel])
        : customer.activeJobId,
    ),
    createDetailRow("Latest communication", customer.latestCommunication || customer.lastContactLabel),
    createDetailRow("Notes", customer.notes),
  ]);
}

function buildTechnicianDetailRows(technician) {
  return compactRows([
    createDetailRow("Primary phone", formatUsPhone(technician.primaryPhone) || technician.primaryPhone),
    createDetailRow("Email", technician.email),
    createDetailRow("Service area", technician.serviceArea),
    createDetailRow("Availability", technician.availabilityLabel),
    createDetailRow("Skills", technician.skills?.join(", ")),
    createDetailRow("ZIP coverage", technician.serviceZipCodes?.slice(0, 12).join(", ")),
    createDetailRow("Jobs this week", technician.jobsCompletedThisWeek),
    createDetailRow(
      "Callback rate",
      typeof technician.callbackRatePercent === "number" ? `${technician.callbackRatePercent.toFixed(1)}%` : null,
    ),
    createDetailRow("Score", typeof technician.score === "number" ? `${technician.score}/100` : null),
    createDetailRow("Payout total", formatOptionalCurrency(technician.payoutTotal)),
    createDetailRow("Gas reimbursement", formatOptionalCurrency(technician.gasReimbursementTotal)),
  ]);
}

function buildSearchText(contact) {
  return [
    contact.name,
    contact.typeLabel,
    contact.primaryPhone,
    contact.secondaryPhone,
    contact.email,
    contact.label,
    contact.locationLabel,
    contact.statusLabel,
    contact.detailRows.map((row) => row.value).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildCustomerContact(customer) {
  const detailRows = buildCustomerDetailRows(customer);
  const contact = {
    id: `customer:${customer.customerId}`,
    sourceId: customer.customerId,
    contactType: "customer",
    typeLabel: "Customer",
    name: customer.name,
    primaryPhone: customer.primaryPhone || "",
    secondaryPhone: customer.secondaryPhone || "",
    email: customer.email || "",
    label: customer.customerSegment || customer.serviceArea || "Customer",
    locationLabel: joinDetails([customer.city, customer.serviceArea]),
    status: customer.communicationStatus || "clear",
    statusLabel: formatStatusLabel(customer.communicationStatus || "clear"),
    statusTone: getStatusTone(customer.communicationStatus || "clear"),
    detailRows,
    summaryLine: joinDetails([
      customer.customerSegment || "Customer",
      customer.serviceArea,
      customer.activeJob?.jobId || customer.activeJobId,
    ]),
    raw: customer,
  };

  return {
    ...contact,
    searchText: buildSearchText(contact),
  };
}

function buildTechnicianContact(technician) {
  const detailRows = buildTechnicianDetailRows(technician);
  const contact = {
    id: `technician:${technician.techId}`,
    sourceId: technician.techId,
    contactType: "technician",
    typeLabel: "Technician",
    name: technician.name,
    primaryPhone: technician.primaryPhone || "",
    secondaryPhone: "",
    email: technician.email || "",
    label: technician.serviceArea || "Technician",
    locationLabel: technician.serviceArea || "",
    status: technician.statusToday || "unassigned",
    statusLabel: formatStatusLabel(technician.statusToday || "unassigned"),
    statusTone: getStatusTone(technician.statusToday || "unassigned"),
    detailRows,
    summaryLine: joinDetails([
      technician.serviceArea,
      technician.availabilityLabel,
      technician.skills?.slice(0, 2).join(", "),
    ]),
    raw: technician,
  };

  return {
    ...contact,
    searchText: buildSearchText(contact),
  };
}

export function buildContactDirectory(customers = [], technicians = []) {
  return [
    ...customers.map(buildCustomerContact),
    ...technicians.map(buildTechnicianContact),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

export function buildManualContactSummary({ contactType = "customer", name = "", phone = "" }) {
  const typeLabel = getContactTypeTitle(contactType);
  const displayPhone = formatUsPhone(phone) || phone;
  const displayName = name || displayPhone || "Unsaved contact";
  const detailRows = compactRows([
    createDetailRow("Primary phone", displayPhone),
    createDetailRow("Saved record", "Not saved yet"),
  ]);
  const contact = {
    id: `draft:${contactType}:${normalizePhoneLookup(phone) || displayName}`,
    sourceId: null,
    contactType,
    typeLabel,
    name: displayName,
    primaryPhone: phone || "",
    secondaryPhone: "",
    email: "",
    label: typeLabel,
    locationLabel: "",
    status: "ready",
    statusLabel: "Ready",
    statusTone: "slate",
    detailRows,
    summaryLine: `${typeLabel} contact not in the saved directory yet`,
    raw: null,
  };

  return {
    ...contact,
    searchText: buildSearchText(contact),
  };
}

export function contactMatchesSearch(contact, searchValue) {
  const searchText = String(searchValue || "").trim().toLowerCase();

  if (!searchText) {
    return true;
  }

  const searchDigits = searchText.replace(/\D/g, "");
  const contactPhones = [contact.primaryPhone, contact.secondaryPhone].filter(Boolean);

  if (searchDigits) {
    return contactPhones.some((phone) => {
      const phoneDigits = normalizePhoneLookup(phone) || "";
      return phoneDigits.includes(searchDigits);
    });
  }

  return contact.searchText.includes(searchText);
}
