/** @typedef {import("../../types/models").RevenueSummary} RevenueSummary */
/** @typedef {import("../../types/models").RevenueTrendPoint} RevenueTrendPoint */
/** @typedef {import("../../types/models").TechnicianPayout} TechnicianPayout */

/** @type {RevenueSummary[]} */
export const revenueHighlights = [
  { summaryId: "booked_today", label: "Booked today", amount: 3860, detail: "Across 11 invoices and deposits" },
  { summaryId: "collected_today", label: "Collected today", amount: 1910, detail: "Card and ACH combined" },
  { summaryId: "outstanding_balance", label: "Outstanding balance", amount: 1445, detail: "Includes 1 failed charge" },
  { summaryId: "technician_payouts", label: "Technician payouts", amount: 1168, detail: "Pending release at day end" },
];

/** @type {RevenueTrendPoint[]} */
export const revenueTrend = [
  { periodLabel: "Mon", invoicedAmount: 2600, collectedAmount: 2100 },
  { periodLabel: "Tue", invoicedAmount: 3150, collectedAmount: 2480 },
  { periodLabel: "Wed", invoicedAmount: 2890, collectedAmount: 2230 },
  { periodLabel: "Thu", invoicedAmount: 3420, collectedAmount: 2710 },
  { periodLabel: "Fri", invoicedAmount: 3860, collectedAmount: 1910 },
];

/** @type {TechnicianPayout[]} */
export const payoutBatches = [
  {
    payoutId: "payout-1",
    techId: "tech-1",
    amount: 420,
    status: "ready",
    note: "Ready",
    invoiceIds: ["INV-2042", "INV-2063"],
  },
  {
    payoutId: "payout-2",
    techId: "tech-2",
    amount: 285,
    status: "pending",
    note: "Pending labor capture",
    invoiceIds: ["INV-2048"],
  },
  {
    payoutId: "payout-3",
    techId: "tech-4",
    amount: 260,
    status: "partial",
    note: "Partial collection",
    invoiceIds: ["INV-2055"],
  },
  {
    payoutId: "payout-4",
    techId: "tech-3",
    amount: 203,
    status: "retry",
    note: "Payment retry",
    invoiceIds: ["INV-2059"],
  },
];
