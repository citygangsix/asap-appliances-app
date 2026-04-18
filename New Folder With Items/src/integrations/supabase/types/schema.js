/**
 * SQL-aligned Supabase table shapes and write payloads.
 * These mirror the migration/schema docs and intentionally use snake_case keys.
 */

/** @typedef {"new"|"scheduled"|"en_route"|"onsite"|"paused"|"return_scheduled"|"completed"|"canceled"} DbJobLifecycleStatus */
/** @typedef {"unassigned"|"assigned"|"confirmed"|"late"|"escalated"} DbJobDispatchStatus */
/** @typedef {"none_due"|"parts_due"|"parts_paid"|"labor_due"|"labor_paid"|"partial"|"failed"} DbJobPaymentStatus */
/** @typedef {"none_needed"|"quoted"|"awaiting_payment"|"ready_to_order"|"ordered"|"shipped"|"delivered"|"installed"} DbJobPartsStatus */
/** @typedef {"clear"|"awaiting_callback"|"unread_message"|"unresolved"} DbCommunicationStatus */
/** @typedef {"text"|"call"} DbCommunicationChannel */
/** @typedef {"inbound"|"outbound"} DbCommunicationDirection */
/** @typedef {"parts_deposit"|"labor"|"parts_and_labor"|"parts_payment"} DbInvoiceType */
/** @typedef {"draft"|"open"|"partial"|"paid"|"failed"|"void"} DbInvoicePaymentStatus */
/** @typedef {"normal"|"high"|"escalated"} DbJobPriority */
/** @typedef {"unassigned"|"en_route"|"onsite"|"late"} DbTechnicianStatusToday */
/** @typedef {"assistant"|"technician"|"dispatch"|"system"|"customer"} DbTimelineActorType */
/** @typedef {"job_created"|"scheduled"|"tech_assigned"|"dispatch_updated"|"communication_logged"|"eta_updated"|"en_route"|"onsite"|"parts_requested"|"parts_ordered"|"payment_requested"|"payment_received"|"return_scheduled"|"completed"|"canceled"|"note_added"} DbTimelineEventType */
/** @typedef {"ready"|"pending"|"partial"|"retry"} DbPayoutStatus */

/**
 * @typedef {Object} CustomerRow
 * @property {string} customer_id
 * @property {string} name
 * @property {string} primary_phone
 * @property {string|null} secondary_phone
 * @property {string|null} email
 * @property {string} city
 * @property {string} service_area
 * @property {string} customer_segment
 * @property {DbCommunicationStatus} communication_status
 * @property {string|null} last_contact_at
 * @property {number} lifetime_value
 * @property {string|null} notes
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} TechnicianRow
 * @property {string} tech_id
 * @property {string} name
 * @property {string|null} primary_phone
 * @property {string|null} email
 * @property {string} service_area
 * @property {string[]} skills
 * @property {string|null} availability_notes
 * @property {DbTechnicianStatusToday} status_today
 * @property {number} jobs_completed_this_week
 * @property {number} callback_rate_percent
 * @property {number} payout_total
 * @property {number} gas_reimbursement_total
 * @property {number} score
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} JobRow
 * @property {string} job_id
 * @property {string} customer_id
 * @property {string|null} tech_id
 * @property {string} appliance_label
 * @property {string|null} appliance_brand
 * @property {string} issue_summary
 * @property {string} service_address
 * @property {string} scheduled_start_at
 * @property {string|null} eta_at
 * @property {string|null} eta_window_text
 * @property {string|null} en_route_at
 * @property {string|null} onsite_at
 * @property {string|null} completed_at
 * @property {string|null} canceled_at
 * @property {string|null} return_requested_at
 * @property {string|null} return_scheduled_at
 * @property {DbJobLifecycleStatus} lifecycle_status
 * @property {DbJobDispatchStatus} dispatch_status
 * @property {DbJobPaymentStatus} payment_status
 * @property {DbJobPartsStatus} parts_status
 * @property {DbCommunicationStatus} communication_status
 * @property {boolean} customer_updated
 * @property {DbJobPriority} priority
 * @property {number|null} lateness_minutes
 * @property {string|null} internal_notes
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} InvoiceRow
 * @property {string} invoice_id
 * @property {string} invoice_number
 * @property {string} job_id
 * @property {string|null} servicing_tech_id
 * @property {DbInvoiceType} invoice_type
 * @property {DbInvoicePaymentStatus} payment_status
 * @property {string} issued_on
 * @property {string|null} due_on
 * @property {string|null} paid_at
 * @property {string} currency_code
 * @property {number} total_amount
 * @property {number} collected_amount
 * @property {number} outstanding_balance
 * @property {string|null} processor_reference
 * @property {string|null} payment_failed_at
 * @property {string|null} notes
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CommunicationRow
 * @property {string} communication_id
 * @property {string} customer_id
 * @property {string|null} job_id
 * @property {string|null} invoice_id
 * @property {DbCommunicationChannel} communication_channel
 * @property {DbCommunicationDirection} direction
 * @property {DbCommunicationStatus} communication_status
 * @property {string} preview_text
 * @property {string|null} transcript_text
 * @property {string|null} extracted_event_summary
 * @property {string|null} from_number
 * @property {string|null} to_number
 * @property {string|null} provider_name
 * @property {string|null} provider_message_sid
 * @property {string|null} provider_call_sid
 * @property {string} occurred_at
 * @property {string|null} started_at
 * @property {string|null} ended_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} TechnicianPayoutRow
 * @property {string} payout_id
 * @property {string} tech_id
 * @property {string|null} payout_number
 * @property {string} period_start
 * @property {string} period_end
 * @property {DbPayoutStatus} payout_status
 * @property {number} gross_amount
 * @property {number} gas_reimbursement_amount
 * @property {number} adjustment_amount
 * @property {number} net_amount
 * @property {string|null} note
 * @property {string|null} scheduled_for
 * @property {string|null} paid_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} TechnicianPayoutInvoiceLinkRow
 * @property {string} payout_id
 * @property {string} invoice_id
 * @property {number} allocated_amount
 * @property {string} created_at
 */

/**
 * @typedef {Object} JobTimelineEventRow
 * @property {string} event_id
 * @property {string} job_id
 * @property {DbTimelineActorType} actor_type
 * @property {string} actor_label
 * @property {DbTimelineEventType} event_type
 * @property {string} event_at
 * @property {string} summary
 * @property {string|null} details
 * @property {Record<string, any>} metadata
 * @property {string} created_at
 */

/**
 * @typedef {Object} RevenueSummaryDailyRow
 * @property {string} summary_date
 * @property {number} invoiced_amount
 * @property {number} collected_amount
 * @property {number} outstanding_amount
 */

/** @typedef {Omit<CustomerRow, "customer_id"|"created_at"|"updated_at">} CustomerInsertPayload */
/** @typedef {Partial<CustomerInsertPayload>} CustomerUpdatePayload */
/** @typedef {Omit<TechnicianRow, "tech_id"|"created_at"|"updated_at">} TechnicianInsertPayload */
/** @typedef {Partial<TechnicianInsertPayload>} TechnicianUpdatePayload */
/** @typedef {Omit<JobRow, "job_id"|"created_at"|"updated_at">} JobInsertPayload */
/** @typedef {Partial<Omit<JobInsertPayload, "customer_id">>} JobUpdatePayload */
/** @typedef {Omit<InvoiceRow, "invoice_id"|"created_at"|"updated_at">} InvoiceInsertPayload */
/** @typedef {Partial<Pick<InvoiceRow, "payment_status"|"collected_amount"|"outstanding_balance"|"paid_at"|"payment_failed_at">>} InvoicePaymentUpdatePayload */
/** @typedef {Omit<CommunicationRow, "communication_id"|"created_at"|"updated_at">} CommunicationInsertPayload */
/** @typedef {Omit<JobTimelineEventRow, "event_id"|"created_at">} JobTimelineEventInsertPayload */
/** @typedef {Omit<TechnicianPayoutRow, "payout_id"|"net_amount"|"created_at"|"updated_at">} TechnicianPayoutInsertPayload */
/** @typedef {Omit<TechnicianPayoutInvoiceLinkRow, "created_at">} TechnicianPayoutInvoiceLinkInsertPayload */

export const schemaTypes = {};
