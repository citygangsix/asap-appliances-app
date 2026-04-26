import { buildCommunicationRecords } from "../../../lib/domain/communications";
import { buildCustomerRecords } from "../../../lib/domain/customers";
import { buildInvoiceRecords, buildPayoutRecords } from "../../../lib/domain/finance";
import { buildJobRecords } from "../../../lib/domain/jobs";
import {
  mapCommunicationRowToDomain,
  mapCustomerRowToDomain,
  mapInvoiceRowToDomain,
  mapJobRowToDomain,
  mapJobTimelineEventRowToDomain,
  mapTechnicianPayoutRowToDomain,
  mapTechnicianRowToDomain,
} from "../mappers";

/**
 * @param {ReturnType<import("./mockDatabaseSnapshot").getMockDatabaseSnapshot>} snapshot
 */
export function buildOperationsReadModels(snapshot) {
  const primaryInvoiceIdsByJob = new Map();
  const customerIdsByJob = new Map();
  const invoiceIdsByPayout = new Map();

  snapshot.jobRows.forEach((job) => {
    customerIdsByJob.set(job.job_id, job.customer_id);
  });

  snapshot.invoiceRows.forEach((invoice) => {
    if (!primaryInvoiceIdsByJob.has(invoice.job_id)) {
      primaryInvoiceIdsByJob.set(invoice.job_id, invoice.invoice_id);
    }
  });

  snapshot.technicianPayoutInvoiceLinkRows.forEach((link) => {
    if (!invoiceIdsByPayout.has(link.payout_id)) {
      invoiceIdsByPayout.set(link.payout_id, []);
    }

    invoiceIdsByPayout.get(link.payout_id).push(link.invoice_id);
  });

  const customers = snapshot.customerRows.map((row) => {
    const activeJobId =
      snapshot.jobRows.find(
        (job) =>
          job.customer_id === row.customer_id &&
          !["completed", "canceled"].includes(job.lifecycle_status),
      )?.job_id || null;

    return mapCustomerRowToDomain(row, { activeJobId });
  });

  const technicians = snapshot.technicianRows.map(mapTechnicianRowToDomain);
  const jobTimelineEvents = snapshot.jobTimelineEventRows.map(mapJobTimelineEventRowToDomain);
  const communications = snapshot.communicationRows.map(mapCommunicationRowToDomain);
  const invoices = snapshot.invoiceRows.map((row) =>
    mapInvoiceRowToDomain(row, {
      customerId: customerIdsByJob.get(row.job_id) || "",
    }),
  );
  const jobs = snapshot.jobRows.map((row) =>
    mapJobRowToDomain(row, {
      primaryInvoiceId: primaryInvoiceIdsByJob.get(row.job_id) || null,
    }),
  );
  const technicianPayouts = snapshot.technicianPayoutRows.map((row) =>
    mapTechnicianPayoutRowToDomain(row, {
      invoiceIds: invoiceIdsByPayout.get(row.payout_id) || [],
    }),
  );

  const jobRecords = buildJobRecords(jobs, customers, technicians, invoices, communications, jobTimelineEvents);
  const customerRecords = buildCustomerRecords(customers, jobRecords, communications, invoices);
  const communicationRecords = buildCommunicationRecords(communications, customers, jobRecords, invoices);
  const invoiceRecords = buildInvoiceRecords(invoices, customers, technicians);
  const payoutRecords = buildPayoutRecords(technicianPayouts, technicians);

  return {
    customers,
    technicians,
    jobs,
    invoices,
    communications,
    jobTimelineEvents,
    technicianPayouts,
    jobRecords,
    customerRecords,
    communicationRecords,
    invoiceRecords,
    payoutRecords,
  };
}
