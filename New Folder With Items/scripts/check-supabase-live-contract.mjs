import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(repoRoot, "supabase/migrations");

const requiredTableColumns = {
  customers: [
    "customer_id",
    "name",
    "primary_phone",
    "secondary_phone",
    "email",
    "city",
    "service_area",
    "customer_segment",
    "communication_status",
    "last_contact_at",
    "lifetime_value",
    "notes",
    "sms_opted_out_at",
    "voice_opted_out_at",
    "auto_contact_cooldown_until",
    "created_at",
    "updated_at",
  ],
  technicians: [
    "tech_id",
    "name",
    "primary_phone",
    "email",
    "service_area",
    "service_zip_codes",
    "skills",
    "hire_start_date",
    "availability_notes",
    "availability_days",
    "availability_time_preferences",
    "status_today",
    "jobs_completed_this_week",
    "callback_rate_percent",
    "payout_total",
    "gas_reimbursement_total",
    "score",
    "created_at",
    "updated_at",
  ],
  jobs: [
    "job_id",
    "customer_id",
    "tech_id",
    "appliance_label",
    "appliance_brand",
    "issue_summary",
    "service_address",
    "scheduled_start_at",
    "eta_at",
    "eta_window_text",
    "en_route_at",
    "onsite_at",
    "completed_at",
    "canceled_at",
    "return_requested_at",
    "return_scheduled_at",
    "lifecycle_status",
    "dispatch_status",
    "payment_status",
    "parts_status",
    "communication_status",
    "customer_updated",
    "priority",
    "lateness_minutes",
    "internal_notes",
    "dispatch_confirmation_requested_at",
    "dispatch_confirmation_received_at",
    "dispatch_response_minutes",
    "technician_confirmation_response",
    "payment_collected_before_tech_left",
    "created_at",
    "updated_at",
  ],
  invoices: [
    "invoice_id",
    "invoice_number",
    "job_id",
    "servicing_tech_id",
    "invoice_type",
    "payment_status",
    "issued_on",
    "due_on",
    "paid_at",
    "currency_code",
    "total_amount",
    "collected_amount",
    "outstanding_balance",
    "processor_reference",
    "payment_failed_at",
    "notes",
    "created_at",
    "updated_at",
  ],
  communications: [
    "communication_id",
    "customer_id",
    "job_id",
    "invoice_id",
    "communication_channel",
    "direction",
    "communication_status",
    "preview_text",
    "transcript_text",
    "call_highlights",
    "call_summary_sections",
    "transcription_status",
    "transcription_error",
    "transcribed_at",
    "extracted_event_summary",
    "from_number",
    "to_number",
    "provider_name",
    "provider_message_sid",
    "provider_call_sid",
    "occurred_at",
    "started_at",
    "ended_at",
    "created_at",
    "updated_at",
  ],
  unmatched_inbound_communications: [
    "unmatched_communication_id",
    "communication_channel",
    "direction",
    "communication_status",
    "match_status",
    "resolution_status",
    "from_number",
    "to_number",
    "preview_text",
    "transcript_text",
    "call_highlights",
    "call_summary_sections",
    "transcription_status",
    "transcription_error",
    "transcribed_at",
    "provider_name",
    "provider_message_sid",
    "provider_call_sid",
    "raw_payload",
    "occurred_at",
    "started_at",
    "ended_at",
    "linked_customer_id",
    "linked_job_id",
    "linked_communication_id",
    "resolution_notes",
    "resolved_at",
    "created_at",
    "updated_at",
  ],
  hiring_candidates: [
    "candidate_id",
    "name",
    "primary_phone",
    "email",
    "source",
    "stage",
    "trade",
    "city",
    "service_area",
    "structured_start_date",
    "availability_summary",
    "availability_days",
    "availability_time_preferences",
    "current_job_status",
    "tools_status",
    "vehicle_status",
    "tools_vehicle_summary",
    "payout_expectation_summary",
    "experience_summary",
    "appliance_experience_summary",
    "other_work_experience_summary",
    "next_step",
    "call_highlights",
    "transcript_text",
    "linked_communication_id",
    "provider_call_sid",
    "promoted_tech_id",
    "promoted_at",
    "raw_analysis",
    "last_contact_at",
    "created_at",
    "updated_at",
  ],
  technician_payouts: [
    "payout_id",
    "tech_id",
    "payout_number",
    "period_start",
    "period_end",
    "payout_status",
    "gross_amount",
    "gas_reimbursement_amount",
    "adjustment_amount",
    "net_amount",
    "note",
    "scheduled_for",
    "paid_at",
    "created_at",
    "updated_at",
  ],
  technician_payout_invoice_links: [
    "payout_id",
    "invoice_id",
    "allocated_amount",
    "created_at",
  ],
  twilio_voice_recordings: [
    "recording_id",
    "linked_communication_id",
    "provider_name",
    "provider_account_sid",
    "provider_call_sid",
    "provider_parent_call_sid",
    "provider_recording_sid",
    "recording_status",
    "recording_source",
    "recording_track",
    "recording_channels",
    "recording_duration_seconds",
    "recording_url",
    "transcript_text",
    "call_headline",
    "call_highlights",
    "call_summary_sections",
    "transcription_status",
    "transcription_error",
    "transcribed_at",
    "raw_payload",
    "callback_received_at",
    "created_at",
    "updated_at",
  ],
  outbound_contact_attempts: [
    "attempt_id",
    "customer_id",
    "communication_id",
    "trigger_source",
    "is_automated",
    "attempt_channel",
    "customer_number",
    "provider_call_sid",
    "provider_parent_call_sid",
    "provider_message_sid",
    "outcome",
    "outcome_detail",
    "requested_at",
    "completed_at",
    "cooldown_applied_until",
    "raw_payload",
    "created_at",
    "updated_at",
  ],
  job_timeline_events: [
    "event_id",
    "job_id",
    "actor_type",
    "actor_label",
    "event_type",
    "event_at",
    "summary",
    "details",
    "metadata",
    "created_at",
  ],
};

const requiredJobLifecycleStatuses = [
  "new",
  "scheduled",
  "en_route",
  "onsite",
  "paused",
  "return_scheduled",
  "pending_installation",
  "pending_repair",
  "completed",
  "canceled",
  "declined",
  "diagnostic_paid_declined_repair",
  "closed",
  "no_work_needed",
  "paid_closed",
];

const failures = [];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCreateTableBody(sql, table) {
  const pattern = new RegExp(
    `create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${escapeRegExp(table)}\\s*\\(([\\s\\S]*?)\\n\\);`,
    "i",
  );
  return pattern.exec(sql)?.[1] || "";
}

function findAlterTableBodies(sql, table) {
  const pattern = new RegExp(
    `alter\\s+table\\s+public\\.${escapeRegExp(table)}\\s+([\\s\\S]*?);`,
    "gi",
  );
  return Array.from(sql.matchAll(pattern), (match) => match[1]);
}

function tableHasColumn(sql, table, column) {
  const columnPattern = new RegExp(
    `(^|[\\n,])\\s*(add\\s+column\\s+(if\\s+not\\s+exists\\s+)?)?${escapeRegExp(column)}\\b`,
    "i",
  );
  const createTableBody = findCreateTableBody(sql, table);

  if (columnPattern.test(createTableBody)) {
    return true;
  }

  return findAlterTableBodies(sql, table).some((body) => columnPattern.test(body));
}

function assertTableColumn(sql, table, column) {
  if (!tableHasColumn(sql, table, column)) {
    failures.push(`${table}.${column} is not declared by local migrations`);
  }
}

function assertSourceContains(relativePath, snippet, label) {
  const source = sourceFiles.get(relativePath) || "";

  if (!source.includes(snippet)) {
    failures.push(`${label} missing in ${relativePath}`);
  }
}

const migrationNames = (await readdir(migrationsDir))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();
const migrationSql = (
  await Promise.all(
    migrationNames.map((fileName) => readFile(path.join(migrationsDir, fileName), "utf8")),
  )
).join("\n\n");
const normalizedMigrationSql = migrationSql.toLowerCase();

const sourceFiles = new Map(
  await Promise.all(
    [
      "src/lib/config/dataSource.js",
      "src/lib/repositories/supabaseOperationsRepository.js",
      "src/integrations/supabase/client.js",
      "server/lib/hiringCandidates.js",
    ].map(async (relativePath) => [
      relativePath,
      await readFile(path.join(repoRoot, relativePath), "utf8"),
    ]),
  ),
);

for (const [table, columns] of Object.entries(requiredTableColumns)) {
  for (const column of columns) {
    assertTableColumn(normalizedMigrationSql, table, column);
  }
}

for (const status of requiredJobLifecycleStatuses) {
  if (!normalizedMigrationSql.includes(`'${status}'`)) {
    failures.push(`job_lifecycle_status enum value '${status}' is not declared by local migrations`);
  }
}

assertSourceContains(
  "src/lib/config/dataSource.js",
  "supabase_strict",
  "strict Supabase live mode",
);
assertSourceContains(
  "src/lib/config/dataSource.js",
  "VITE_SUPABASE_ALLOW_MOCK_FALLBACK",
  "explicit Supabase mock fallback flag",
);
assertSourceContains(
  "src/lib/repositories/supabaseOperationsRepository.js",
  "isSupabaseMockFallbackAllowed",
  "read fallback guard",
);
assertSourceContains(
  "src/integrations/supabase/client.js",
  "missing_credentials_strict",
  "strict missing-credentials status",
);

if ((sourceFiles.get("server/lib/hiringCandidates.js") || "").includes("stripLegacyHiringCandidateDetailColumns")) {
  failures.push("manual hiring-candidate writes still call stripLegacyHiringCandidateDetailColumns");
}

if (failures.length > 0) {
  console.error("Supabase live contract check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Supabase live contract check passed.");
console.log(`Verified ${Object.keys(requiredTableColumns).length} CRM tables across ${migrationNames.length} migrations.`);
console.log(`Verified ${requiredJobLifecycleStatuses.length} job lifecycle statuses.`);
