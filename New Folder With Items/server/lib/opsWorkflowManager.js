import { getServerSupabaseClient, getTwilioServerConfig } from "./supabaseAdmin.js";
import { notifyLumiaAboutInvoice } from "./lumiaInvoiceSms.js";
import { sendOutboundCall, sendOutboundSms } from "./twilioOutboundNotifications.js";

const scheduledWorkflowTasks = new Map();

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(toFiniteNumber(amount));
}

function mapDomainPaymentStatusToDb(paymentStatus) {
  if (paymentStatus === "failed") {
    return "failed";
  }

  if (paymentStatus === "partial") {
    return "partial";
  }

  if (paymentStatus === "labor_paid" || paymentStatus === "parts_paid") {
    return "paid";
  }

  if (paymentStatus === "labor_due" || paymentStatus === "parts_due") {
    return "open";
  }

  return "draft";
}

function buildWorkflowTaskKey(prefix, entityId) {
  return `${prefix}:${entityId}`;
}

function clearScheduledWorkflowTask(taskKey) {
  const existingTask = scheduledWorkflowTasks.get(taskKey);

  if (existingTask) {
    clearTimeout(existingTask.timeoutId);
    scheduledWorkflowTasks.delete(taskKey);
  }
}

function scheduleWorkflowTask(taskKey, runAt, callback) {
  clearScheduledWorkflowTask(taskKey);

  const delayMs = Math.max(runAt.getTime() - Date.now(), 0);
  const timeoutId = setTimeout(async () => {
    scheduledWorkflowTasks.delete(taskKey);

    try {
      await callback();
    } catch (error) {
      console.error("[ops-workflow][scheduled-task]", taskKey, error);
    }
  }, delayMs);

  scheduledWorkflowTasks.set(taskKey, {
    timeoutId,
    runAt: runAt.toISOString(),
  });
}

async function loadJobWorkflowContext(jobId) {
  const client = getServerSupabaseClient();
  const result = await client
    .from("jobs")
    .select(`
      job_id,
      customer_id,
      tech_id,
      appliance_label,
      appliance_brand,
      issue_summary,
      service_address,
      eta_at,
      eta_window_text,
      customer_updated,
      customer:customers!jobs_customer_id_fkey(
        customer_id,
        name,
        primary_phone,
        secondary_phone
      ),
      technician:technicians!jobs_tech_id_fkey(
        tech_id,
        name,
        primary_phone
      )
    `)
    .eq("job_id", jobId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`workflow.jobContext: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error("Workflow job was not found.");
  }

  return result.data;
}

async function loadInvoiceWorkflowContext(invoiceId) {
  const client = getServerSupabaseClient();
  const result = await client
    .from("invoices")
    .select(`
      invoice_id,
      invoice_number,
      job_id,
      invoice_type,
      payment_status,
      total_amount,
      collected_amount,
      outstanding_balance,
      due_on,
      notes,
      job:jobs!invoices_job_id_fkey(
        job_id,
        issue_summary,
        service_address,
        customer:customers!jobs_customer_id_fkey(
          customer_id,
          name,
          primary_phone,
          secondary_phone
        ),
        technician:technicians!jobs_tech_id_fkey(
          tech_id,
          name,
          primary_phone
        )
      )
    `)
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`workflow.invoiceContext: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error("Workflow invoice was not found.");
  }

  return result.data;
}

function buildAssistantAlertMessage(job, leadMinutes) {
  return `Heads up. ${job.customer?.name || "Your customer"} at ${job.service_address || "the service address"} is about ${leadMinutes} minutes from finishing. Prep the final labor invoice.`;
}

function buildCustomerPaidSmsBody(invoice) {
  return `ASAP payment confirmation: invoice ${invoice.invoice_number || invoice.invoice_id} for ${invoice.job?.customer?.name || "your service"} is paid in full. Thank you.`;
}

function buildCustomerPaidCallMessage(invoice) {
  return `Hello, this is ASAP Appliances. Your invoice ${invoice.invoice_number || invoice.invoice_id} is marked paid in full. Thank you for your payment.`;
}

function buildAssistantFollowupMessage(invoice) {
  return `Reminder. Invoice ${invoice.invoice_number || invoice.invoice_id} for ${invoice.job?.customer?.name || "the customer"} still shows ${formatCurrency(invoice.outstanding_balance)} due. Please call and collect payment.`;
}

function buildWorkflowInvoiceNumber(prefix) {
  const timestamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 12);
  return `${prefix}-${timestamp}`;
}

async function sendAssistantAlert({ message, dryRun, labelPrefix }) {
  const config = getTwilioServerConfig();
  const destination = config.assistantOfficePhoneNumber;
  const results = [];

  results.push(
    await sendOutboundSms({
      toNumber: destination,
      body: message,
      dryRun,
      label: `${labelPrefix}-assistant-sms`,
    }),
  );

  results.push(
    await sendOutboundCall({
      toNumber: destination,
      message,
      dryRun,
      label: `${labelPrefix}-assistant-call`,
    }),
  );

  return results;
}

async function sendCustomerPaidConfirmation(invoiceId, dryRun = false) {
  const invoice = await loadInvoiceWorkflowContext(invoiceId);
  const customerPhone =
    toNullableString(invoice.job?.customer?.primary_phone) ||
    toNullableString(invoice.job?.customer?.secondary_phone);

  const smsBody = buildCustomerPaidSmsBody(invoice);
  const callMessage = buildCustomerPaidCallMessage(invoice);
  const results = [];

  results.push(
    await sendOutboundSms({
      toNumber: customerPhone,
      body: smsBody,
      dryRun,
      label: "invoice-paid-customer-sms",
    }),
  );
  results.push(
    await sendOutboundCall({
      toNumber: customerPhone,
      message: callMessage,
      dryRun,
      label: "invoice-paid-customer-call",
    }),
  );

  return {
    ok: results.some((result) => result.ok),
    status: results.some((result) => result.ok) ? 200 : 502,
    dryRun,
    message:
      dryRun
        ? "Dry run prepared customer paid confirmation."
        : "Customer paid confirmation sent.",
    results,
  };
}

async function createWorkflowInvoice(payload = {}, dryRun = false) {
  const client = getServerSupabaseClient();
  const issuedOn = toNullableString(payload.issuedOn) || new Date().toISOString().slice(0, 10);
  const invoiceNumber = toNullableString(payload.invoiceNumber) || buildWorkflowInvoiceNumber("INV");
  const totalAmount = toFiniteNumber(payload.totalAmount);
  const collectedAmount = toFiniteNumber(payload.collectedAmount, 0);
  const outstandingBalance =
    payload.outstandingBalance === undefined
      ? totalAmount - collectedAmount
      : toFiniteNumber(payload.outstandingBalance, totalAmount - collectedAmount);

  if (!payload.jobId) {
    throw new Error("Workflow invoice creation requires jobId.");
  }

  if (totalAmount <= 0) {
    throw new Error("Workflow invoice creation requires totalAmount greater than zero.");
  }

  const insertPayload = {
    invoice_number: invoiceNumber,
    job_id: payload.jobId,
    servicing_tech_id: toNullableString(payload.techId),
    invoice_type: payload.invoiceType || "parts_deposit",
    payment_status: mapDomainPaymentStatusToDb(payload.paymentStatus || "parts_due"),
    issued_on: issuedOn,
    due_on: toNullableString(payload.dueOn) || issuedOn,
    paid_at: null,
    currency_code: "USD",
    total_amount: totalAmount,
    collected_amount: collectedAmount,
    outstanding_balance: outstandingBalance,
    processor_reference: toNullableString(payload.processorReference),
    payment_failed_at: null,
    notes: toNullableString(payload.notes),
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      insertPayload,
      message: "Dry run prepared workflow invoice creation.",
    };
  }

  const result = await client.from("invoices").insert(insertPayload).select("invoice_id").single();

  if (result.error) {
    throw new Error(`workflow.createInvoice: ${result.error.message}`);
  }

  return {
    ok: true,
    dryRun: false,
    invoiceId: result.data.invoice_id,
    invoiceNumber,
    insertPayload,
    message: "Workflow invoice created.",
  };
}

export async function runDispatchWorkflow(payload = {}) {
  const config = getTwilioServerConfig();
  const dryRun = payload.dryRun === true;
  const job = await loadJobWorkflowContext(toNullableString(payload.jobId));
  const etaAt = toNullableString(payload.etaAt) || toNullableString(job.eta_at);
  const etaWindowText = toNullableString(payload.etaWindowText) || toNullableString(job.eta_window_text);
  const customerLeadMinutes = toFiniteNumber(
    payload.customerLeadMinutes,
    config.workflowDispatchLeadMinutes,
  );
  const notifyTechnician = payload.notifyTechnician || {};
  const notifyCustomer = payload.notifyCustomer || {};
  const results = [];
  const scheduling = [];

  if (notifyTechnician.sms || notifyTechnician.call) {
    const immediateResult = await (await import("./twilioOutboundNotifications.js")).notifyDispatchEtaUpdate({
      jobId: job.job_id,
      etaAt,
      etaWindowText,
      notifyTechnician,
      notifyCustomer: { sms: false, call: false },
      dryRun,
    });

    results.push(...(immediateResult.results || []));
  }

  const shouldNotifyCustomer = notifyCustomer.sms || notifyCustomer.call;

  if (shouldNotifyCustomer) {
    const etaDate = etaAt ? new Date(etaAt) : null;
    const hasSchedulableEta = etaDate && !Number.isNaN(etaDate.getTime());
    const runAt = hasSchedulableEta
      ? new Date(etaDate.getTime() - customerLeadMinutes * 60 * 1000)
      : null;

    if (runAt && runAt.getTime() > Date.now()) {
      const taskKey = buildWorkflowTaskKey("dispatch-customer-headsup", job.job_id);

      if (!dryRun) {
        scheduleWorkflowTask(taskKey, runAt, async () => {
          await (await import("./twilioOutboundNotifications.js")).notifyDispatchEtaUpdate({
            jobId: job.job_id,
            etaAt,
            etaWindowText,
            notifyTechnician: { sms: false, call: false },
            notifyCustomer,
            dryRun: false,
          });
        });
      }

      scheduling.push({
        taskKey,
        audience: "customer",
        runAt: runAt.toISOString(),
        leadMinutes: customerLeadMinutes,
        dryRun,
      });

      if (dryRun) {
        const dryRunPreview = await (await import("./twilioOutboundNotifications.js")).notifyDispatchEtaUpdate({
          jobId: job.job_id,
          etaAt,
          etaWindowText,
          notifyTechnician: { sms: false, call: false },
          notifyCustomer,
          dryRun: true,
        });

        results.push(...(dryRunPreview.results || []));
      }
    } else {
      const immediateCustomerResult = await (await import("./twilioOutboundNotifications.js")).notifyDispatchEtaUpdate({
        jobId: job.job_id,
        etaAt,
        etaWindowText,
        notifyTechnician: { sms: false, call: false },
        notifyCustomer,
        dryRun,
      });

      results.push(...(immediateCustomerResult.results || []));
    }
  }

  return {
    ok: results.some((result) => result.ok) || scheduling.length > 0,
    status: results.some((result) => result.ok) || scheduling.length > 0 ? 200 : 502,
    dryRun,
    message:
      scheduling.length > 0
        ? dryRun
          ? "Dry run prepared dispatch workflow notifications, including the one-hour customer heads-up."
          : "Dispatch workflow notifications sent and customer heads-up scheduled."
        : dryRun
          ? "Dry run prepared dispatch workflow notifications."
          : "Dispatch workflow notifications sent.",
    results,
    scheduling,
  };
}

export async function runInvoiceGenerationWorkflow(payload = {}) {
  const dryRun = payload.dryRun === true;
  const job = await loadJobWorkflowContext(toNullableString(payload.jobId));
  const invoiceResult = await createWorkflowInvoice(
    {
      jobId: job.job_id,
      techId: toNullableString(job.tech_id),
      invoiceNumber: toNullableString(payload.invoiceNumber) || buildWorkflowInvoiceNumber("DIAG"),
      invoiceType: payload.invoiceType || "parts_deposit",
      paymentStatus: payload.paymentStatus || "parts_due",
      issuedOn: payload.issuedOn,
      dueOn: payload.dueOn,
      totalAmount: payload.totalAmount,
      collectedAmount: payload.collectedAmount,
      outstandingBalance: payload.outstandingBalance,
      processorReference: payload.processorReference,
      notes: [payload.notes, payload.modelNumber ? `Model: ${payload.modelNumber}` : null, payload.partNumber ? `Part: ${payload.partNumber}` : null]
        .filter(Boolean)
        .join(" | "),
    },
    dryRun,
  );

  const notificationResult = await notifyLumiaAboutInvoice({
    dryRun,
    invoice: dryRun
      ? {
          invoiceNumber: invoiceResult.insertPayload.invoice_number,
          customerName: job.customer?.name || null,
          customerPhone:
            toNullableString(job.customer?.primary_phone) ||
            toNullableString(job.customer?.secondary_phone),
          totalAmount: invoiceResult.insertPayload.total_amount,
          outstandingBalance: invoiceResult.insertPayload.outstanding_balance,
        }
      : {
          invoiceId: invoiceResult.invoiceId,
        },
  });

  return {
    ok: invoiceResult.ok && notificationResult.ok,
    status: invoiceResult.ok && notificationResult.ok ? 200 : 502,
    dryRun,
    message:
      dryRun
        ? "Dry run prepared diagnosis invoice creation and notifications."
        : "Diagnosis invoice created and notifications sent.",
    invoice: invoiceResult,
    notifications: notificationResult,
  };
}

export async function runInvoicePaidWorkflow(payload = {}) {
  const invoiceId = toNullableString(payload.invoiceId);
  const dryRun = payload.dryRun === true;

  if (!invoiceId) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: "Invoice paid workflow requires invoiceId.",
    };
  }

  return sendCustomerPaidConfirmation(invoiceId, dryRun);
}

export async function runFinalWorkWorkflow(payload = {}) {
  const config = getTwilioServerConfig();
  const dryRun = payload.dryRun === true;
  const job = await loadJobWorkflowContext(toNullableString(payload.jobId));
  const laborAmount = toFiniteNumber(payload.laborAmount, config.workflowLaborInvoiceAmount);
  const leadMinutes = toFiniteNumber(payload.leadMinutes, config.workflowFinalAlertLeadMinutes);
  const followupMinutes = toFiniteNumber(
    payload.paymentFollowupMinutes,
    config.workflowPaymentFollowupMinutes,
  );
  const assistantResults = await sendAssistantAlert({
    message: buildAssistantAlertMessage(job, leadMinutes),
    dryRun,
    labelPrefix: "final-work",
  });
  const laborInvoiceWorkflow = await runInvoiceGenerationWorkflow({
    jobId: job.job_id,
    invoiceNumber: toNullableString(payload.invoiceNumber) || buildWorkflowInvoiceNumber("LABOR"),
    invoiceType: "labor",
    paymentStatus: "labor_due",
    totalAmount: laborAmount,
    notes: payload.notes || `Automatic labor invoice created ${leadMinutes} minutes before completion.`,
    dryRun,
  });
  const scheduling = [];

  if (!dryRun && laborInvoiceWorkflow.invoice?.invoiceId) {
    const taskKey = buildWorkflowTaskKey("invoice-payment-followup", laborInvoiceWorkflow.invoice.invoiceId);
    const runAt = new Date(Date.now() + followupMinutes * 60 * 1000);

    scheduleWorkflowTask(taskKey, runAt, async () => {
      const invoice = await loadInvoiceWorkflowContext(laborInvoiceWorkflow.invoice.invoiceId);
      const stillUnpaid = invoice.payment_status !== "paid" && toFiniteNumber(invoice.outstanding_balance) > 0;

      if (!stillUnpaid) {
        return;
      }

      await sendAssistantAlert({
        message: buildAssistantFollowupMessage(invoice),
        dryRun: false,
        labelPrefix: "payment-followup",
      });
    });

    scheduling.push({
      taskKey,
      runAt: runAt.toISOString(),
      followupMinutes,
    });
  } else if (dryRun) {
    scheduling.push({
      taskKey: buildWorkflowTaskKey("invoice-payment-followup", laborInvoiceWorkflow.invoice?.insertPayload?.invoice_number || "dry-run"),
      runAt: new Date(Date.now() + followupMinutes * 60 * 1000).toISOString(),
      followupMinutes,
      dryRun: true,
    });
  }

  return {
    ok:
      assistantResults.some((result) => result.ok) &&
      laborInvoiceWorkflow.ok,
    status:
      assistantResults.some((result) => result.ok) && laborInvoiceWorkflow.ok ? 200 : 502,
    dryRun,
    message:
      dryRun
        ? "Dry run prepared the final-work automation sequence."
        : "Final-work automation ran and payment follow-up was scheduled.",
    assistantResults,
    laborInvoiceWorkflow,
    scheduling,
  };
}
