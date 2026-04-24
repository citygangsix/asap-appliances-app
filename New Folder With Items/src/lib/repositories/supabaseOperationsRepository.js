import {
  getSupabaseClient,
  getSupabaseClientStatus,
  isSupabaseConfigured,
} from "../../integrations/supabase/client";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../config/localOperationsServer";
import {
  clearSupabaseReadModelsCache,
} from "../../integrations/supabase/readModels";
import {
  mapHydratedCommunicationRowToRecord,
  mapHydratedCommunicationRowsToRecords,
} from "../../integrations/supabase/adapters/communications";
import {
  mapHydratedCustomerRowToRecord,
  mapHydratedCustomerRowsToRecords,
} from "../../integrations/supabase/adapters/customers";
import {
  mapHydratedInvoiceRowToRecord,
  mapHydratedInvoiceRowsToRecords,
} from "../../integrations/supabase/adapters/invoices";
import {
  mapHydratedJobRowToRecord,
  mapHydratedJobRowsToRecords,
} from "../../integrations/supabase/adapters/jobs";
import { mapHydratedTechnicianPayoutRowsToRecords } from "../../integrations/supabase/adapters/technicianPayouts";
import { getHomeDashboardQueryPlan } from "../../integrations/supabase/queries/home";
import {
  getDispatchAttentionJobsQueryPlan,
  getDispatchQueueQueryPlan,
  getDispatchTechnicianAvailabilityQueryPlan,
  getDispatchUnassignedJobsQueryPlan,
  runListDispatchAttentionJobsQuery,
  runListDispatchBoardJobsQuery,
  runListDispatchUnassignedJobsQuery,
} from "../../integrations/supabase/queries/dispatch";
import {
  getCommunicationDetailQueryPlan,
  getCommunicationsByJobQuery,
  getCommunicationsFeedQueryPlan,
  listCommunicationsQuery,
  runCommunicationDetailQuery,
  runCommunicationsByJobQuery,
  runListCommunicationsFeedQuery,
} from "../../integrations/supabase/queries/communications";
import {
  getUnmatchedInboundQueueQueryPlan,
  runGetUnmatchedInboundQuery,
  runListPendingUnmatchedInboundQuery,
} from "../../integrations/supabase/queries/unmatchedInbound";
import {
  getCustomerByIdQuery,
  getCustomerDirectoryQueryPlan,
  getCustomerProfileHydrationQueryPlan,
  listCustomersQuery,
  runCustomerProfileQuery,
  runListCustomerDirectoryQuery,
} from "../../integrations/supabase/queries/customers";
import {
  getInvoiceDetailQueryPlan,
  getInvoicesCollectionsQueryPlan,
  listInvoicesQuery,
  runInvoiceDetailQuery,
  runListInvoicesCollectionsQuery,
} from "../../integrations/supabase/queries/invoices";
import {
  listHiringCandidatesQuery,
  runListHiringCandidatesQuery,
} from "../../integrations/supabase/queries/hiringCandidates";
import {
  listJobTimelineEventsQuery,
  runListJobTimelineEventsQuery,
} from "../../integrations/supabase/queries/jobTimelineEvents";
import {
  getJobDetailHydrationQueryPlan,
  getJobInvoicesQuery,
  getJobsQueueQueryPlan,
  getJobTimelineQuery,
  listJobsQuery,
  runJobDetailQuery,
  runJobInvoicesQuery,
  runJobTimelineQuery,
  runListJobsQuery,
} from "../../integrations/supabase/queries/jobs";
import { getRevenuePageQueryPlan } from "../../integrations/supabase/queries/revenue";
import {
  getTechnicianPayoutsHydrationQueryPlan,
  listTechnicianPayoutsQuery,
  runListTechnicianPayoutsQuery,
} from "../../integrations/supabase/queries/technicianPayouts";
import {
  getTechnicianRosterQueryPlan,
  listTechniciansQuery,
  runListTechniciansQuery,
} from "../../integrations/supabase/queries/technicians";
import {
  attachCommunicationToJobMutation,
  createCommunicationMutation,
  markCommunicationReviewedMutation,
  runCreateCommunicationMutation,
  runUpdateCommunicationMutation,
  updateCommunicationStatusMutation,
} from "../../integrations/supabase/mutations/communications";
import {
  createCustomerMutation,
  runCreateCustomerMutation,
  runUpdateCustomerMutation,
  updateCustomerMutation,
} from "../../integrations/supabase/mutations/customers";
import {
  createInvoiceMutation,
  runCreateInvoiceMutation,
  runUpdateInvoicePaymentMutation,
  updateInvoicePaymentMutation,
} from "../../integrations/supabase/mutations/invoices";
import {
  createJobTimelineEventMutation,
  runCreateJobTimelineEventMutation,
} from "../../integrations/supabase/mutations/jobTimelineEvents";
import {
  assignTechnicianToJobMutation,
  createJobMutation,
  runAssignTechnicianToJobMutation,
  runCreateJobMutation,
  runUpdateJobStatusMutation,
  updateJobStatusMutation,
} from "../../integrations/supabase/mutations/jobs";
import { createTechnicianPayoutMutation, linkPayoutInvoicesMutation } from "../../integrations/supabase/mutations/technicianPayouts";
import { updateTechnicianMutation } from "../../integrations/supabase/mutations/technicians";
import {
  createUnmatchedInboundMutation,
  resolveUnmatchedInboundMutation,
  runUpdateUnmatchedInboundMutation,
} from "../../integrations/supabase/mutations/unmatchedInbound";
import {
  mapCommunicationAttachmentToUpdate,
  mapCommunicationDraftToInsert,
  mapCommunicationRowToDomain,
  mapCommunicationStatusPatchToUpdate,
  mapCustomerDraftToInsert,
  mapCustomerPatchToUpdate,
  mapInvoiceDraftToInsert,
  mapInvoicePaymentPatchToUpdate,
  mapJobAssignmentToUpdate,
  mapJobDraftToInsert,
  mapJobRowToDomain,
  mapJobTimelineEventDraftToInsert,
  mapJobTimelineEventRowToDomain,
  mapHiringCandidateRowToDomain,
  mapJobWorkflowPatchToUpdate,
  mapPayoutInvoiceLinksToInsert,
  mapTechnicianRowToDomain,
  mapTechnicianPayoutDraftToInsert,
  mapUnmatchedInboundCommunicationRowToDomain,
  mapUnmatchedInboundCommunicationPatchToUpdate,
} from "../../integrations/supabase/mappers";
import { mockOperationsRepository } from "./mockOperationsRepository";
import { buildDispatchTechnicianAvailabilitySummary } from "../domain/jobs";
import {
  extractZipCode,
  findBestTechnicianForZip,
} from "../domain/technicianCoverage";
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

const readPlans = {
  homeDashboard: getHomeDashboardQueryPlan(),
  jobsList: getJobsQueueQueryPlan(),
  jobDetail: getJobDetailHydrationQueryPlan("<job_id>"),
  customersList: getCustomerDirectoryQueryPlan(),
  customerProfile: getCustomerProfileHydrationQueryPlan("<customer_id>"),
  dispatchQueue: getDispatchQueueQueryPlan(),
  dispatchUnassigned: getDispatchUnassignedJobsQueryPlan(),
  dispatchAttention: getDispatchAttentionJobsQueryPlan(),
  dispatchTechnicians: getDispatchTechnicianAvailabilityQueryPlan(),
  communicationsFeed: getCommunicationsFeedQueryPlan(),
  communicationDetail: getCommunicationDetailQueryPlan("<communication_id>"),
  unmatchedInboundQueue: getUnmatchedInboundQueueQueryPlan(),
  invoicesList: getInvoicesCollectionsQueryPlan(),
  invoiceDetail: getInvoiceDetailQueryPlan("<invoice_id>"),
  revenuePage: getRevenuePageQueryPlan(),
  techniciansList: getTechnicianRosterQueryPlan(),
  customerRows: listCustomersQuery(),
  customerRowById: getCustomerByIdQuery("<customer_id>"),
  jobRows: listJobsQuery(),
  jobInvoiceRows: getJobInvoicesQuery("<job_id>"),
  jobTimelineRows: getJobTimelineQuery("<job_id>"),
  communicationRows: listCommunicationsQuery(),
  communicationRowsByJob: getCommunicationsByJobQuery("<job_id>"),
  invoiceRows: listInvoicesQuery(),
  technicianRows: listTechniciansQuery(),
  hiringCandidates: listHiringCandidatesQuery(),
  payoutRows: listTechnicianPayoutsQuery(),
  payoutRecords: getTechnicianPayoutsHydrationQueryPlan(),
  timelineRows: listJobTimelineEventsQuery("<job_id>"),
};

const mutationPlans = {
  createCustomer: createCustomerMutation(),
  updateCustomer: updateCustomerMutation(),
  createJob: createJobMutation(),
  assignTechnician: assignTechnicianToJobMutation(),
  updateJobWorkflow: updateJobStatusMutation(),
  createCommunication: createCommunicationMutation(),
  updateCommunication: updateCommunicationStatusMutation(),
  markCommunicationReviewed: markCommunicationReviewedMutation(),
  attachCommunicationToJob: attachCommunicationToJobMutation(),
  createUnmatchedInbound: createUnmatchedInboundMutation(),
  resolveUnmatchedInbound: resolveUnmatchedInboundMutation(),
  createInvoice: createInvoiceMutation(),
  updateInvoicePayment: updateInvoicePaymentMutation(),
  appendTimelineEvent: createJobTimelineEventMutation(),
  createTechnicianPayout: createTechnicianPayoutMutation(),
  linkPayoutInvoices: linkPayoutInvoicesMutation(),
  updateTechnician: updateTechnicianMutation(),
};

let lastSupabaseReadError = null;
let lastLiveJobList = [];
const lastLiveJobDetails = new Map();
let lastLiveInvoiceList = [];
const lastLiveInvoiceDetails = new Map();
let lastLivePayoutList = [];

function resetJobCaches() {
  lastLiveJobList = [];
  lastLiveJobDetails.clear();
}

function resetInvoiceCaches() {
  lastLiveInvoiceList = [];
  lastLiveInvoiceDetails.clear();
}

function resetPayoutCaches() {
  lastLivePayoutList = [];
}

function clearRuntimeCaches() {
  clearSupabaseReadModelsCache();
  resetJobCaches();
  resetInvoiceCaches();
  resetPayoutCaches();
}

function cacheLiveJobList(jobRecords) {
  lastLiveJobList = jobRecords;

  jobRecords.forEach((job) => {
    lastLiveJobDetails.set(job.jobId, job);
  });

  return jobRecords;
}

function cacheLiveJobDetail(jobRecord) {
  if (!jobRecord) {
    return null;
  }

  lastLiveJobDetails.set(jobRecord.jobId, jobRecord);
  return jobRecord;
}

function getCachedJobDetail(jobId) {
  return lastLiveJobDetails.get(jobId) || lastLiveJobList.find((job) => job.jobId === jobId) || null;
}

function cacheLiveInvoiceList(invoiceRecords) {
  lastLiveInvoiceList = invoiceRecords;

  invoiceRecords.forEach((invoice) => {
    lastLiveInvoiceDetails.set(invoice.invoiceId, invoice);
  });

  return invoiceRecords;
}

function cacheLiveInvoiceDetail(invoiceRecord) {
  if (!invoiceRecord) {
    return null;
  }

  lastLiveInvoiceDetails.set(invoiceRecord.invoiceId, invoiceRecord);
  return invoiceRecord;
}

function getCachedInvoiceDetail(invoiceId) {
  return (
    lastLiveInvoiceDetails.get(invoiceId) ||
    lastLiveInvoiceList.find((invoice) => invoice.invoiceId === invoiceId) ||
    null
  );
}

function cacheLivePayoutList(payoutRecords) {
  lastLivePayoutList = payoutRecords;
  return payoutRecords;
}

async function loadLiveDispatchBoardJobs(client) {
  return mapHydratedJobRowsToRecords(await runListDispatchBoardJobsQuery(client));
}

async function loadLiveTechnicianRoster(client) {
  return (await runListTechniciansQuery(client)).map(mapTechnicianRowToDomain);
}

async function loadLiveHiringCandidates(client) {
  return (await runListHiringCandidatesQuery(client)).map(mapHiringCandidateRowToDomain);
}

async function loadLiveCustomerDirectory(client) {
  return mapHydratedCustomerRowsToRecords(await runListCustomerDirectoryQuery(client));
}

async function loadLiveCustomerProfile(client, customerId) {
  const row = await runCustomerProfileQuery(client, customerId);
  return row ? mapHydratedCustomerRowToRecord(row) : null;
}

async function loadLiveCommunicationFeed(client, filters = {}) {
  return mapHydratedCommunicationRowsToRecords(
    await runListCommunicationsFeedQuery(client, filters),
  );
}

async function loadLiveCommunicationDetail(client, communicationId) {
  const row = await runCommunicationDetailQuery(client, communicationId);
  return row ? mapHydratedCommunicationRowToRecord(row) : null;
}

async function loadLiveUnmatchedInboundQueue(client) {
  return (await runListPendingUnmatchedInboundQuery(client)).map(
    mapUnmatchedInboundCommunicationRowToDomain,
  );
}

async function loadLiveInvoiceList(client) {
  return mapHydratedInvoiceRowsToRecords(await runListInvoicesCollectionsQuery(client));
}

async function loadLiveInvoiceDetail(client, invoiceId) {
  const row = await runInvoiceDetailQuery(client, invoiceId);
  return row ? mapHydratedInvoiceRowToRecord(row) : null;
}

async function loadLiveHomeJobs(client) {
  return cacheLiveJobList(mapHydratedJobRowsToRecords(await runListJobsQuery(client)));
}

async function loadLiveTechnicianPayouts(client) {
  return mapHydratedTechnicianPayoutRowsToRecords(await runListTechnicianPayoutsQuery(client));
}

function createSupabaseFallbackMutation(operation, plan, payload) {
  return {
    ok: false,
    operation,
    source: "supabase",
    plan,
    payload,
    message: isSupabaseConfigured()
      ? "Supabase mode is selected, but this mutation path did not execute a live write."
      : "Supabase mode is selected without credentials. Returning a typed placeholder response while mock fallback keeps the UI running.",
  };
}

function createSupabaseMutationFailure(operation, plan, payload, error) {
  return {
    ok: false,
    source: "supabase",
    operation,
    plan,
    payload,
    message: `Supabase write failed: ${error.message}`,
  };
}

async function requestLumiaInvoiceSms(invoiceRecord) {
  const response = await fetch(getLocalOperationsServerUrl("/api/invoices/send-lumia"), {
    method: "POST",
    headers: getLocalOperationsServerHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      invoice: {
        invoiceId: invoiceRecord.invoiceId,
        customerName: invoiceRecord.customer?.name || null,
        totalAmount: invoiceRecord.totalAmount,
        outstandingBalance: invoiceRecord.outstandingBalance,
      },
    }),
  });

  const responseText = await response.text();
  let responseJson = null;

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch (error) {
      responseJson = null;
    }
  }

  if (!response.ok || !responseJson?.ok) {
    throw new Error(
      responseJson?.message || `Invoice SMS request failed with status ${response.status}.`,
    );
  }

  return responseJson;
}

async function readWithFallback(readOperation, mockFallback) {
  if (!isSupabaseConfigured()) {
    return mockFallback();
  }

  try {
    const result = await readOperation();
    lastSupabaseReadError = null;
    return result;
  } catch (error) {
    lastSupabaseReadError = error;
    console.error("Supabase read failed. Falling back to mock data.", error);
    return mockFallback();
  }
}

async function runSupabaseMutation(operation, plan, payload, execute, mapRecord) {
  if (!isSupabaseConfigured()) {
    return createSupabaseFallbackMutation(operation, plan, payload);
  }

  try {
    const client = getSupabaseClient();

    if (!client) {
      return createSupabaseFallbackMutation(operation, plan, payload);
    }

    const record = await execute(client);
    clearRuntimeCaches();

    return {
      ok: true,
      source: "supabase",
      operation,
      plan,
      payload,
      record: mapRecord ? mapRecord(record) : record,
      message: "Live Supabase mutation succeeded.",
    };
  } catch (error) {
    console.error("Supabase write failed.", error);
    return createSupabaseMutationFailure(operation, plan, payload, error);
  }
}

const customers = {
  async list() {
    return readWithFallback(
      async () => loadLiveCustomerDirectory(getSupabaseClient()),
      () => mockOperationsRepository.customers.list(),
    );
  },
  async getProfile(customerId) {
    return readWithFallback(
      async () => loadLiveCustomerProfile(getSupabaseClient(), customerId),
      () => mockOperationsRepository.customers.getProfile(customerId),
    );
  },
  create(draft) {
    const payload = mapCustomerDraftToInsert(draft);

    return runSupabaseMutation(
      "customers.create",
      mutationPlans.createCustomer,
      payload,
      async (client) => {
        const customer = await runCreateCustomerMutation(client, payload);
        const hydratedRecord = await runCustomerProfileQuery(client, customer.customer_id);
        return hydratedRecord || customer;
      },
      (record) => (record?.customer_id ? mapHydratedCustomerRowToRecord(record) : record),
    );
  },
  update(customerId, patch) {
    const payload = mapCustomerPatchToUpdate(patch);

    return runSupabaseMutation(
      "customers.update",
      mutationPlans.updateCustomer,
      {
        customerId,
        ...payload,
      },
      async (client) => {
        await runUpdateCustomerMutation(client, customerId, payload);
        return runCustomerProfileQuery(client, customerId);
      },
      (record) => (record ? mapHydratedCustomerRowToRecord(record) : null),
    );
  },
};

const technicians = {
  async list() {
    return readWithFallback(
      async () => loadLiveTechnicianRoster(getSupabaseClient()),
      () => mockOperationsRepository.technicians.list(),
    );
  },
};

const jobs = {
  async list() {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        return cacheLiveJobList(mapHydratedJobRowsToRecords(await runListJobsQuery(client)));
      },
      () => mockOperationsRepository.jobs.list(),
    );
  },
  async getDetail(jobId) {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        const baseRow = await runJobDetailQuery(client, jobId);

        if (!baseRow) {
          return null;
        }

        const [invoiceRows, communicationRows, timelineRows] = await Promise.all([
          runJobInvoicesQuery(client, jobId),
          runCommunicationsByJobQuery(client, jobId),
          runJobTimelineQuery(client, jobId),
        ]);

        return cacheLiveJobDetail(
          mapHydratedJobRowToRecord(baseRow, {
            invoiceRows,
            communicationRows,
            timelineRows,
          }),
        );
      },
      () => getCachedJobDetail(jobId) || mockOperationsRepository.jobs.getDetail(jobId),
    );
  },
  async create(draft) {
    let nextDraft = draft;

    if (!draft.techId && isSupabaseConfigured()) {
      const serviceZipCode = extractZipCode(draft.serviceAddress);
      const client = getSupabaseClient();

      if (serviceZipCode && client) {
        const matchedTechnician = findBestTechnicianForZip(
          serviceZipCode,
          await loadLiveTechnicianRoster(client),
        );

        if (matchedTechnician?.techId) {
          nextDraft = {
            ...draft,
            techId: matchedTechnician.techId,
          };
        }
      }
    }

    const payload = mapJobDraftToInsert(nextDraft);

    return runSupabaseMutation(
      "jobs.create",
      mutationPlans.createJob,
      payload,
      (client) => runCreateJobMutation(client, payload),
      mapJobRowToDomain,
    );
  },
  assignTechnician(jobId, draft) {
    const updatePayload = mapJobAssignmentToUpdate(draft);
    const payload = { jobId, ...updatePayload };

    return runSupabaseMutation(
      "jobs.assignTechnician",
      mutationPlans.assignTechnician,
      payload,
      (client) => runAssignTechnicianToJobMutation(client, jobId, updatePayload),
      mapJobRowToDomain,
    );
  },
  updateWorkflow(jobId, patch) {
    const updatePayload = mapJobWorkflowPatchToUpdate(patch);
    const payload = { jobId, ...updatePayload };

    return runSupabaseMutation(
      "jobs.updateWorkflow",
      mutationPlans.updateJobWorkflow,
      payload,
      (client) => runUpdateJobStatusMutation(client, jobId, updatePayload),
      mapJobRowToDomain,
    );
  },
};

const dispatch = {
  async listBoardJobs() {
    return readWithFallback(
      async () => loadLiveDispatchBoardJobs(getSupabaseClient()),
      () => mockOperationsRepository.dispatch.listBoardJobs(),
    );
  },
  async listUnassignedJobs() {
    return readWithFallback(
      async () => mapHydratedJobRowsToRecords(await runListDispatchUnassignedJobsQuery(getSupabaseClient())),
      () => mockOperationsRepository.dispatch.listUnassignedJobs(),
    );
  },
  async listAttentionJobs() {
    return readWithFallback(
      async () => mapHydratedJobRowsToRecords(await runListDispatchAttentionJobsQuery(getSupabaseClient())),
      () => mockOperationsRepository.dispatch.listAttentionJobs(),
    );
  },
  async getTechnicianAvailabilitySummary() {
    return readWithFallback(
      async () =>
        buildDispatchTechnicianAvailabilitySummary(
          await loadLiveTechnicianRoster(getSupabaseClient()),
        ),
      () => mockOperationsRepository.dispatch.getTechnicianAvailabilitySummary(),
    );
  },
  assignTechnician(jobId, draft) {
    const updatePayload = mapJobAssignmentToUpdate(draft);
    const payload = { jobId, ...updatePayload };

    return runSupabaseMutation(
      "dispatch.assignTechnician",
      mutationPlans.assignTechnician,
      payload,
      (client) => runAssignTechnicianToJobMutation(client, jobId, updatePayload),
      mapJobRowToDomain,
    );
  },
  updateStatus(jobId, patch) {
    const updatePayload = mapJobWorkflowPatchToUpdate(patch);
    const payload = { jobId, ...updatePayload };

    return runSupabaseMutation(
      "dispatch.updateStatus",
      mutationPlans.updateJobWorkflow,
      payload,
      (client) => runUpdateJobStatusMutation(client, jobId, updatePayload),
      mapJobRowToDomain,
    );
  },
  updateEta(jobId, patch) {
    const updatePayload = mapJobWorkflowPatchToUpdate(patch);
    const payload = { jobId, ...updatePayload };

    return runSupabaseMutation(
      "dispatch.updateEta",
      mutationPlans.updateJobWorkflow,
      payload,
      (client) => runUpdateJobStatusMutation(client, jobId, updatePayload),
      mapJobRowToDomain,
    );
  },
  escalateJob(jobId, draft = {}) {
    const updatePayload = mapJobWorkflowPatchToUpdate({
      dispatchStatus: "escalated",
      priority: draft.priority || "escalated",
      customerUpdated: draft.customerUpdated,
    });
    const timelinePayload = mapJobTimelineEventDraftToInsert({
      jobId,
      actorType: "dispatch",
      actorLabel: "Dispatch",
      eventType: "dispatch_updated",
      eventAt: draft.eventAt || new Date().toISOString(),
      summary: draft.summary || "Job escalated for dispatch review.",
      details: draft.details ?? null,
    });

    return runSupabaseMutation(
      "dispatch.escalateJob",
      {
        updateJob: mutationPlans.updateJobWorkflow,
        appendTimelineEvent: mutationPlans.appendTimelineEvent,
      },
      {
        jobId,
        update: updatePayload,
        timelineEvent: timelinePayload,
      },
      async (client) => {
        const job = await runUpdateJobStatusMutation(client, jobId, updatePayload);
        const timelineEvent = await runCreateJobTimelineEventMutation(client, timelinePayload);

        return { job, timelineEvent };
      },
      (record) => ({
        job: mapJobRowToDomain(record.job),
        timelineEvent: mapJobTimelineEventRowToDomain(record.timelineEvent),
      }),
    );
  },
};

const communications = {
  async listFeed(filters = {}) {
    return readWithFallback(
      async () => loadLiveCommunicationFeed(getSupabaseClient(), filters),
      () => mockOperationsRepository.communications.listFeed(filters),
    );
  },
  async getDetail(communicationId) {
    return readWithFallback(
      async () => loadLiveCommunicationDetail(getSupabaseClient(), communicationId),
      () => mockOperationsRepository.communications.getDetail(communicationId),
    );
  },
  async listUnmatchedInbound() {
    return readWithFallback(
      async () => loadLiveUnmatchedInboundQueue(getSupabaseClient()),
      () => mockOperationsRepository.communications.listUnmatchedInbound(),
    );
  },
  createLog(draft) {
    const payload = mapCommunicationDraftToInsert(draft);

    return runSupabaseMutation(
      "communications.createLog",
      mutationPlans.createCommunication,
      payload,
      (client) => runCreateCommunicationMutation(client, payload),
      mapCommunicationRowToDomain,
    );
  },
  markReviewed(communicationId, draft = {}) {
    const updatePayload = mapCommunicationStatusPatchToUpdate({
      communicationStatus: draft.communicationStatus || "clear",
    });

    return runSupabaseMutation(
      "communications.markReviewed",
      {
        updateCommunication: mutationPlans.markCommunicationReviewed,
        appendTimelineEvent: mutationPlans.appendTimelineEvent,
      },
      {
        communicationId,
        update: updatePayload,
      },
      async (client) => {
        const communication = await runUpdateCommunicationMutation(
          client,
          communicationId,
          updatePayload,
        );

        if (!draft.timelineSummary || !communication?.job_id) {
          return { communication, timelineEvent: null };
        }

        const timelineEvent = await runCreateJobTimelineEventMutation(
          client,
          mapJobTimelineEventDraftToInsert({
            jobId: communication.job_id,
            actorType: "dispatch",
            actorLabel: "Communications",
            eventType: "communication_logged",
            eventAt: draft.eventAt || new Date().toISOString(),
            summary: draft.timelineSummary,
            details: draft.timelineDetails ?? null,
          }),
        );

        return { communication, timelineEvent };
      },
      (record) => ({
        communication: mapCommunicationRowToDomain(record.communication),
        timelineEvent: record.timelineEvent
          ? mapJobTimelineEventRowToDomain(record.timelineEvent)
          : null,
      }),
    );
  },
  updateStatus(communicationId, patch) {
    const updatePayload = mapCommunicationStatusPatchToUpdate(patch);

    return runSupabaseMutation(
      "communications.updateStatus",
      mutationPlans.updateCommunication,
      {
        communicationId,
        ...updatePayload,
      },
      (client) => runUpdateCommunicationMutation(client, communicationId, updatePayload),
      mapCommunicationRowToDomain,
    );
  },
  attachToJob(communicationId, draft) {
    const updatePayload = mapCommunicationAttachmentToUpdate(draft);

    return runSupabaseMutation(
      "communications.attachToJob",
      {
        updateCommunication: mutationPlans.attachCommunicationToJob,
        appendTimelineEvent: mutationPlans.appendTimelineEvent,
      },
      {
        communicationId,
        update: updatePayload,
      },
      async (client) => {
        const communication = await runUpdateCommunicationMutation(
          client,
          communicationId,
          updatePayload,
        );

        if (!draft.timelineSummary) {
          return { communication, timelineEvent: null };
        }

        const timelineEvent = await runCreateJobTimelineEventMutation(
          client,
          mapJobTimelineEventDraftToInsert({
            jobId: draft.jobId,
            actorType: "dispatch",
            actorLabel: "Communications",
            eventType: "communication_logged",
            eventAt: draft.eventAt || new Date().toISOString(),
            summary: draft.timelineSummary,
            details: draft.timelineDetails ?? null,
          }),
        );

        return { communication, timelineEvent };
      },
      (record) => ({
        communication: mapCommunicationRowToDomain(record.communication),
        timelineEvent: record.timelineEvent
          ? mapJobTimelineEventRowToDomain(record.timelineEvent)
          : null,
      }),
    );
  },
  resolveUnmatchedInbound(unmatchedCommunicationId, draft) {
    const payload = {
      unmatchedCommunicationId,
      customerId: draft.customerId,
      jobId: draft.jobId ?? null,
      notes: draft.notes ?? null,
    };

    return runSupabaseMutation(
      "communications.resolveUnmatchedInbound",
      {
        unmatchedInboundQueue: readPlans.unmatchedInboundQueue,
        createCommunication: mutationPlans.createCommunication,
        resolveUnmatchedInbound: mutationPlans.resolveUnmatchedInbound,
      },
      payload,
      async (client) => {
        const unmatchedInbound = await runGetUnmatchedInboundQuery(client, unmatchedCommunicationId);

        if (!unmatchedInbound) {
          throw new Error("Selected unmatched inbound event was not found.");
        }

        if (unmatchedInbound.resolution_status !== "pending") {
          throw new Error("This inbound event has already been resolved.");
        }

        if (draft.jobId) {
          const jobLookup = await client
            .from("jobs")
            .select("job_id,customer_id")
            .eq("job_id", draft.jobId)
            .maybeSingle();

          if (jobLookup.error) {
            throw new Error(`jobs.getForUnmatchedInbound: ${jobLookup.error.message}`);
          }

          if (!jobLookup.data) {
            throw new Error("Selected job was not found.");
          }

          if (jobLookup.data.customer_id !== draft.customerId) {
            throw new Error("Selected job does not belong to the selected customer.");
          }
        }

        let existingCommunication = null;

        if (unmatchedInbound.provider_message_sid) {
          const communicationLookup = await client
            .from("communications")
            .select("*")
            .eq("provider_message_sid", unmatchedInbound.provider_message_sid)
            .maybeSingle();

          if (communicationLookup.error) {
            throw new Error(
              `communications.lookupByProviderMessageSid: ${communicationLookup.error.message}`,
            );
          }

          existingCommunication = communicationLookup.data || null;
        } else if (unmatchedInbound.provider_call_sid) {
          const communicationLookup = await client
            .from("communications")
            .select("*")
            .eq("provider_call_sid", unmatchedInbound.provider_call_sid)
            .maybeSingle();

          if (communicationLookup.error) {
            throw new Error(
              `communications.lookupByProviderCallSid: ${communicationLookup.error.message}`,
            );
          }

          existingCommunication = communicationLookup.data || null;
        }

        if (existingCommunication && existingCommunication.customer_id !== draft.customerId) {
          throw new Error("A communication already exists for this provider event under a different customer.");
        }

        let communication = existingCommunication;

        if (communication && draft.jobId && !communication.job_id) {
          communication = await runUpdateCommunicationMutation(client, communication.communication_id, {
            job_id: draft.jobId,
          });
        }

        if (!communication) {
          communication = await runCreateCommunicationMutation(
            client,
            mapCommunicationDraftToInsert({
              customerId: draft.customerId,
              communicationChannel: unmatchedInbound.communication_channel,
              communicationStatus: unmatchedInbound.communication_status,
              previewText: unmatchedInbound.preview_text,
              direction: unmatchedInbound.direction,
              linkedJobId: draft.jobId ?? null,
              invoiceId: null,
              transcriptText: unmatchedInbound.transcript_text,
              callHighlights: unmatchedInbound.call_highlights,
              callSummarySections: unmatchedInbound.call_summary_sections
                ? {
                    customerNeed: unmatchedInbound.call_summary_sections.customer_need || "",
                    applianceOrSystem:
                      unmatchedInbound.call_summary_sections.appliance_or_system || "",
                    schedulingAndLocation:
                      unmatchedInbound.call_summary_sections.scheduling_and_location || "",
                    partsAndWarranty:
                      unmatchedInbound.call_summary_sections.parts_and_warranty || "",
                    billingAndPayment:
                      unmatchedInbound.call_summary_sections.billing_and_payment || "",
                    followUpActions:
                      unmatchedInbound.call_summary_sections.follow_up_actions || "",
                  }
                : null,
              transcriptionStatus: unmatchedInbound.transcription_status,
              transcriptionError: unmatchedInbound.transcription_error,
              extractedEventLabel: null,
              occurredAt: unmatchedInbound.occurred_at,
              startedAt: unmatchedInbound.started_at,
              endedAt: unmatchedInbound.ended_at,
              fromNumber: unmatchedInbound.from_number,
              toNumber: unmatchedInbound.to_number,
              providerName: unmatchedInbound.provider_name,
              providerMessageSid: unmatchedInbound.provider_message_sid,
              providerCallSid: unmatchedInbound.provider_call_sid,
            }),
          );
        }

        const resolvedUnmatchedInbound = await runUpdateUnmatchedInboundMutation(
          client,
          unmatchedCommunicationId,
          mapUnmatchedInboundCommunicationPatchToUpdate({
            resolutionStatus: "linked",
            linkedCustomerId: draft.customerId,
            linkedJobId: draft.jobId ?? communication.job_id ?? null,
            linkedCommunicationId: communication.communication_id,
            resolutionNotes: draft.notes ?? null,
            resolvedAt: new Date().toISOString(),
          }),
        );

        return {
          unmatchedInbound: resolvedUnmatchedInbound,
          communication,
        };
      },
      (record) => ({
        unmatchedInbound: mapUnmatchedInboundCommunicationRowToDomain(record.unmatchedInbound),
        communication: mapCommunicationRowToDomain(record.communication),
      }),
    );
  },
};

const invoices = {
  async list() {
    return readWithFallback(
      async () => cacheLiveInvoiceList(await loadLiveInvoiceList(getSupabaseClient())),
      () => mockOperationsRepository.invoices.list(),
    );
  },
  async getDetail(invoiceId) {
    return readWithFallback(
      async () => cacheLiveInvoiceDetail(await loadLiveInvoiceDetail(getSupabaseClient(), invoiceId)),
      () => getCachedInvoiceDetail(invoiceId) || mockOperationsRepository.invoices.getDetail(invoiceId),
    );
  },
  async createForJob(draft) {
    const payload = mapInvoiceDraftToInsert(draft);

    if (!isSupabaseConfigured()) {
      return createSupabaseFallbackMutation(
        "invoices.createForJob",
        mutationPlans.createInvoice,
        payload,
      );
    }

    try {
      const client = getSupabaseClient();

      if (!client) {
        return createSupabaseFallbackMutation(
          "invoices.createForJob",
          mutationPlans.createInvoice,
          payload,
        );
      }

      const invoice = await runCreateInvoiceMutation(client, payload);
      const hydratedInvoice = await runInvoiceDetailQuery(client, invoice.invoice_id);
      const record = mapHydratedInvoiceRowToRecord(hydratedInvoice);

      clearRuntimeCaches();

      try {
        const invoiceSmsResult = await requestLumiaInvoiceSms(record);

        return {
          ok: true,
          source: "supabase",
          operation: "invoices.createForJob",
          plan: mutationPlans.createInvoice,
          payload,
          record,
          message: `Live Supabase mutation succeeded. ${invoiceSmsResult.message}`,
        };
      } catch (notificationError) {
        console.error("Invoice created but Lumia SMS delivery failed.", notificationError);

        return {
          ok: true,
          source: "supabase",
          operation: "invoices.createForJob",
          plan: mutationPlans.createInvoice,
          payload,
          record,
          message: `Live Supabase mutation succeeded, but Lumia SMS failed: ${notificationError.message}`,
        };
      }
    } catch (error) {
      console.error("Supabase write failed.", error);
      return createSupabaseMutationFailure(
        "invoices.createForJob",
        mutationPlans.createInvoice,
        payload,
        error,
      );
    }
  },
  updatePaymentStatus(invoiceId, patch) {
    const updatePayload = mapInvoicePaymentPatchToUpdate(patch);

    return runSupabaseMutation(
      "invoices.updatePaymentStatus",
      mutationPlans.updateInvoicePayment,
      {
        invoiceId,
        ...updatePayload,
      },
      async (client) => {
        await runUpdateInvoicePaymentMutation(client, invoiceId, updatePayload);
        return runInvoiceDetailQuery(client, invoiceId);
      },
      mapHydratedInvoiceRowToRecord,
    );
  },
};

const jobTimeline = {
  async listByJob(jobId) {
    return readWithFallback(
      async () => {
        const rows = jobId
          ? await runJobTimelineQuery(getSupabaseClient(), jobId)
          : await runListJobTimelineEventsQuery(getSupabaseClient());

        return rows.map(mapJobTimelineEventRowToDomain);
      },
      () => mockOperationsRepository.jobTimeline.listByJob(jobId),
    );
  },
  append(draft) {
    const payload = mapJobTimelineEventDraftToInsert(draft);

    return runSupabaseMutation(
      "jobTimeline.append",
      mutationPlans.appendTimelineEvent,
      payload,
      (client) => runCreateJobTimelineEventMutation(client, payload),
      mapJobTimelineEventRowToDomain,
    );
  },
};

const technicianPayouts = {
  async list() {
    return readWithFallback(
      async () => cacheLivePayoutList(await loadLiveTechnicianPayouts(getSupabaseClient())),
      () => (lastLivePayoutList.length > 0 ? lastLivePayoutList : mockOperationsRepository.technicianPayouts.list()),
    );
  },
  create(draft) {
    return createSupabaseFallbackMutation(
      "technicianPayouts.create",
      mutationPlans.createTechnicianPayout,
      mapTechnicianPayoutDraftToInsert(draft),
    );
  },
  linkInvoices(draft) {
    return createSupabaseFallbackMutation(
      "technicianPayouts.linkInvoices",
      mutationPlans.linkPayoutInvoices,
      mapPayoutInvoiceLinksToInsert(draft),
    );
  },
};

export const supabaseOperationsRepository = {
  source: "supabase",
  clearRuntimeCaches,
  customers,
  dispatch,
  technicians,
  jobs,
  communications,
  invoices,
  jobTimeline,
  technicianPayouts,
  getClientStatus() {
    return getSupabaseClientStatus({ lastError: lastSupabaseReadError });
  },
  getReadPlanRegistry() {
    return readPlans;
  },
  getMutationPlanRegistry() {
    return mutationPlans;
  },
  async getHomePageData() {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        const [
          jobRecords,
          communicationRecords,
          invoiceRecords,
          technicians,
          hiringCandidates,
        ] = await Promise.all([
          loadLiveHomeJobs(client),
          loadLiveCommunicationFeed(client),
          loadLiveInvoiceList(client),
          loadLiveTechnicianRoster(client),
          loadLiveHiringCandidates(client),
        ]);

        return buildHomePageData({
          jobRecords,
          communicationRecords,
          invoiceRecords: cacheLiveInvoiceList(invoiceRecords),
          technicians,
          hiringCandidates,
        });
      },
      () => mockOperationsRepository.getHomePageData(),
    );
  },
  async getJobsPageData() {
    return buildJobsPageData({
      jobRecords: await jobs.list(),
    });
  },
  async getCustomersPageData() {
    return readWithFallback(
      async () =>
        buildCustomersPageData({
          customerRecords: await loadLiveCustomerDirectory(getSupabaseClient()),
        }),
      () => mockOperationsRepository.getCustomersPageData(),
    );
  },
  async getDispatchPageData() {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        const [jobRecords, technicianRows] = await Promise.all([
          loadLiveDispatchBoardJobs(client),
          loadLiveTechnicianRoster(client),
        ]);

        return buildDispatchPageData({
          jobRecords,
          technicians: technicianRows,
        });
      },
      () => mockOperationsRepository.getDispatchPageData(),
    );
  },
  async getCommunicationsPageData() {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        const [communicationRecords, unmatchedInboundRecords] = await Promise.all([
          loadLiveCommunicationFeed(client),
          loadLiveUnmatchedInboundQueue(client),
        ]);

        return buildCommunicationsPageData({
          communicationRecords,
          unmatchedInboundRecords,
        });
      },
      () => mockOperationsRepository.getCommunicationsPageData(),
    );
  },
  async getInvoicesPageData() {
    return readWithFallback(
      async () =>
        buildInvoicesPageData({
          invoiceRecords: cacheLiveInvoiceList(await loadLiveInvoiceList(getSupabaseClient())),
        }),
      () => mockOperationsRepository.getInvoicesPageData(),
    );
  },
  async getRevenuePageData() {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        const [invoiceRecords, payoutRecords] = await Promise.all([
          loadLiveInvoiceList(client),
          loadLiveTechnicianPayouts(client),
        ]);

        return buildRevenuePageData({
          invoiceRecords: cacheLiveInvoiceList(invoiceRecords),
          payoutRecords: cacheLivePayoutList(payoutRecords),
        });
      },
      () => mockOperationsRepository.getRevenuePageData(),
    );
  },
  async getTechniciansPageData() {
    return readWithFallback(
      async () => {
        const client = getSupabaseClient();
        const [technicians, hiringCandidates] = await Promise.all([
          loadLiveTechnicianRoster(client),
          loadLiveHiringCandidates(client),
        ]);

        return buildTechniciansPageData({
          technicians,
          hiringCandidates,
        });
      },
      () => mockOperationsRepository.getTechniciansPageData(),
    );
  },
  getSettingsPageData() {
    return buildSettingsPageData();
  },
  isConfigured() {
    return isSupabaseConfigured();
  },
};
