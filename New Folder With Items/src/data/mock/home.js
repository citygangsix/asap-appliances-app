export const homeKpis = [
  { label: "Jobs today", value: "6", detail: "0 active, 6 completed, 0 at risk" },
  { label: "Callbacks needed", value: "0", detail: "Completed customers moved to history" },
  { label: "Technicians en route", value: "1", detail: "No mapped customer stops" },
  { label: "Parts awaiting payment", value: "0", detail: "No active parts deposits due" },
  { label: "Labor due today", value: "$0", detail: "Closed demo invoices are paid" },
  { label: "Unresolved communications", value: "0", detail: "No open customer action threads" },
];

export const activityFeed = [
  "10:45 AM · Renee Walker repair completed and invoice closed.",
  "11:10 AM · Julian Brooks diagnostic paid; repair declined.",
  "12:05 PM · Bianca Flores diagnostic paid; quoted oven repair declined.",
  "02:30 PM · Sanjay Patel return visit completed.",
  "04:20 PM · Nadia Hart parts installation completed and invoice paid.",
];

export const callMetrics = [
  { label: "Assistant calls", value: 28, detail: "6 active right now" },
  { label: "Technician calls", value: 17, detail: "4 inbound from field" },
  { label: "Missed calls", value: 3, detail: "2 need callback" },
  { label: "Callbacks completed", value: 11, detail: "79% completion" },
];

export const urgentQueues = [
  { label: "Jobs needing assignment", count: 0, jobIds: [] },
  { label: "Jobs awaiting parts payment", count: 0, jobIds: [] },
  { label: "Return visits to schedule", count: 0, jobIds: [] },
  { label: "Labor due now", count: 0, jobIds: [] },
  { label: "Failed payments", count: 0, jobIds: [] },
];
