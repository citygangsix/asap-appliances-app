/** @typedef {import("../../types/models").CommunicationDraft} CommunicationDraft */
/** @typedef {import("../../types/models").CommunicationAttachmentDraft} CommunicationAttachmentDraft */
/** @typedef {import("../../types/models").CommunicationFeedFilters} CommunicationFeedFilters */
/** @typedef {import("../../types/models").CommunicationReviewDraft} CommunicationReviewDraft */
/** @typedef {import("../../types/models").CommunicationStatusPatch} CommunicationStatusPatch */
/** @typedef {import("../../types/models").CommunicationsPageData} CommunicationsPageData */
/** @typedef {import("../../types/models").CustomerDraft} CustomerDraft */
/** @typedef {import("../../types/models").CustomerPatch} CustomerPatch */
/** @typedef {import("../../types/models").CustomersPageData} CustomersPageData */
/** @typedef {import("../../types/models").DispatchPageData} DispatchPageData */
/** @typedef {import("../../types/models").HomePageData} HomePageData */
/** @typedef {import("../../types/models").InvoiceDraft} InvoiceDraft */
/** @typedef {import("../../types/models").InvoicePaymentPatch} InvoicePaymentPatch */
/** @typedef {import("../../types/models").InvoicesPageData} InvoicesPageData */
/** @typedef {import("../../types/models").JobAssignmentDraft} JobAssignmentDraft */
/** @typedef {import("../../types/models").JobDraft} JobDraft */
/** @typedef {import("../../types/models").JobsPageData} JobsPageData */
/** @typedef {import("../../types/models").JobTimelineEventDraft} JobTimelineEventDraft */
/** @typedef {import("../../types/models").JobWorkflowPatch} JobWorkflowPatch */
/** @typedef {import("../../types/models").PayoutInvoiceLinkDraft} PayoutInvoiceLinkDraft */
/** @typedef {import("../../types/models").RepositorySource} RepositorySource */
/** @typedef {import("../../types/models").RevenuePageData} RevenuePageData */
/** @typedef {import("../../types/models").SettingsPageData} SettingsPageData */
/** @typedef {import("../../types/models").TechnicianPayoutDraft} TechnicianPayoutDraft */
/** @typedef {import("../../types/models").TechniciansPageData} TechniciansPageData */
/** @typedef {import("../../types/models").CustomerRecord} CustomerRecord */
/** @typedef {import("../../types/models").JobRecord} JobRecord */
/** @typedef {import("../../types/models").InvoiceRecord} InvoiceRecord */
/** @typedef {import("../../types/models").CommunicationRecord} CommunicationRecord */
/** @typedef {import("../../types/models").TechnicianPayoutRecord} TechnicianPayoutRecord */
/** @typedef {import("../../types/models").JobTimelineEvent} JobTimelineEvent */
/** @typedef {import("../../types/models").Technician} Technician */
/** @typedef {import("../../types/models").UnmatchedInboundCommunication} UnmatchedInboundCommunication */
/** @typedef {import("../../types/models").UnmatchedInboundResolutionDraft} UnmatchedInboundResolutionDraft */

/**
 * @typedef {Object} RepositoryMutationResult
 * @property {boolean} ok
 * @property {"mock"|"supabase"} source
 * @property {string} operation
 * @property {string} message
 * @property {any} [record]
 * @property {any} [payload]
 * @property {any} [plan]
 */

/**
 * @template T
 * @typedef {T | Promise<T>} MaybePromise
 */

/**
 * @typedef {Object} CustomerRepositoryContract
 * @property {() => MaybePromise<CustomerRecord[]>} list
 * @property {(customerId: string) => MaybePromise<CustomerRecord|null>} getProfile
 * @property {(draft: CustomerDraft) => MaybePromise<RepositoryMutationResult>} create
 * @property {(customerId: string, patch: CustomerPatch) => MaybePromise<RepositoryMutationResult>} update
 */

/**
 * @typedef {Object} TechnicianRepositoryContract
 * @property {() => MaybePromise<Technician[]>} list
 */

/**
 * @typedef {Object} DispatchRepositoryContract
 * @property {() => MaybePromise<JobRecord[]>} listBoardJobs
 * @property {() => MaybePromise<JobRecord[]>} listUnassignedJobs
 * @property {() => MaybePromise<JobRecord[]>} listAttentionJobs
 * @property {() => MaybePromise<DispatchPageData["technicianAvailabilitySummary"]>} getTechnicianAvailabilitySummary
 * @property {(jobId: string, draft: JobAssignmentDraft) => MaybePromise<RepositoryMutationResult>} assignTechnician
 * @property {(jobId: string, patch: JobWorkflowPatch) => MaybePromise<RepositoryMutationResult>} updateStatus
 * @property {(jobId: string, patch: JobWorkflowPatch) => MaybePromise<RepositoryMutationResult>} updateEta
 * @property {(jobId: string, draft?: { summary?: string, details?: string|null, eventAt?: string|null, customerUpdated?: boolean, priority?: "normal"|"high"|"escalated" }) => MaybePromise<RepositoryMutationResult>} escalateJob
 */

/**
 * @typedef {Object} JobRepositoryContract
 * @property {() => MaybePromise<JobRecord[]>} list
 * @property {(jobId: string) => MaybePromise<JobRecord|null>} getDetail
 * @property {(draft: JobDraft) => MaybePromise<RepositoryMutationResult>} create
 * @property {(jobId: string, draft: JobAssignmentDraft) => MaybePromise<RepositoryMutationResult>} assignTechnician
 * @property {(jobId: string, patch: JobWorkflowPatch) => MaybePromise<RepositoryMutationResult>} updateWorkflow
 */

/**
 * @typedef {Object} CommunicationRepositoryContract
 * @property {(filters?: CommunicationFeedFilters) => MaybePromise<CommunicationRecord[]>} listFeed
 * @property {(communicationId: string) => MaybePromise<CommunicationRecord|null>} getDetail
 * @property {() => MaybePromise<UnmatchedInboundCommunication[]>} listUnmatchedInbound
 * @property {(draft: CommunicationDraft) => MaybePromise<RepositoryMutationResult>} createLog
 * @property {(communicationId: string, draft?: CommunicationReviewDraft) => MaybePromise<RepositoryMutationResult>} markReviewed
 * @property {(communicationId: string, patch: CommunicationStatusPatch) => MaybePromise<RepositoryMutationResult>} updateStatus
 * @property {(communicationId: string, draft: CommunicationAttachmentDraft) => MaybePromise<RepositoryMutationResult>} attachToJob
 * @property {(unmatchedCommunicationId: string, draft: UnmatchedInboundResolutionDraft) => MaybePromise<RepositoryMutationResult>} resolveUnmatchedInbound
 */

/**
 * @typedef {Object} InvoiceRepositoryContract
 * @property {() => MaybePromise<InvoiceRecord[]>} list
 * @property {(invoiceId: string) => MaybePromise<InvoiceRecord|null>} getDetail
 * @property {(draft: InvoiceDraft) => MaybePromise<RepositoryMutationResult>} createForJob
 * @property {(invoiceId: string, patch: InvoicePaymentPatch) => MaybePromise<RepositoryMutationResult>} updatePaymentStatus
 */

/**
 * @typedef {Object} JobTimelineRepositoryContract
 * @property {(jobId?: string) => MaybePromise<JobTimelineEvent[]>} listByJob
 * @property {(draft: JobTimelineEventDraft) => MaybePromise<RepositoryMutationResult>} append
 */

/**
 * @typedef {Object} TechnicianPayoutRepositoryContract
 * @property {() => MaybePromise<TechnicianPayoutRecord[]>} list
 * @property {(draft: TechnicianPayoutDraft) => MaybePromise<RepositoryMutationResult>} create
 * @property {(draft: PayoutInvoiceLinkDraft) => MaybePromise<RepositoryMutationResult>} linkInvoices
 */

/**
 * @typedef {Object} OperationsRepositoryContract
 * @property {RepositorySource} source
 * @property {() => void} [clearRuntimeCaches]
 * @property {() => MaybePromise<HomePageData>} getHomePageData
 * @property {() => MaybePromise<JobsPageData>} getJobsPageData
 * @property {() => MaybePromise<CustomersPageData>} getCustomersPageData
 * @property {() => MaybePromise<DispatchPageData>} getDispatchPageData
 * @property {() => MaybePromise<CommunicationsPageData>} getCommunicationsPageData
 * @property {() => MaybePromise<InvoicesPageData>} getInvoicesPageData
 * @property {() => MaybePromise<RevenuePageData>} getRevenuePageData
 * @property {() => MaybePromise<TechniciansPageData>} getTechniciansPageData
 * @property {() => MaybePromise<SettingsPageData>} getSettingsPageData
 * @property {CustomerRepositoryContract} customers
 * @property {DispatchRepositoryContract} dispatch
 * @property {TechnicianRepositoryContract} technicians
 * @property {JobRepositoryContract} jobs
 * @property {CommunicationRepositoryContract} communications
 * @property {InvoiceRepositoryContract} invoices
 * @property {JobTimelineRepositoryContract} jobTimeline
 * @property {TechnicianPayoutRepositoryContract} technicianPayouts
 */

export const repositoryContracts = {};
