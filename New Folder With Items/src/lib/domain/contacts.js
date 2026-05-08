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
  const labels = {
    customer: "customer",
    technician: "technician",
    candidate: "candidate",
    review: "review contact",
    vendor: "vendor",
    archived: "archived",
  };

  return labels[contactType] || "customer";
}

export function getContactTypeTitle(contactType) {
  const titles = {
    customer: "Customer",
    technician: "Technician",
    candidate: "Candidate / New Hire",
    review: "Review Contact",
    vendor: "Vendor",
    archived: "Archived",
  };

  return titles[contactType] || "Customer";
}

export function getContactTypeTone(contactType) {
  const tones = {
    customer: "emerald",
    technician: "blue",
    candidate: "amber",
    review: "slate",
    vendor: "teal",
    archived: "slate",
  };

  return tones[contactType] || "emerald";
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

function formatDateTimeLabel(value) {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return null;
  }
}

function getCustomerActiveJob(customer) {
  return customer.activeJob || customer.jobs?.find((job) => !["completed", "canceled"].includes(job.lifecycleStatus)) || null;
}

function getCustomerPriority(customer) {
  return getCustomerActiveJob(customer) ? 100 : 70;
}

function getContactPriority(contact) {
  const priorities = {
    customer: contact.raw && getCustomerPriority(contact.raw) === 100 ? 100 : 70,
    technician: 90,
    candidate: 80,
    review: 10,
    vendor: 5,
    archived: 0,
  };

  return contact.priority ?? priorities[contact.contactType] ?? 0;
}

function createCardField(label, value) {
  return createDetailRow(label, value);
}

function getRepairStatusSummary(job) {
  if (!job) {
    return "No active repair found";
  }

  return joinDetails([
    formatStatusLabel(job.lifecycleStatus),
    job.dispatchStatus && !["assigned", "unassigned"].includes(job.dispatchStatus)
      ? formatStatusLabel(job.dispatchStatus)
      : null,
    job.partsStatus && job.partsStatus !== "none_needed"
      ? `Parts: ${formatStatusLabel(job.partsStatus)}`
      : null,
    job.paymentStatus && job.paymentStatus !== "none_due"
      ? `Payment: ${formatStatusLabel(job.paymentStatus)}`
      : null,
  ]);
}

function getVisitTimeSummary(job) {
  if (!job) {
    return null;
  }

  const onsiteLabel = formatDateTimeLabel(job.onsiteAt);
  const completedLabel = formatDateTimeLabel(job.completedAt);

  if (job.lifecycleStatus === "completed" && completedLabel) {
    return `Completed ${completedLabel}`;
  }

  if (onsiteLabel) {
    return `Went onsite ${onsiteLabel}`;
  }

  if (job.scheduledStartLabel) {
    return `Scheduled ${job.scheduledStartLabel}`;
  }

  if (job.etaLabel && job.etaLabel !== "Not set") {
    return `ETA ${job.etaLabel}`;
  }

  return null;
}

function buildCustomerSummaryRows(customer) {
  const activeJob = getCustomerActiveJob(customer);
  const latestCommunication = customer.communicationRecords?.[0] || null;

  return compactRows([
    createCardField("Person", customer.name),
    createCardField("Phone", formatUsPhone(customer.primaryPhone) || customer.primaryPhone),
    createCardField("Repair Status", getRepairStatusSummary(activeJob)),
    createCardField(
      "Service / Appliance",
      activeJob ? joinDetails([activeJob.applianceLabel, activeJob.issueSummary], " - ") : customer.customerSegment,
    ),
    createCardField("Visit Time", getVisitTimeSummary(activeJob)),
    createCardField("Address", activeJob?.serviceAddress || joinDetails([customer.city, customer.serviceArea])),
    createCardField("Technician", activeJob?.technician?.name || (activeJob ? "Unassigned" : null)),
    createCardField(
      "Latest Note",
      activeJob?.internalNotes ||
        latestCommunication?.callHighlights ||
        latestCommunication?.previewText ||
        customer.notes ||
        customer.latestCommunication,
    ),
  ]);
}

function buildTechnicianSummaryRows(technician) {
  return compactRows([
    createCardField("Person", technician.name),
    createCardField("Phone", formatUsPhone(technician.primaryPhone) || technician.primaryPhone),
    createCardField("Work Status", formatStatusLabel(technician.statusToday || "unassigned")),
    createCardField("Service Area", technician.serviceArea),
    createCardField("Skills", technician.skills?.slice(0, 4).join(", ")),
    createCardField("Availability", technician.availabilityLabel),
    createCardField("Jobs This Week", technician.jobsCompletedThisWeek),
    createCardField("Payout", formatOptionalCurrency(technician.payoutTotal)),
  ]);
}

function buildHiringCandidateSummaryRows(candidate, isHired) {
  return compactRows([
    createCardField("Person", candidate.name),
    createCardField("Phone", formatUsPhone(candidate.primaryPhone) || candidate.primaryPhone),
    createCardField("Hiring Status", isHired ? "Moved to technicians" : formatStatusLabel(candidate.stage || "contacted")),
    createCardField("Trade", candidate.trade || "Appliance repair"),
    createCardField("Experience", candidate.applianceExperienceSummary || candidate.experienceSummary),
    createCardField("Availability", candidate.availabilitySummary),
    createCardField("Tools / Vehicle", candidate.toolsVehicleSummary),
    createCardField("Next Step", candidate.nextStep),
  ]);
}

function buildReviewSummaryRows(entry, sourceLabel, suggestedType, displayPhone, summary, status) {
  return compactRows([
    createCardField("Person", entry.customer?.name || displayPhone || "Unknown contact"),
    createCardField("Phone", displayPhone),
    createCardField("Source", sourceLabel),
    createCardField("Suggested Type", suggestedType),
    createCardField("Status", formatStatusLabel(status)),
    createCardField("Occurred", entry.occurredAtLabel),
    createCardField("Summary", summary),
    createCardField("Follow-up", entry.callSummarySections?.followUpActions),
  ]);
}

function buildCustomerDetailRows(customer) {
  const activeJob = getCustomerActiveJob(customer);

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

function buildCustomerCardFields(customer) {
  const activeJob = getCustomerActiveJob(customer);
  const latestCommunication = customer.communicationRecords?.[0] || null;

  return compactRows([
    createCardField("Phone", formatUsPhone(customer.primaryPhone) || customer.primaryPhone),
    createCardField("Balance Due", formatOptionalCurrency(customer.openBalance)),
    createCardField(
      "Active Job Status",
      activeJob ? joinDetails([activeJob.applianceLabel, formatStatusLabel(activeJob.lifecycleStatus)]) : null,
    ),
    createCardField("Appliance", activeJob?.applianceLabel),
    createCardField("Service Address", activeJob?.serviceAddress),
    createCardField("ETA / Scheduled", activeJob?.etaLabel || activeJob?.scheduledStartLabel),
    createCardField("Last Note", activeJob?.internalNotes || customer.notes),
    createCardField(
      "Last Transcript Summary",
      latestCommunication?.callHighlights || customer.latestCommunication || latestCommunication?.previewText,
    ),
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

function buildTechnicianCardFields(technician) {
  return compactRows([
    createCardField("Phone", formatUsPhone(technician.primaryPhone) || technician.primaryPhone),
    createCardField("Type", "Technician"),
    createCardField("Coverage Area", technician.serviceArea),
    createCardField("Skills", technician.skills?.join(", ")),
    createCardField("Availability", technician.availabilityLabel),
    createCardField("Current Status", formatStatusLabel(technician.statusToday || "unassigned")),
    createCardField(
      "Payout Terms",
      typeof technician.payoutTotal === "number" ? `${formatCurrency(technician.payoutTotal)} current payout total` : null,
    ),
    createCardField(
      "Tools / Vehicle",
      technician.toolsVehicleSummary || technician.vehicleStatus || technician.toolsStatus,
    ),
    createCardField("Transcript Highlights", technician.callHighlights || technician.notes),
  ]);
}

function buildHiringCandidateDetailRows(candidate) {
  return compactRows([
    createDetailRow("Primary phone", formatUsPhone(candidate.primaryPhone) || candidate.primaryPhone),
    createDetailRow("Email", candidate.email),
    createDetailRow("Stage", formatStatusLabel(candidate.stage || "contacted")),
    createDetailRow("Source", candidate.source),
    createDetailRow("Trade", candidate.trade),
    createDetailRow("City", candidate.city),
    createDetailRow("Service area", candidate.serviceArea),
    createDetailRow("Availability", candidate.availabilitySummary),
    createDetailRow("Current work", candidate.currentJobStatus),
    createDetailRow("Experience", candidate.applianceExperienceSummary || candidate.experienceSummary),
    createDetailRow("Tools / vehicle", candidate.toolsVehicleSummary),
    createDetailRow("Payout expectation", candidate.payoutExpectationSummary),
    createDetailRow("Next step", candidate.nextStep),
    createDetailRow("Call highlights", candidate.callHighlights),
    createDetailRow("Transcript", candidate.transcriptText),
  ]);
}

function buildHiringCandidateCardFields(candidate, isHired) {
  return compactRows([
    createCardField("Phone", formatUsPhone(candidate.primaryPhone) || candidate.primaryPhone),
    createCardField("Type", isHired ? "Technician" : "Candidate"),
    createCardField("Coverage Area", joinDetails([candidate.city, candidate.serviceArea])),
    createCardField("Skills", candidate.applianceExperienceSummary || candidate.trade || candidate.experienceSummary),
    createCardField("Availability", candidate.availabilitySummary),
    createCardField("Hiring Stage", formatStatusLabel(candidate.stage || "contacted")),
    createCardField("Payout Terms", candidate.payoutExpectationSummary),
    createCardField("Tools / Vehicle", candidate.toolsVehicleSummary),
    createCardField("Transcript Highlights", candidate.callHighlights || candidate.englishKeyDetails),
  ]);
}

function getExternalCommunicationPhone(entry) {
  if (!entry) {
    return "";
  }

  return entry.direction === "outbound"
    ? entry.toNumber || entry.fromNumber || ""
    : entry.fromNumber || entry.toNumber || "";
}

function isContactIntelligenceEntry(entry) {
  return (
    ["call", "text"].includes(entry?.communicationChannel) &&
    Boolean(getExternalCommunicationPhone(entry)) &&
    (entry.transcriptionStatus === "completed" ||
      Boolean(entry.transcriptText || entry.callHighlights || entry.previewText))
  );
}

function inferReviewContactSuggestion(entry) {
  if (entry?.customerId || entry?.customer) {
    return "Customer";
  }

  const transcript = [entry?.transcriptText, entry?.callHighlights, entry?.previewText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hiringPatterns = [
    "hiring",
    "candidate",
    "indeed",
    "ziprecruiter",
    "resume",
    "applicant",
    "onboard",
    "payout",
    "tools",
    "vehicle",
    "appliance repair work",
  ];

  return hiringPatterns.some((pattern) => transcript.includes(pattern)) ? "Candidate" : "Customer";
}

function getContactPhoneKeys(contact) {
  return [contact.primaryPhone, contact.secondaryPhone].map(normalizePhoneLookup).filter(Boolean);
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
  const activeJob = getCustomerActiveJob(customer);
  const contact = {
    id: `customer:${customer.customerId}`,
    sourceId: customer.customerId,
    contactType: "customer",
    priority: getCustomerPriority(customer),
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
    cardFields: buildCustomerCardFields(customer),
    summaryRows: buildCustomerSummaryRows(customer),
    cardTitle: "Customer",
    summaryLine: joinDetails([
      customer.customerSegment || "Customer",
      customer.serviceArea,
      activeJob?.jobId || customer.activeJobId,
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
    priority: 90,
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
    cardFields: buildTechnicianCardFields(technician),
    summaryRows: buildTechnicianSummaryRows(technician),
    cardTitle: "Technician",
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

function buildHiringCandidateContact(candidate) {
  const detailRows = buildHiringCandidateDetailRows(candidate);
  const isHired = candidate.stage === "onboarded" || Boolean(candidate.promotedTechId);
  const contactType = isHired ? "technician" : "candidate";
  const contact = {
    id: `candidate:${candidate.candidateId}`,
    sourceId: candidate.candidateId,
    contactType,
    priority: isHired ? 90 : 80,
    typeLabel: isHired ? "Technician" : "Candidate / New Hire",
    name: candidate.name,
    primaryPhone: candidate.primaryPhone || "",
    secondaryPhone: "",
    email: candidate.email || "",
    label: candidate.trade || candidate.source || "Hiring lead",
    locationLabel: joinDetails([candidate.city, candidate.serviceArea]),
    status: candidate.stage || "contacted",
    statusLabel: formatStatusLabel(candidate.stage || "contacted"),
    statusTone: isHired ? "emerald" : "indigo",
    detailRows,
    cardFields: buildHiringCandidateCardFields(candidate, isHired),
    summaryRows: buildHiringCandidateSummaryRows(candidate, isHired),
    cardTitle: isHired ? "Technician" : "Candidate",
    summaryLine: joinDetails([
      candidate.trade || "Hiring lead",
      candidate.city,
      candidate.source,
      isHired ? "Moved to technicians" : null,
    ]),
    raw: candidate,
  };

  return {
    ...contact,
    searchText: buildSearchText(contact),
  };
}

function buildReviewContact(entry, sourceLabel) {
  const suggestedType = inferReviewContactSuggestion(entry);
  const primaryPhone = getExternalCommunicationPhone(entry);
  const displayPhone = formatUsPhone(primaryPhone) || primaryPhone;
  const name = entry.customer?.name || displayPhone || "Review contact";
  const status = entry.communicationStatus || entry.resolutionStatus || "clear";
  const summary = entry.callHighlights || entry.previewText || entry.transcriptText;
  const detailRows = compactRows([
    createDetailRow("Primary phone", displayPhone),
    createDetailRow("Contact source", sourceLabel),
    createDetailRow("Suggested type", suggestedType),
    createDetailRow("Status", formatStatusLabel(status)),
    createDetailRow("Occurred", entry.occurredAtLabel),
    createDetailRow("Summary", summary),
    createDetailRow("Transcript", entry.transcriptText),
    createDetailRow("Follow-up", entry.callSummarySections?.followUpActions),
  ]);
  const contact = {
    id: `call:${entry.communicationId || entry.unmatchedCommunicationId || entry.providerCallSid || primaryPhone}`,
    sourceId: entry.communicationId || entry.unmatchedCommunicationId || entry.providerCallSid || null,
    contactType: "review",
    priority: 10,
    typeLabel: "Review Contact",
    name,
    primaryPhone,
    secondaryPhone: "",
    email: "",
    label: sourceLabel,
    locationLabel: "",
    status,
    statusLabel: formatStatusLabel(status),
    statusTone: getStatusTone(status),
    detailRows,
    cardFields: compactRows([
      createCardField("Phone", displayPhone),
      createCardField("Suggested Type", suggestedType),
      createCardField("Source", sourceLabel),
      createCardField("Last Transcript Summary", summary),
    ]),
    summaryRows: buildReviewSummaryRows(entry, sourceLabel, suggestedType, displayPhone, summary, status),
    cardTitle: "Review Contact",
    suggestedType,
    summaryLine: joinDetails([sourceLabel, suggestedType ? `Suggested: ${suggestedType}` : null, summary]),
    raw: entry,
  };

  return {
    ...contact,
    searchText: buildSearchText(contact),
  };
}

export function buildContactDirectory(
  customers = [],
  technicians = [],
  hiringCandidates = [],
  communicationRecords = [],
  unmatchedInboundRecords = [],
) {
  const candidateContacts = hiringCandidates.map(buildHiringCandidateContact);
  const savedContacts = [
    ...customers.map(buildCustomerContact),
    ...technicians.map(buildTechnicianContact),
    ...candidateContacts,
  ];
  const reviewContacts = [
    ...communicationRecords
      .filter(isContactIntelligenceEntry)
      .map((entry) =>
        buildReviewContact(
          entry,
          entry.communicationChannel === "text" ? "Review text" : "Transcribed CRM call",
        ),
      ),
    ...unmatchedInboundRecords
      .filter(isContactIntelligenceEntry)
      .map((entry) =>
        buildReviewContact(
          entry,
          entry.communicationChannel === "text" ? "Unmatched review text" : "Unmatched transcribed call",
        ),
      ),
  ];
  const contactsWithoutPhone = [];
  const contactsByPhone = new Map();

  [...savedContacts, ...reviewContacts].forEach((contact) => {
    const phoneKeys = getContactPhoneKeys(contact);

    if (!phoneKeys.length) {
      contactsWithoutPhone.push(contact);
      return;
    }

    const existingContact = phoneKeys.map((phone) => contactsByPhone.get(phone)).find(Boolean);

    if (!existingContact || getContactPriority(contact) > getContactPriority(existingContact)) {
      phoneKeys.forEach((phone) => contactsByPhone.set(phone, contact));
    }
  });

  return [...new Set(contactsByPhone.values()), ...contactsWithoutPhone].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function buildManualContactSummary({ contactType = "customer", name = "", phone = "" }) {
  const normalizedContactType = ["customer", "technician", "candidate", "review"].includes(contactType)
    ? contactType
    : "customer";
  const typeLabel = getContactTypeTitle(normalizedContactType);
  const displayPhone = formatUsPhone(phone) || phone;
  const displayName = name || displayPhone || "Unsaved contact";
  const detailRows = compactRows([
    createDetailRow("Primary phone", displayPhone),
    createDetailRow(
      "Saved record",
      normalizedContactType === "review" ? "Needs review before conversion" : "Not saved yet",
    ),
  ]);
  const contact = {
    id: `draft:${normalizedContactType}:${normalizePhoneLookup(phone) || displayName}`,
    sourceId: null,
    contactType: normalizedContactType,
    priority: normalizedContactType === "review" ? 10 : 0,
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
    cardFields: compactRows([
      createCardField("Phone", displayPhone),
      createCardField(
        normalizedContactType === "candidate" ? "Hiring Stage" : normalizedContactType === "review" ? "Suggested Type" : "Type",
        typeLabel,
      ),
      createCardField("Saved Record", normalizedContactType === "review" ? "Review before converting" : "Not saved yet"),
    ]),
    summaryRows: compactRows([
      createCardField("Person", displayName),
      createCardField("Phone", displayPhone),
      createCardField("Type", typeLabel),
      createCardField("Saved Record", normalizedContactType === "review" ? "Review before converting" : "Not saved yet"),
      createCardField("Next Step", "Confirm the details while you talk or text."),
    ]),
    cardTitle: typeLabel,
    suggestedType: normalizedContactType === "review" ? "Customer" : null,
    summaryLine:
      normalizedContactType === "review"
        ? "Unknown contact waiting for review"
        : `${typeLabel} contact not in the saved directory yet`,
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
