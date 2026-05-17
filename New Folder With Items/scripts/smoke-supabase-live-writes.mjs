import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const projectRef = process.env.SUPABASE_PROJECT_REF || "nexkymqahpkvzzlvivfi";
const defaultSupabaseUrl = `https://${projectRef}.supabase.co`;

function maybeReadCliKeys() {
  try {
    const raw = execFileSync(
      "supabase",
      ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function findKey(keys, names) {
  for (const entry of keys) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const name = String(entry.name || entry.key || "").toLowerCase();

    if (names.some((candidate) => name.includes(candidate))) {
      return entry.api_key || entry.key_value || entry.value || entry.secret || null;
    }
  }

  return null;
}

const cliKeys = maybeReadCliKeys();
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || defaultSupabaseUrl;
const envServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const cliServiceRoleKey = findKey(cliKeys, ["service_role", "service role", "service"]);
const serviceRoleKey = envServiceRoleKey || cliServiceRoleKey;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
}

if (!serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE; Supabase CLI lookup also failed.",
  );
}

const apiBaseUrl =
  process.env.VITE_LOCAL_OPERATIONS_SERVER_URL ||
  process.env.ASAP_HOSTED_API_URL ||
  `${supabaseUrl.replace(/\/$/u, "")}/functions/v1/asap-crm`;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const runId = `codex-live-${new Date().toISOString().replace(/[-:.TZ]/gu, "")}-${randomUUID().slice(0, 8)}`;
const marker = `Codex live Supabase smoke ${runId}`;
const phoneSuffix = String(Math.floor(1000000 + Math.random() * 8999999));
const customerPhone = `+1561${phoneSuffix}`;
const candidatePhone = `+1954${phoneSuffix}`;
const now = new Date();
const nowIso = now.toISOString();
const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const todayDate = nowIso.slice(0, 10);

const created = {
  customerId: null,
  jobId: null,
  invoiceId: null,
  communicationIds: [],
  outboundAttemptId: null,
  timelineEventId: null,
  candidateId: null,
};

const evidence = {
  runId,
  supabaseUrl,
  apiBaseUrl,
  credentialSource: envServiceRoleKey ? "env" : "supabase-cli",
  writes: {},
  reads: {},
  cleanup: {},
};

async function checkedSingle(label, query) {
  const { data, error } = await query;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data;
}

async function checkedMany(label, query) {
  const { data, error } = await query;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  return data || [];
}

async function deleteWhere(table, column, values) {
  const filteredValues = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);

  if (filteredValues.length === 0) {
    return 0;
  }

  const { error, count } = await supabase.from(table).delete({ count: "exact" }).in(column, filteredValues);

  if (error) {
    throw new Error(`cleanup ${table}.${column}: ${error.message}`);
  }

  return count ?? 0;
}

async function verifyDeleted(table, column, values) {
  const filteredValues = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);

  if (filteredValues.length === 0) {
    return true;
  }

  const { data, error } = await supabase.from(table).select(column).in(column, filteredValues);

  if (error) {
    throw new Error(`verify cleanup ${table}.${column}: ${error.message}`);
  }

  return (data || []).length === 0;
}

async function runSmoke() {
  const serviceResponse = await fetch(`${apiBaseUrl}/api/service-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "codex-live-supabase-smoke",
    },
    body: JSON.stringify({
      name: `Codex Live Customer ${runId}`,
      phone: customerPhone,
      serviceAddress: "100 Codex Test Ave, West Palm Beach, FL 33401",
      applianceType: "Washer",
      issueSummary: `${marker}: hosted service request write verification.`,
      preferredTiming: "QA window",
      smsConsent: true,
    }),
  });
  const servicePayload = await serviceResponse.json().catch(() => ({}));

  if (!serviceResponse.ok || !servicePayload.ok || !servicePayload.customerId || !servicePayload.jobId) {
    throw new Error(
      `service request write failed: HTTP ${serviceResponse.status} ${JSON.stringify(servicePayload)}`,
    );
  }

  created.customerId = servicePayload.customerId;
  created.jobId = servicePayload.jobId;
  evidence.writes.serviceRequest = {
    httpStatus: serviceResponse.status,
    customerId: created.customerId,
    jobId: created.jobId,
  };

  const customer = await checkedSingle(
    "read customer",
    supabase.from("customers").select("*").eq("customer_id", created.customerId).single(),
  );
  const job = await checkedSingle(
    "read job",
    supabase.from("jobs").select("*").eq("job_id", created.jobId).single(),
  );
  evidence.reads.customer = {
    found: customer.primary_phone === customerPhone,
    segment: customer.customer_segment,
  };
  evidence.reads.job = {
    found: job.customer_id === created.customerId,
    lifecycleStatus: job.lifecycle_status,
    dispatchStatus: job.dispatch_status,
  };

  const invoice = await checkedSingle(
    "insert invoice",
    supabase
      .from("invoices")
      .insert({
        invoice_number: `QA-${Date.now()}-${runId.slice(-4)}`,
        job_id: created.jobId,
        invoice_type: "labor",
        payment_status: "open",
        issued_on: todayDate,
        due_on: tomorrowDate,
        total_amount: 1,
        collected_amount: 0,
        outstanding_balance: 1,
        notes: marker,
      })
      .select("*")
      .single(),
  );
  created.invoiceId = invoice.invoice_id;
  evidence.writes.invoice = { invoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number };

  const communications = await checkedMany(
    "insert communications",
    supabase
      .from("communications")
      .insert([
        {
          customer_id: created.customerId,
          job_id: created.jobId,
          invoice_id: created.invoiceId,
          communication_channel: "call",
          direction: "outbound",
          communication_status: "clear",
          preview_text: `${marker}: call log`,
          transcript_text: `${marker}: call transcript`,
          extracted_event_summary: "Live smoke call log",
          from_number: "+15615550100",
          to_number: customerPhone,
          provider_name: "codex_live_smoke",
          provider_call_sid: `codex-call-${runId}`,
          occurred_at: nowIso,
          started_at: nowIso,
          ended_at: new Date(now.getTime() + 60 * 1000).toISOString(),
        },
        {
          customer_id: created.customerId,
          job_id: created.jobId,
          invoice_id: created.invoiceId,
          communication_channel: "text",
          direction: "outbound",
          communication_status: "clear",
          preview_text: `${marker}: SMS log`,
          transcript_text: `${marker}: SMS transcript`,
          extracted_event_summary: "Live smoke SMS log",
          from_number: "+15615550100",
          to_number: customerPhone,
          provider_name: "codex_live_smoke",
          provider_message_sid: `codex-msg-${runId}`,
          occurred_at: nowIso,
        },
      ])
      .select("*"),
  );
  created.communicationIds = communications.map((row) => row.communication_id);
  const callCommunication = communications.find((row) => row.communication_channel === "call");
  const smsCommunication = communications.find((row) => row.communication_channel === "text");
  evidence.writes.communications = {
    count: communications.length,
    callId: callCommunication?.communication_id || null,
    smsId: smsCommunication?.communication_id || null,
  };

  const outboundAttempt = await checkedSingle(
    "insert outbound contact attempt",
    supabase
      .from("outbound_contact_attempts")
      .insert({
        customer_id: created.customerId,
        communication_id: smsCommunication?.communication_id || null,
        trigger_source: "codex_live_smoke",
        is_automated: false,
        attempt_channel: "text",
        customer_number: customerPhone,
        provider_message_sid: `codex-attempt-msg-${runId}`,
        outcome: "created",
        outcome_detail: marker,
        requested_at: nowIso,
        completed_at: nowIso,
        raw_payload: { runId, marker },
      })
      .select("*")
      .single(),
  );
  created.outboundAttemptId = outboundAttempt.attempt_id;
  evidence.writes.outboundContactAttempt = { attemptId: outboundAttempt.attempt_id };

  const timeline = await checkedSingle(
    "insert timeline event",
    supabase
      .from("job_timeline_events")
      .insert({
        job_id: created.jobId,
        actor_type: "system",
        actor_label: "Codex Live Smoke",
        event_type: "note_added",
        event_at: nowIso,
        summary: marker,
        metadata: { runId, marker },
      })
      .select("*")
      .single(),
  );
  created.timelineEventId = timeline.event_id;
  evidence.writes.jobTimelineEvent = { eventId: timeline.event_id };

  const candidate = await checkedSingle(
    "insert hiring candidate",
    supabase
      .from("hiring_candidates")
      .insert({
        name: `Codex Live Candidate ${runId}`,
        primary_phone: candidatePhone,
        email: `codex+${runId}@example.test`,
        source: "codex_live_smoke",
        stage: "contacted",
        trade: "Appliance Repair",
        city: "West Palm Beach",
        service_area: "South Florida",
        availability_summary: "Temporary smoke-test candidate; delete after verification.",
        payout_expectation_summary: "$0 QA smoke",
        experience_summary: marker,
        next_step: "cleanup",
        call_highlights: marker,
        transcript_text: marker,
        linked_communication_id: callCommunication?.communication_id || null,
        provider_call_sid: `codex-candidate-call-${runId}`,
        raw_analysis: { runId, marker },
        last_contact_at: nowIso,
        current_job_status: "qa smoke",
        tools_status: "unclear",
        vehicle_status: "unclear",
        tools_vehicle_summary: marker,
        appliance_experience_summary: marker,
        other_work_experience_summary: marker,
      })
      .select("*")
      .single(),
  );
  created.candidateId = candidate.candidate_id;
  evidence.writes.hiringCandidate = { candidateId: candidate.candidate_id };

  const readBack = await Promise.all([
    checkedSingle(
      "read invoice",
      supabase.from("invoices").select("invoice_id,job_id,outstanding_balance").eq("invoice_id", created.invoiceId).single(),
    ),
    checkedMany(
      "read communications",
      supabase.from("communications").select("communication_id,communication_channel").in("communication_id", created.communicationIds),
    ),
    checkedSingle(
      "read outbound contact attempt",
      supabase
        .from("outbound_contact_attempts")
        .select("attempt_id,customer_id,communication_id,attempt_channel")
        .eq("attempt_id", created.outboundAttemptId)
        .single(),
    ),
    checkedSingle(
      "read timeline",
      supabase.from("job_timeline_events").select("event_id,job_id,event_type").eq("event_id", created.timelineEventId).single(),
    ),
    checkedSingle(
      "read hiring candidate",
      supabase.from("hiring_candidates").select("candidate_id,primary_phone,stage").eq("candidate_id", created.candidateId).single(),
    ),
  ]);

  evidence.reads.invoice = {
    found: readBack[0].invoice_id === created.invoiceId,
    jobLinked: readBack[0].job_id === created.jobId,
  };
  evidence.reads.communications = {
    foundCount: readBack[1].length,
    channels: readBack[1].map((row) => row.communication_channel).sort(),
  };
  evidence.reads.outboundContactAttempt = {
    found: readBack[2].attempt_id === created.outboundAttemptId,
    channel: readBack[2].attempt_channel,
  };
  evidence.reads.jobTimelineEvent = {
    found: readBack[3].event_id === created.timelineEventId,
    eventType: readBack[3].event_type,
  };
  evidence.reads.hiringCandidate = {
    found: readBack[4].candidate_id === created.candidateId,
    stage: readBack[4].stage,
  };
}

async function cleanup() {
  const deleted = {};
  deleted.outboundContactAttempts = await deleteWhere(
    "outbound_contact_attempts",
    "attempt_id",
    created.outboundAttemptId,
  );
  deleted.hiringCandidates = await deleteWhere("hiring_candidates", "candidate_id", created.candidateId);
  deleted.jobTimelineEvents = await deleteWhere("job_timeline_events", "event_id", created.timelineEventId);
  deleted.communications = await deleteWhere("communications", "communication_id", created.communicationIds);
  deleted.invoices = await deleteWhere("invoices", "invoice_id", created.invoiceId);
  deleted.jobs = await deleteWhere("jobs", "job_id", created.jobId);
  deleted.customers = await deleteWhere("customers", "customer_id", created.customerId);

  const verified = {
    outboundContactAttempts: await verifyDeleted(
      "outbound_contact_attempts",
      "attempt_id",
      created.outboundAttemptId,
    ),
    hiringCandidates: await verifyDeleted("hiring_candidates", "candidate_id", created.candidateId),
    jobTimelineEvents: await verifyDeleted("job_timeline_events", "event_id", created.timelineEventId),
    communications: await verifyDeleted("communications", "communication_id", created.communicationIds),
    invoices: await verifyDeleted("invoices", "invoice_id", created.invoiceId),
    jobs: await verifyDeleted("jobs", "job_id", created.jobId),
    customers: await verifyDeleted("customers", "customer_id", created.customerId),
  };

  evidence.cleanup = {
    deleted,
    verified,
    allDeleted: Object.values(verified).every(Boolean),
  };
}

let failed = null;

try {
  await runSmoke();
} catch (error) {
  failed = error;
  evidence.error = error instanceof Error ? error.message : String(error);
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    evidence.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);

    if (!failed) {
      failed = cleanupError;
    }
  }
}

console.log(JSON.stringify(evidence, null, 2));

if (failed) {
  process.exitCode = 1;
}
