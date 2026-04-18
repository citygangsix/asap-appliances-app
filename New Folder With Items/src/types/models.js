/**
 * Shared domain contracts for the frontend-only ASAP Operations CRM.
 * The mock data layer is normalized around ID-based relationships so it can
 * later be replaced by Supabase queries without reshaping the UI.
 */

/** @typedef {"new"|"scheduled"|"en_route"|"onsite"|"paused"|"return_scheduled"|"completed"|"canceled"} LifecycleStatus */
/** @typedef {"unassigned"|"assigned"|"confirmed"|"late"|"escalated"} DispatchStatus */
/** @typedef {"none_due"|"parts_due"|"parts_paid"|"labor_due"|"labor_paid"|"partial"|"failed"} PaymentStatus */
/** @typedef {"none_needed"|"quoted"|"awaiting_payment"|"ready_to_order"|"ordered"|"shipped"|"delivered"|"installed"} PartsStatus */
/** @typedef {"clear"|"awaiting_callback"|"unread_message"|"unresolved"} CommunicationStatus */
/** @typedef {"inbound"|"outbound"} CommunicationDirection */

/**
 * @typedef {Object} Job
 * @property {string} jobId
 * @property {string} customerId
 * @property {string|null} techId
 * @property {string|null} invoiceId
 * @property {string} applianceLabel
 * @property {string} applianceBrand
 * @property {string} issueSummary
 * @property {string} scheduledStartLabel
 * @property {string} serviceAddress
 * @property {LifecycleStatus} lifecycleStatus
 * @property {DispatchStatus} dispatchStatus
 * @property {PaymentStatus} paymentStatus
 * @property {PartsStatus} partsStatus
 * @property {CommunicationStatus} communicationStatus
 * @property {boolean} customerUpdated
 * @property {string} etaLabel
 * @property {string} latenessLabel
 * @property {"normal"|"high"|"escalated"} priority
 * @property {string} internalNotes
 */

/**
 * @typedef {Object} Customer
 * @property {string} customerId
 * @property {string} name
 * @property {string} city
 * @property {string} serviceArea
 * @property {string} primaryPhone
 * @property {string} customerSegment
 * @property {number} lifetimeValue
 * @property {string} lastContactLabel
 * @property {CommunicationStatus} communicationStatus
 * @property {string|null} activeJobId
 */

/**
 * @typedef {Object} Technician
 * @property {string} techId
 * @property {string} name
 * @property {string} serviceArea
 * @property {string[]} skills
 * @property {string} availabilityLabel
 * @property {number} jobsCompletedThisWeek
 * @property {number} callbackRatePercent
 * @property {number} payoutTotal
 * @property {number} gasReimbursementTotal
 * @property {"unassigned"|"en_route"|"onsite"|"late"} statusToday
 * @property {number} score
 */

/**
 * @typedef {Object} Communication
 * @property {string} communicationId
 * @property {string} customerId
 * @property {string|null} linkedJobId
 * @property {string|null} invoiceId
 * @property {"text"|"call"} communicationChannel
 * @property {CommunicationDirection} [direction]
 * @property {CommunicationStatus} communicationStatus
 * @property {string} previewText
 * @property {string} transcriptText
 * @property {string} extractedEventLabel
 * @property {string|null} [fromNumber]
 * @property {string|null} [toNumber]
 * @property {string} [occurredAtLabel]
 */

/**
 * @typedef {Object} Invoice
 * @property {string} invoiceId
 * @property {string} customerId
 * @property {string} jobId
 * @property {string|null} techId
 * @property {string} issuedOn
 * @property {string} dueOn
 * @property {number} totalAmount
 * @property {number} collectedAmount
 * @property {number} outstandingBalance
 * @property {PaymentStatus} paymentStatus
 * @property {"parts_deposit"|"labor"|"parts_and_labor"|"parts_payment"} invoiceType
 */

/**
 * @typedef {Object} RevenueSummary
 * @property {string} summaryId
 * @property {string} label
 * @property {number} amount
 * @property {string} detail
 */

/**
 * @typedef {Object} TechnicianPayout
 * @property {string} payoutId
 * @property {string} techId
 * @property {number} amount
 * @property {"ready"|"pending"|"partial"|"retry"} status
 * @property {string} note
 * @property {string[]} invoiceIds
 */

/**
 * @typedef {Object} JobTimelineEvent
 * @property {string} eventId
 * @property {string} jobId
 * @property {"assistant"|"technician"|"dispatch"|"system"|"customer"} actorType
 * @property {string} actorLabel
 * @property {string} eventType
 * @property {string} eventAtLabel
 * @property {string} summary
 * @property {string} details
 */

/**
 * @typedef {Object} SidebarItem
 * @property {string} itemId
 * @property {string} label
 * @property {string} path
 * @property {string} icon
 * @property {string} group
 */

/**
 * @typedef {Object} RouteMeta
 * @property {string} routeId
 * @property {string} path
 * @property {string} label
 * @property {string} icon
 * @property {string} group
 * @property {string} eyebrow
 * @property {string} alert
 */

/** @typedef {"mock"|"supabase"} RepositorySource */

/**
 * @typedef {Object} CustomerDraft
 * @property {string} name
 * @property {string} primaryPhone
 * @property {string} city
 * @property {string} serviceArea
 * @property {string} customerSegment
 * @property {CommunicationStatus} [communicationStatus]
 * @property {string|null} [secondaryPhone]
 * @property {string|null} [email]
 * @property {string|null} [lastContactAt]
 * @property {string|null} [notes]
 */

/**
 * @typedef {Object} JobDraft
 * @property {string} customerId
 * @property {string} applianceLabel
 * @property {string} applianceBrand
 * @property {string} issueSummary
 * @property {string} serviceAddress
 * @property {string} scheduledStartAt
 * @property {string|null} [techId]
 * @property {string|null} [etaAt]
 * @property {string|null} [etaWindowText]
 * @property {"normal"|"high"|"escalated"} [priority]
 * @property {string|null} [internalNotes]
 */

/**
 * @typedef {Object} JobAssignmentDraft
 * @property {string|null} techId
 * @property {DispatchStatus} [dispatchStatus]
 * @property {string|null} [etaAt]
 * @property {boolean} [customerUpdated]
 */

/**
 * @typedef {Object} JobWorkflowPatch
 * @property {string|null} [scheduledStartAt]
 * @property {string|null} [etaAt]
 * @property {string|null} [etaWindowText]
 * @property {LifecycleStatus} [lifecycleStatus]
 * @property {DispatchStatus} [dispatchStatus]
 * @property {PaymentStatus} [paymentStatus]
 * @property {PartsStatus} [partsStatus]
 * @property {CommunicationStatus} [communicationStatus]
 * @property {boolean} [customerUpdated]
 * @property {"normal"|"high"|"escalated"} [priority]
 * @property {number|null} [latenessMinutes]
 * @property {string|null} [internalNotes]
 * @property {string|null} [enRouteAt]
 * @property {string|null} [onsiteAt]
 * @property {string|null} [completedAt]
 * @property {string|null} [canceledAt]
 * @property {string|null} [returnRequestedAt]
 * @property {string|null} [returnScheduledAt]
 */

/**
 * @typedef {Object} CommunicationDraft
 * @property {string} customerId
 * @property {"text"|"call"} communicationChannel
 * @property {CommunicationStatus} communicationStatus
 * @property {string} previewText
 * @property {CommunicationDirection} [direction]
 * @property {string|null} [linkedJobId]
 * @property {string|null} [invoiceId]
 * @property {string|null} [transcriptText]
 * @property {string|null} [extractedEventLabel]
 * @property {string|null} [occurredAt]
 * @property {string|null} [fromNumber]
 * @property {string|null} [toNumber]
 */

/**
 * @typedef {Object} CommunicationFeedFilters
 * @property {CommunicationDirection} [direction]
 * @property {CommunicationStatus} [communicationStatus]
 * @property {"text"|"call"} [communicationChannel]
 */

/**
 * @typedef {Object} CommunicationStatusPatch
 * @property {CommunicationStatus} communicationStatus
 * @property {string|null} [linkedJobId]
 * @property {string|null} [invoiceId]
 * @property {string} [previewText]
 * @property {string|null} [transcriptText]
 * @property {string|null} [extractedEventLabel]
 */

/**
 * @typedef {Object} CommunicationReviewDraft
 * @property {CommunicationStatus} [communicationStatus]
 * @property {string|null} [timelineSummary]
 * @property {string|null} [timelineDetails]
 * @property {string|null} [eventAt]
 */

/**
 * @typedef {Object} CommunicationAttachmentDraft
 * @property {string} jobId
 * @property {string|null} [invoiceId]
 * @property {CommunicationStatus} [communicationStatus]
 * @property {string|null} [timelineSummary]
 * @property {string|null} [timelineDetails]
 * @property {string|null} [eventAt]
 */

/**
 * @typedef {Object} InvoiceDraft
 * @property {string} jobId
 * @property {string} invoiceNumber
 * @property {"parts_deposit"|"labor"|"parts_and_labor"|"parts_payment"} invoiceType
 * @property {PaymentStatus} paymentStatus
 * @property {string} issuedOn
 * @property {string|null} [dueOn]
 * @property {number} totalAmount
 * @property {number} [collectedAmount]
 * @property {number} [outstandingBalance]
 * @property {string|null} [techId]
 * @property {string|null} [processorReference]
 * @property {string|null} [notes]
 */

/**
 * @typedef {Object} InvoicePaymentPatch
 * @property {PaymentStatus} paymentStatus
 * @property {number} collectedAmount
 * @property {number} outstandingBalance
 * @property {string|null} [paidAt]
 * @property {string|null} [paymentFailedAt]
 */

/**
 * @typedef {Object} JobTimelineEventDraft
 * @property {string} jobId
 * @property {"assistant"|"technician"|"dispatch"|"system"|"customer"} actorType
 * @property {string} actorLabel
 * @property {string} eventType
 * @property {string} eventAt
 * @property {string} summary
 * @property {string|null} [details]
 */

/**
 * @typedef {Object} TechnicianPayoutDraft
 * @property {string} techId
 * @property {number} amount
 * @property {"ready"|"pending"|"partial"|"retry"} status
 * @property {string} note
 * @property {string[]} invoiceIds
 * @property {string} periodStart
 * @property {string} periodEnd
 */

/**
 * @typedef {Object} PayoutInvoiceLinkDraft
 * @property {string} payoutId
 * @property {string[]} invoiceIds
 */

/**
 * @typedef {Object} RevenueTrendPoint
 * @property {string} periodLabel
 * @property {number} invoicedAmount
 * @property {number} collectedAmount
 */

/**
 * @typedef {Object} PageTab
 * @property {string} label
 * @property {boolean} [active]
 * @property {string} [id]
 */

/**
 * @typedef {Object} SummaryStat
 * @property {string} label
 * @property {string|number} value
 * @property {string} detail
 */

/**
 * @typedef {Object} HomePageData
 * @property {SummaryStat[]} homeKpis
 * @property {string[]} activityFeed
 * @property {SummaryStat[]} callMetrics
 * @property {{ label: string, count: number, jobIds: string[] }[]} urgentQueues
 * @property {Technician[]} technicians
 * @property {Array<Record<string, any>>} hiringCandidates
 * @property {JobRecord[]} watchListJobs
 */

/**
 * @typedef {Object} JobsPageData
 * @property {JobRecord[]} jobRecords
 */

/**
 * @typedef {Object} CustomersPageData
 * @property {CustomerRecord[]} customerRecords
 */

/**
 * @typedef {Object} DispatchPageData
 * @property {JobRecord[]} jobRecords
 * @property {Technician[]} technicians
 * @property {JobRecord[]} unassignedJobs
 * @property {JobRecord[]} attentionJobs
 * @property {{ totalTechnicians: number, unassignedCount: number, enRouteCount: number, onsiteCount: number, lateCount: number }} technicianAvailabilitySummary
 */

/**
 * @typedef {Object} CommunicationsPageData
 * @property {CommunicationRecord[]} communicationRecords
 */

/**
 * @typedef {Object} InvoicesPageData
 * @property {InvoiceRecord[]} invoiceRecords
 * @property {SummaryStat[]} summaryCards
 * @property {InvoiceRecord[]} failedInvoices
 */

/**
 * @typedef {Object} RevenuePageData
 * @property {InvoiceRecord[]} invoiceRecords
 * @property {TechnicianPayoutRecord[]} payoutRecords
 * @property {Array<RevenueTrendPoint & { invoicedHeight: string, collectedHeight: string }>} trendBars
 * @property {number} pendingBalance
 * @property {SummaryStat[]} revenueCards
 */

/**
 * @typedef {Object} TechniciansPageData
 * @property {Technician[]} technicians
 */

/**
 * @typedef {Object} SettingsPageData
 * @property {Array<{ title: string, items: string[] }>} settingsGroups
 */

/**
 * @typedef {Job & {
 *   customer: Customer|null,
 *   technician: Technician|null,
 *   invoice: Invoice|null,
 *   communications: Communication[],
 *   timelineEvents: JobTimelineEvent[]
 * }} JobRecord
 */

/**
 * @typedef {Customer & {
 *   activeJob: JobRecord|null,
 *   jobs: JobRecord[],
 *   openBalance: number,
 *   unresolvedCount: number,
 *   latestCommunication: string
 * }} CustomerRecord
 */

/**
 * @typedef {Communication & {
 *   customer: Customer|null,
 *   linkedJob: JobRecord|null,
 *   invoice: Invoice|null
 * }} CommunicationRecord
 */

/**
 * @typedef {Invoice & {
 *   customer: Customer|null,
 *   technician: Technician|null
 * }} InvoiceRecord
 */

/**
 * @typedef {TechnicianPayout & {
 *   technician: Technician|null
 * }} TechnicianPayoutRecord
 */

export const modelTypes = {};
