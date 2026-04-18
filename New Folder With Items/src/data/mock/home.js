export const homeKpis = [
  { label: "Jobs today", value: "26", detail: "18 active, 5 completed, 3 at risk" },
  { label: "Callbacks needed", value: "7", detail: "4 from customers, 3 from technicians" },
  { label: "Technicians en route", value: "3", detail: "1 late, 1 needs escalation check" },
  { label: "Parts awaiting payment", value: "3", detail: "2 high-priority refrigerators" },
  { label: "Labor due today", value: "$1,240", detail: "2 onsite and 4 pending completion" },
  { label: "Unresolved communications", value: "5", detail: "3 text threads and 2 calls" },
];

export const activityFeed = [
  "09:08 AM · Parts quote sent to Renee Walker for Samsung refrigerator repair.",
  "09:41 AM · Andre Lewis marked onsite at Julian Brooks washer job.",
  "10:06 AM · Kelly Warren labor authorization card failed on retry.",
  "10:22 AM · Dispatch escalated Nadia Hart due to tight service window.",
  "10:37 AM · Bianca Flores requested callback before assigning technician.",
];

export const callMetrics = [
  { label: "Assistant calls", value: 28, detail: "6 active right now" },
  { label: "Technician calls", value: 17, detail: "4 inbound from field" },
  { label: "Missed calls", value: 3, detail: "2 need callback" },
  { label: "Callbacks completed", value: 11, detail: "79% completion" },
];

export const urgentQueues = [
  { label: "Jobs needing assignment", count: 4, jobIds: ["ASAP-1051", "ASAP-1063"] },
  { label: "Jobs awaiting parts payment", count: 3, jobIds: ["ASAP-1042", "ASAP-1059"] },
  { label: "Return visits to schedule", count: 5, jobIds: ["ASAP-1055", "ASAP-1040"] },
  { label: "Labor due now", count: 2, jobIds: ["ASAP-1048", "ASAP-1037"] },
  { label: "Failed payments", count: 1, jobIds: ["ASAP-1059"] },
];
