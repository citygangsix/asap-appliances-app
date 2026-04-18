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
    extractedEventLabel: "Availability window changed to afternoon",
  },
];
