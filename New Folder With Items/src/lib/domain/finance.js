import { indexBy } from "./relations";

/** @typedef {import("../../types/models").Customer} Customer */
/** @typedef {import("../../types/models").Invoice} Invoice */
/** @typedef {import("../../types/models").InvoiceRecord} InvoiceRecord */
/** @typedef {import("../../types/models").RevenueTrendPoint} RevenueTrendPoint */
/** @typedef {import("../../types/models").Technician} Technician */
/** @typedef {import("../../types/models").TechnicianPayout} TechnicianPayout */
/** @typedef {import("../../types/models").TechnicianPayoutRecord} TechnicianPayoutRecord */

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(amount) {
  return `${amount.toFixed(1)}%`;
}

/**
 * @param {InvoiceRecord[]|Invoice[]} invoices
 */
export function getInvoiceSummary(invoices) {
  const totals = invoices.reduce(
    (accumulator, invoice) => {
      accumulator.issued += invoice.totalAmount;
      accumulator.collected += invoice.collectedAmount;
      accumulator.balance += invoice.outstandingBalance;
      accumulator.failed += invoice.paymentStatus === "failed" ? invoice.outstandingBalance : 0;
      return accumulator;
    },
    { issued: 0, collected: 0, balance: 0, failed: 0 },
  );

  return [
    { label: "Issued today", value: formatCurrency(totals.issued), detail: "All active invoices and deposits" },
    { label: "Collected", value: formatCurrency(totals.collected), detail: "Captured this cycle" },
    { label: "Open balance", value: formatCurrency(totals.balance), detail: "Still awaiting collection" },
    { label: "Failed charges", value: formatCurrency(totals.failed), detail: "Needs retry or manual invoice" },
  ];
}

/**
 * @param {Invoice[]} invoices
 * @param {Customer[]} customers
 * @param {Technician[]} technicians
 * @returns {InvoiceRecord[]}
 */
export function buildInvoiceRecords(invoices, customers, technicians) {
  const customersById = indexBy(customers, "customerId");
  const techniciansById = indexBy(technicians, "techId");

  return invoices.map((invoice) => ({
    ...invoice,
    customer: customersById.get(invoice.customerId) || null,
    technician: invoice.techId ? techniciansById.get(invoice.techId) || null : null,
  }));
}

/**
 * @param {TechnicianPayout[]} payouts
 * @param {Technician[]} technicians
 * @returns {TechnicianPayoutRecord[]}
 */
export function buildPayoutRecords(payouts, technicians) {
  const techniciansById = indexBy(technicians, "techId");

  return payouts.map((payout) => ({
    ...payout,
    technician: techniciansById.get(payout.techId) || null,
  }));
}

/**
 * @param {RevenueTrendPoint[]} revenueTrend
 */
export function getRevenueBars(revenueTrend) {
  const max = Math.max(...revenueTrend.map((entry) => Math.max(entry.invoicedAmount, entry.collectedAmount)));

  return revenueTrend.map((entry) => ({
    ...entry,
    invoicedHeight: `${Math.max(18, (entry.invoicedAmount / max) * 100)}%`,
    collectedHeight: `${Math.max(18, (entry.collectedAmount / max) * 100)}%`,
  }));
}
