/** @typedef {import("../../types/models").Communication} Communication */

/** @type {Communication[]} */
export const communications = [
  {
    communicationId: "comm-1",
    customerId: "cust-1",
    linkedJobId: "ASAP-1042",
    invoiceId: "INV-2042",
    communicationChannel: "text",
    communicationStatus: "unresolved",
    previewText: "Can someone explain if the part is covered under warranty?",
    transcriptText:
      "Customer asked if the evap fan is under warranty. Assistant promised callback after checking model serial coverage.",
    callHighlights: "",
    callSummarySections: null,
    extractedEventLabel: "Customer approved part pending warranty clarification",
  },
  {
    communicationId: "comm-2",
    customerId: "cust-4",
    linkedJobId: "ASAP-1055",
    invoiceId: "INV-2055",
    communicationChannel: "call",
    communicationStatus: "awaiting_callback",
    previewText: "Customer upset that ETA slipped beyond promised window.",
    transcriptText:
      "Caller wants firm return time because water leak is recurring. Asked if seal shipment arrived.",
    callHighlights:
      "Water leak is still recurring. Customer wants a firm ETA and asked whether the replacement seal shipment has arrived.",
    callSummarySections: {
      customerNeed: "Customer wants the leak resolved and needs a firm arrival commitment.",
      applianceOrSystem: "Recurring water leak; seal shipment status was discussed.",
      schedulingAndLocation: "Customer is waiting onsite for an updated technician window.",
      partsAndWarranty: "Seal shipment arrival was specifically asked about.",
      billingAndPayment: "",
      followUpActions: "Confirm the seal status and call back with a reliable ETA.",
    },
    transcriptionStatus: "completed",
    transcriptionError: null,
    extractedEventLabel: "ETA changed and customer requested escalation",
  },
  {
    communicationId: "comm-3",
    customerId: "cust-5",
    linkedJobId: "ASAP-1059",
    invoiceId: "INV-2059",
    communicationChannel: "text",
    communicationStatus: "unresolved",
    previewText: "Payment link keeps failing when I submit card.",
    transcriptText:
      "Customer attempted parts payment twice and both attempts failed. Requested alternate invoice route.",
    callHighlights: "",
    callSummarySections: null,
    extractedEventLabel: "Parts payment failed and manual invoice may be needed",
  },
  {
    communicationId: "comm-4",
    customerId: "cust-3",
    linkedJobId: "ASAP-1051",
    invoiceId: null,
    communicationChannel: "call",
    communicationStatus: "clear",
    previewText: "Asked for later technician arrival after 1 PM.",
    transcriptText:
      "Customer can only be home after lunch. No technical change, but schedule preference updated.",
    callHighlights:
      "Customer can only be available after 1 PM. No repair details changed, but the service window needs to move later.",
    callSummarySections: {
      customerNeed: "Needs the appointment shifted to the afternoon.",
      applianceOrSystem: "No new appliance diagnosis was discussed.",
      schedulingAndLocation: "Customer requested arrival after 1 PM.",
      partsAndWarranty: "",
      billingAndPayment: "",
      followUpActions: "Update dispatch timing and confirm the revised window with the customer.",
    },
    transcriptionStatus: "completed",
    transcriptionError: null,
    extractedEventLabel: "Availability window changed to afternoon",
  },
];
