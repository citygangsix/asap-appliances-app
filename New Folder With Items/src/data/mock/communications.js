/** @typedef {import("../../types/models").Communication} Communication */

/** @type {Communication[]} */
export const communications = [
  {
    communicationId: "comm-1",
    customerId: "cust-1",
    linkedJobId: "ASAP-1042",
    invoiceId: "INV-2042",
    communicationChannel: "text",
    communicationStatus: "clear",
    previewText: "Can someone explain if the part is covered under warranty?",
    transcriptText:
      "Customer asked if the evap fan is under warranty. Assistant promised callback after checking model serial coverage.",
    callHighlights: "",
    callSummarySections: null,
    extractedEventLabel: "Repair completed and invoice closed",
  },
  {
    communicationId: "comm-2",
    customerId: "cust-4",
    linkedJobId: "ASAP-1055",
    invoiceId: "INV-2055",
    communicationChannel: "call",
    communicationStatus: "clear",
    previewText: "Customer upset that ETA slipped beyond promised window.",
    transcriptText:
      "Caller wants firm return time because water leak is recurring. Asked if seal shipment arrived.",
    callHighlights:
      "Return visit was completed and the customer account was closed.",
    callSummarySections: {
      customerNeed: "Return repair completed.",
      applianceOrSystem: "Dishwasher leak repair closed.",
      schedulingAndLocation: "No future visit needed.",
      partsAndWarranty: "Seal installed.",
      billingAndPayment: "Invoice paid.",
      followUpActions: "Keep in past customer history.",
    },
    transcriptionStatus: "completed",
    transcriptionError: null,
    extractedEventLabel: "Return completed and invoice closed",
  },
  {
    communicationId: "comm-3",
    customerId: "cust-5",
    linkedJobId: "ASAP-1059",
    invoiceId: "INV-2059",
    communicationChannel: "text",
    communicationStatus: "clear",
    previewText: "Payment link keeps failing when I submit card.",
    transcriptText:
      "Customer paid the diagnostic and declined the repair estimate.",
    callHighlights: "",
    callSummarySections: null,
    extractedEventLabel: "Diagnostic paid and repair declined",
  },
  {
    communicationId: "comm-4",
    customerId: "cust-3",
    linkedJobId: "ASAP-1051",
    invoiceId: "INV-2051",
    communicationChannel: "call",
    communicationStatus: "clear",
    previewText: "Diagnostic paid; customer declined oven repair.",
    transcriptText:
      "Diagnostic was completed and paid. Customer declined the quoted oven repair.",
    callHighlights:
      "Diagnostic was paid. Customer did not move forward with the quoted oven repair.",
    callSummarySections: {
      customerNeed: "No further repair requested.",
      applianceOrSystem: "GE oven diagnosis completed.",
      schedulingAndLocation: "No future visit needed.",
      partsAndWarranty: "Repair quote declined.",
      billingAndPayment: "Diagnostic invoice paid.",
      followUpActions: "Move customer to past customer history.",
    },
    transcriptionStatus: "completed",
    transcriptionError: null,
    extractedEventLabel: "Diagnostic-only job closed",
  },
];
