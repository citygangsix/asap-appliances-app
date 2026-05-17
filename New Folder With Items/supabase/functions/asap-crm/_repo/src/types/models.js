/**
 * Shared domain contracts for the frontend-only ASAP Operations CRM.
 * The mock data layer is normalized around ID-based relationships so it can
 * later be replaced by Supabase queries without reshaping the UI.
 */

/** @typedef {"new"|"scheduled"|"en_route"|"onsite"|"paused"|"return_scheduled"|"pending_installation"|"pending_repair"|"completed"|"canceled"|"declined"|"diagnostic_paid_declined_repair"|"closed"|"no_work_needed"|"paid_closed"} LifecycleStatus */
/** @typedef {"unassigned"|"assigned"|"confirmed"|"late"|"escalated"|"completed"|"canceled"|"declined"|"closed"|"paid_closed"} DispatchStatus */
/** @typedef {"none_due"|"parts_due"|"parts_paid"|"labor_due"|"labor_paid"|"partial"|"failed"|"paid_closed"|"diagnostic_paid_declined_repair"} PaymentStatus */
/** @typedef {"none_needed"|"quoted"|"awaiting_payment"|"ready_to_order"|"ordered"|"shipped"|"delivered"|"installed"|"declined"} PartsStatus */
/** @typedef {"clear"|"awaiting_callback"|"unread_message"|"unresolved"} CommunicationStatus */
/** @typedef {"inbound"|"outbound"} CommunicationDirection */
/** @typedef {"missing_phone"|"not_found"|"ambiguous"} UnmatchedInboundMatchStatus */
/** @typedef {"pending"|"linked"|"ignored"} UnmatchedInboundResolutionStatus */
/** @typedef {"contacted"|"interviewed"|"trial_scheduled"|"documents_pending"|"offered"|"onboarded"|"rejected"} HiringCandidateStage */

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
 * @property {string} [scheduledStartAt]
 * @property {string|null} [onsiteAt]
 * @property {string|null} [completedAt]
 * @property {string|null} [dispatchConfirmationRequestedAt]
 * @property {string|null} [dispatchConfirmationReceivedAt]
 * @property {number|null} [dispatchResponseMinutes]
 * @property {string|null} [technicianConfirmationResponse]
 * @property {boolean|null} [paymentCollectedBeforeTechLeft]
 */

/**
 * @typedef {Object} Customer
 * @property {string} customerId
 * @property {string} name
 * @property {string} city
 * @property {string} serviceArea
 * @property {string} primaryPhone
 * @property {string|null} secondaryPhone
 * @property {string|null} email
 * @property {string} customerSegment
 * @property {number} lifetimeValue
 * @property {string} lastContactLabel
 * @property {CommunicationStatus} communicationStatus
 * @property {string|null} activeJobId
 * @property {string|null} notes
 */

/**
 * @typedef {Object} Technician
 * @property {string} techId
 * @property {string} name
 * @property {string|null} primaryPhone
 * @property {string|null} email
 * @property {string} serviceArea
 * @property {string[]} serviceZipCodes
 * @property {string[]} skills
 * @property {string|null} [hireStartDate]
 * @property {string|null} [hireStartDateLabel]
 * @property {string} availabilityLabel
 * @property {string[]} [availabilityDays]
 * @property {string[]} [availabilityTimePreferences]
 * @property {number} jobsCompletedThisWeek
 * @property {number} callbackRatePercent
 * @property {number} payoutTotal
 * @property {number} gasReimbursementTotal
 * @property {"unassigned"|"en_route"|"onsite"|"late"} statusToday
 * @property {number} score
 * @property {number|null} [averageDispatchResponseMinutes]
 * @property {number|null} [lastDispatchResponseMinutes]
 * @property {number} [pendingDispatchConfirmationCount]
 * @property {number|null} [stayedForCollectionRatePercent]
 * @property {"stayed"|"left_early"|"unknown"} [lastCollectionBehavior]
 */

/**
 * @typedef {Object} HiringCandidate
 * @property {string} candidateId
 * @property {string} name
 * @property {string|null} primaryPhone
 * @property {string|null} email
 * @property {string|null} source
 * @property {HiringCandidateStage} stage
 * @property {string|null} trade
 * @property {string|null} city
 * @property {string|null} serviceArea
 * @property {string|null} [structuredStartDate]
 * @property {string|null} [structuredStartDateLabel]
 * @property {string|null} availabilitySummary
 * @property {string[]} [availabilityDays]
 * @property {string[]} [availabilityTimePreferences]
 * @property {string|null} [currentJobStatus]
 * @property {string|null} [toolsStatus]
 * @property {string|null} [vehicleStatus]
 * @property {string|null} [toolsVehicleSummary]
 * @property {string|null} payoutExpectationSummary
 * @property {string|null} experienceSummary
 * @property {string|null} [applianceExperienceSummary]
 * @property {string|null} [otherWorkExperienceSummary]
 * @property {string|null} nextStep
 * @property {string} callHighlights
 * @property {string} transcriptText
 * @property {string|null} linkedCommunicationId
 * @property {string|null} providerCallSid
 * @property {string|null} [promotedTechId]
 * @property {string|null} [promotedAtLabel]
 * @property {string} lastContactLabel
 * @property {number} [manualOutreachTotalCalls]
 * @property {number} [manualOutreachVoicemailLeftCount]
 * @property {number} [manualOutreachNoAnswerCount]
 * @property {number} [manualOutreachConnectedCount]
 * @property {string|null} [manualOutreachLastOutcome]
 * @property {string|null} [manualOutreachLastAgentPhone]
 * @property {string|null} [manualOutreachLastOccurredAtLabel]
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
 * @property {string} callHighlights
 * @property {CallSummarySections|null} callSummarySections
 * @property {"pending"|"completed"|"failed"|null} [transcriptionStatus]
 * @property {string|null} [transcriptionError]
 * @property {string} extractedEventLabel
 * @property {string|null} [fromNumber]
 * @property {string|null} [toNumber]
 * @property {string} [occurredAtLabel]
 * @property {string|null} [occurredAt]
 */

/**
 * @typedef {Object} UnmatchedInboundCommunication
 * @property {string} unmatchedCommunicationId
 * @property {"text"|"call"} communicationChannel
 * @property {CommunicationDirection} direction
 * @property {CommunicationStatus} communicationStatus
 * @property {UnmatchedInboundMatchStatus} matchStatus
 * @property {UnmatchedInboundResolutionStatus} resolutionStatus
 * @property {string} previewText
 * @property {string} transcriptText
 * @property {string} callHighlights
 * @property {CallSummarySections|null} callSummarySections
 * @property {"pending"|"completed"|"failed"|null} [transcriptionStatus]
 * @property {string|null} [transcriptionError]
 * @property {string|null} [fromNumber]
 * @property {string|null} [toNumber]
 * @property {string|null} [providerMessageSid]
 * @property {string|null} [providerCallSid]
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
 * @property {string} [eventAt]
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
 * @typedef {Object} CustomerPatch
 * @property {string} [name]
 * @property {string} [primaryPhone]
 * @property {string} [city]
 * @property {string} [serviceArea]
 * @property {string} [customerSegment]
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
 * @typedef {Object} CallSummarySections
 * @property {string} customerNeed
 * @property {string} applianceOrSystem
 * @property {string} schedulingAndLocation
 * @property {string} partsAndWarranty
 * @property {string} billingAndPayment
 * @property {string} followUpActions
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
 * @property {string|null} [callHighlights]
 * @property {CallSummarySections|null} [callSummarySections]
 * @property {"pending"|"completed"|"failed"|null} [transcriptionStatus]
 * @property {string|null} [transcriptionError]
 * @property {string|null} [extractedEventLabel]
 * @property {string|null} [occurredAt]
 * @property {string|null} [startedAt]
 * @property {string|null} [endedAt]
 * @property {string|null} [fromNumber]
 * @property {string|null} [toNumber]
 * @property {string|null} [providerName]
 * @property {string|null} [providerMessageSid]
 * @property {string|null} [providerCallSid]
 */

/**
 * @typedef {Object} CommunicationFeedFilters
 * @property {CommunicationDirection} [direction]
 * @property {CommunicationStatus} [communicationStatus]
 * @property {"text"|"call"} [communicationChannel]
 */

/**
 * @typedef {Object} UnmatchedInboundResolutionDraft
 * @property {string} customerId
 * @property {string|null} [jobId]
 * @property {string|null} [notes]
 */

/**
 * @typedef {Object} CommunicationStatusPatch
 * @property {CommunicationStatus} communicationStatus
 * @property {string|null} [linkedJobId]
 * @property {string|null} [invoiceId]
 * @property {string} [previewText]
 * @property {string|null} [transcriptText]
 * @property {string|null} [callHighlights]
 * @property {CallSummarySections|null} [callSummarySections]
 * @property {"pending"|"completed"|"failed"|null} [transcriptionStatus]
 * @property {string|null} [transcriptionError]
 * @property {string|null} [extractedEventLabel]
 * @property {string|null} [startedAt]
 * @property {string|null} [endedAt]
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
 * @property {() => void} [onClick]
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
 * @property {HiringCandidate[]} hiringCandidates
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
 * @property {UnmatchedInboundCommunication[]} unmatchedInboundRecords
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
 * @property {HiringCandidate[]} hiringCandidates
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
 *   communicationRecords: CommunicationRecord[],
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
