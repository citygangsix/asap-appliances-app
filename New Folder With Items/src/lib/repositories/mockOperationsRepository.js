import {
  mapCommunicationAttachmentToUpdate,
  mapCommunicationDraftToInsert,
  mapCommunicationStatusPatchToUpdate,
  mapCustomerDraftToInsert,
  mapCustomerPatchToUpdate,
  mapInvoiceDraftToInsert,
  mapInvoicePaymentPatchToUpdate,
  mapJobAssignmentToUpdate,
  mapJobDraftToInsert,
  mapJobTimelineEventDraftToInsert,
  mapJobWorkflowPatchToUpdate,
  mapPayoutInvoiceLinksToInsert,
  mapTechnicianPayoutDraftToInsert,
  mapUnmatchedInboundCommunicationPatchToUpdate,
} from "../../integrations/supabase/mappers";
import { getMockDatabaseSnapshot } from "../../integrations/supabase/adapters/mockDatabaseSnapshot";
import { buildOperationsReadModels } from "../../integrations/supabase/adapters/readModels";
import { createMutationResultPlaceholder } from "../../integrations/supabase/placeholders";
import { filterCommunicationRecords } from "../domain/communications";
import {
  buildDispatchTechnicianAvailabilitySummary,
  getDispatchAttentionJobs,
  getDispatchBoardJobs,
  getUnassignedDispatchJobs,
} from "../domain/jobs";
import { extractZipCode, findBestTechnicianForZip } from "../domain/technicianCoverage";
import {
  buildCommunicationsPageData,
  buildCustomersPageData,
  buildDispatchPageData,
  buildHomePageData,
  buildInvoicesPageData,
  buildJobsPageData,
  buildRevenuePageData,
  buildSettingsPageData,
  buildTechniciansPageData,
} from "./pageData";

function getReadModels() {
  return buildOperationsReadModels(getMockDatabaseSnapshot());
}

function createMockMutation(operation, payload, message, record = null) {
  return createMutationResultPlaceholder({
    operation,
    source: "mock",
    payload,
    record,
    message,
  });
}

const customers = {
  list() {
    return getReadModels().customerRecords;
  },
  getProfile(customerId) {
    return customers.list().find((customer) => customer.customerId === customerId) || null;
  },
  create(draft) {
    return createMockMutation(
      "customers.create",
      mapCustomerDraftToInsert(draft),
      "Mock source remains active. Customer create scaffolding is wired, but no persistence occurs yet.",
    );
  },
  update(customerId, patch) {
    return createMockMutation(
      "customers.update",
      {
        customerId,
        ...mapCustomerPatchToUpdate(patch),
      },
      "Mock source remains active. Customer update scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

const technicians = {
  list() {
    return getReadModels().technicians;
  },
};

const jobs = {
  list() {
    return getReadModels().jobRecords;
  },
  getDetail(jobId) {
    return jobs.list().find((job) => job.jobId === jobId) || null;
  },
  create(draft) {
    const matchedTechnician =
      draft.techId || !extractZipCode(draft.serviceAddress)
        ? null
        : findBestTechnicianForZip(extractZipCode(draft.serviceAddress), technicians.list());
    const nextDraft =
      draft.techId || !matchedTechnician?.techId
        ? draft
        : {
            ...draft,
            techId: matchedTechnician.techId,
          };

    return createMockMutation(
      "jobs.create",
      mapJobDraftToInsert(nextDraft),
      "Mock source remains active. Job create scaffolding is wired, but no persistence occurs yet.",
    );
  },
  assignTechnician(jobId, draft) {
    return createMockMutation(
      "jobs.assignTechnician",
      { jobId, ...mapJobAssignmentToUpdate(draft) },
      "Mock source remains active. Technician assignment scaffolding is wired, but no persistence occurs yet.",
    );
  },
  updateWorkflow(jobId, patch) {
    return createMockMutation(
      "jobs.updateWorkflow",
      { jobId, ...mapJobWorkflowPatchToUpdate(patch) },
      "Mock source remains active. Job workflow update scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

const dispatch = {
  listBoardJobs() {
    return getDispatchBoardJobs(jobs.list());
  },
  listUnassignedJobs() {
    return getUnassignedDispatchJobs(dispatch.listBoardJobs());
  },
  listAttentionJobs() {
    return getDispatchAttentionJobs(dispatch.listBoardJobs());
  },
  getTechnicianAvailabilitySummary() {
    return buildDispatchTechnicianAvailabilitySummary(technicians.list());
  },
  assignTechnician(jobId, draft) {
    return createMockMutation(
      "dispatch.assignTechnician",
      { jobId, ...mapJobAssignmentToUpdate(draft) },
      "Mock source remains active. Dispatch assignment scaffolding is wired, but no persistence occurs yet.",
    );
  },
  updateStatus(jobId, patch) {
    return createMockMutation(
      "dispatch.updateStatus",
      { jobId, ...mapJobWorkflowPatchToUpdate(patch) },
      "Mock source remains active. Dispatch status scaffolding is wired, but no persistence occurs yet.",
    );
  },
  updateEta(jobId, patch) {
    return createMockMutation(
      "dispatch.updateEta",
      { jobId, ...mapJobWorkflowPatchToUpdate(patch) },
      "Mock source remains active. ETA update scaffolding is wired, but no persistence occurs yet.",
    );
  },
  escalateJob(jobId, draft = {}) {
    return createMockMutation(
      "dispatch.escalateJob",
      {
        jobId,
        update: mapJobWorkflowPatchToUpdate({
          dispatchStatus: "escalated",
          priority: draft.priority || "escalated",
          customerUpdated: draft.customerUpdated,
        }),
        timelineEvent: mapJobTimelineEventDraftToInsert({
          jobId,
          actorType: "dispatch",
          actorLabel: "Dispatch",
          eventType: "dispatch_updated",
          eventAt: draft.eventAt || new Date().toISOString(),
          summary: draft.summary || "Job escalated for dispatch review.",
          details: draft.details ?? null,
        }),
      },
      "Mock source remains active. Dispatch escalation scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

const communications = {
  listFeed(filters = {}) {
    return filterCommunicationRecords(getReadModels().communicationRecords, filters);
  },
  getDetail(communicationId) {
    return communications.listFeed().find((entry) => entry.communicationId === communicationId) || null;
  },
  listUnmatchedInbound() {
    return [];
  },
  createLog(draft) {
    return createMockMutation(
      "communications.createLog",
      mapCommunicationDraftToInsert(draft),
      "Mock source remains active. Communication log scaffolding is wired, but no persistence occurs yet.",
    );
  },
  markReviewed(communicationId, draft = {}) {
    const currentRecord = communications.getDetail(communicationId);
    const linkedJobId = currentRecord?.linkedJobId || null;

    return createMockMutation(
      "communications.markReviewed",
      {
        communicationId,
        update: mapCommunicationStatusPatchToUpdate({
          communicationStatus: draft.communicationStatus || "clear",
        }),
        timelineEvent:
          linkedJobId && draft.timelineSummary
            ? mapJobTimelineEventDraftToInsert({
                jobId: linkedJobId,
                actorType: "dispatch",
                actorLabel: "Communications",
                eventType: "communication_logged",
                eventAt: draft.eventAt || new Date().toISOString(),
                summary: draft.timelineSummary,
                details: draft.timelineDetails ?? null,
              })
            : null,
      },
      "Mock source remains active. Communication review scaffolding is wired, but no persistence occurs yet.",
    );
  },
  updateStatus(communicationId, patch) {
    return createMockMutation(
      "communications.updateStatus",
      {
        communicationId,
        ...mapCommunicationStatusPatchToUpdate(patch),
      },
      "Mock source remains active. Communication status scaffolding is wired, but no persistence occurs yet.",
    );
  },
  attachToJob(communicationId, draft) {
    return createMockMutation(
      "communications.attachToJob",
      {
        communicationId,
        update: mapCommunicationAttachmentToUpdate(draft),
        timelineEvent: draft.timelineSummary
          ? mapJobTimelineEventDraftToInsert({
              jobId: draft.jobId,
              actorType: "dispatch",
              actorLabel: "Communications",
              eventType: "communication_logged",
              eventAt: draft.eventAt || new Date().toISOString(),
              summary: draft.timelineSummary,
              details: draft.timelineDetails ?? null,
            })
          : null,
      },
      "Mock source remains active. Communication attach-to-job scaffolding is wired, but no persistence occurs yet.",
    );
  },
  resolveUnmatchedInbound(unmatchedCommunicationId, draft) {
    return createMockMutation(
      "communications.resolveUnmatchedInbound",
      {
        unmatchedCommunicationId,
        ...mapUnmatchedInboundCommunicationPatchToUpdate({
          resolutionStatus: "linked",
          linkedCustomerId: draft.customerId,
          linkedJobId: draft.jobId ?? null,
          resolutionNotes: draft.notes ?? null,
          resolvedAt: new Date().toISOString(),
        }),
      },
      "Mock source remains active. Unmatched inbound triage scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

const invoices = {
  list() {
    return getReadModels().invoiceRecords;
  },
  getDetail(invoiceId) {
    return invoices.list().find((invoice) => invoice.invoiceId === invoiceId) || null;
  },
  createForJob(draft) {
    return createMockMutation(
      "invoices.createForJob",
      mapInvoiceDraftToInsert(draft),
      "Mock source remains active. Invoice creation scaffolding is wired, but no persistence occurs yet.",
    );
  },
  updatePaymentStatus(invoiceId, patch) {
    return createMockMutation(
      "invoices.updatePaymentStatus",
      { invoiceId, ...mapInvoicePaymentPatchToUpdate(patch) },
      "Mock source remains active. Invoice payment update scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

const jobTimeline = {
  listByJob(jobId) {
    const items = getReadModels().jobTimelineEvents;
    return jobId ? items.filter((event) => event.jobId === jobId) : items;
  },
  append(draft) {
    return createMockMutation(
      "jobTimeline.append",
      mapJobTimelineEventDraftToInsert(draft),
      "Mock source remains active. Timeline append scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

const technicianPayouts = {
  list() {
    return getReadModels().payoutRecords;
  },
  create(draft) {
    return createMockMutation(
      "technicianPayouts.create",
      mapTechnicianPayoutDraftToInsert(draft),
      "Mock source remains active. Technician payout scaffolding is wired, but no persistence occurs yet.",
    );
  },
  linkInvoices(draft) {
    return createMockMutation(
      "technicianPayouts.linkInvoices",
      mapPayoutInvoiceLinksToInsert(draft),
      "Mock source remains active. Payout invoice linking scaffolding is wired, but no persistence occurs yet.",
    );
  },
};

export const mockOperationsRepository = {
  source: "mock",
  clearRuntimeCaches() {},
  customers,
  dispatch,
  technicians,
  jobs,
  communications,
  invoices,
  jobTimeline,
  technicianPayouts,
  getHomePageData() {
    return buildHomePageData(getReadModels());
  },
  getJobsPageData() {
    return buildJobsPageData({
      jobRecords: jobs.list(),
    });
  },
  getCustomersPageData() {
    return buildCustomersPageData(getReadModels());
  },
  getDispatchPageData() {
    return buildDispatchPageData({
      jobRecords: dispatch.listBoardJobs(),
      technicians: technicians.list(),
    });
  },
  getCommunicationsPageData() {
    return buildCommunicationsPageData({
      communicationRecords: communications.listFeed(),
      unmatchedInboundRecords: communications.listUnmatchedInbound(),
    });
  },
  getInvoicesPageData() {
    return buildInvoicesPageData({
      invoiceRecords: invoices.list(),
    });
  },
  getRevenuePageData() {
    return buildRevenuePageData(getReadModels());
  },
  getTechniciansPageData() {
    return buildTechniciansPageData(getReadModels());
  },
  getSettingsPageData() {
    return buildSettingsPageData();
  },
};
