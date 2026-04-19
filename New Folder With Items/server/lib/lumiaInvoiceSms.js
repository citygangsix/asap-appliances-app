import { getServerSupabaseClient, getTwilioServerConfig } from "./supabaseAdmin.js";
import { sendOutboundCall, sendOutboundSms } from "./twilioOutboundNotifications.js";

function toNullableString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function looksLikeUrl(value) {
  try {
    if (!value) {
      return false;
    }

    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(toFiniteNumber(amount));
}

function normalizeInvoiceNotificationPayload(payload = {}) {
  const invoice = payload.invoice || {};

  return {
    invoiceId: toNullableString(invoice.invoiceId),
    invoiceNumber: toNullableString(invoice.invoiceNumber),
    customerName: toNullableString(invoice.customerName || invoice.customer?.name),
    customerPhone:
      toNullableString(invoice.customerPhone) ||
      toNullableString(invoice.customer?.primaryPhone) ||
      toNullableString(invoice.customer?.secondaryPhone),
    totalAmount: toFiniteNumber(invoice.totalAmount),
    outstandingBalance: toFiniteNumber(invoice.outstandingBalance, toFiniteNumber(invoice.totalAmount)),
    invoiceUrl: looksLikeUrl(invoice.invoiceUrl) ? invoice.invoiceUrl : null,
  };
}

function buildInvoiceReference(invoice) {
  return invoice.invoiceNumber || invoice.invoiceId || "invoice";
}

export function buildLumiaInvoiceSmsBody(invoice) {
  const customerLabel = invoice.customerName || "customer";
  const invoiceReference = buildInvoiceReference(invoice);

  if (invoice.invoiceUrl) {
    return `ASAP invoice ${invoiceReference} for ${customerLabel} is ready: ${invoice.invoiceUrl}`;
  }

  return `ASAP invoice ${invoiceReference} for ${customerLabel}. Total ${formatCurrency(invoice.totalAmount)}. Amount due ${formatCurrency(invoice.outstandingBalance)}.`;
}

export function buildLumiaInvoiceCallMessage(invoice) {
  const customerLabel = invoice.customerName || "this customer";
  return `They're finished there. Invoice sent to you and ${customerLabel}. You can look at it now.`;
}

function buildCustomerInvoiceSmsBody(invoice) {
  const invoiceReference = buildInvoiceReference(invoice);

  if (invoice.invoiceUrl) {
    return `ASAP Appliances sent invoice ${invoiceReference}. You can view it here: ${invoice.invoiceUrl}`;
  }

  return `ASAP Appliances invoice ${invoiceReference}. Total ${formatCurrency(invoice.totalAmount)}. Amount due ${formatCurrency(invoice.outstandingBalance)}.`;
}

function buildCustomerInvoiceCallMessage(invoice) {
  return `Hello, this is ASAP Appliances. We just sent your invoice ${buildInvoiceReference(invoice)} by text message. Please review it when you have a moment.`;
}

async function loadInvoiceNotificationContext(invoiceId) {
  const client = getServerSupabaseClient();
  const result = await client
    .from("invoices")
    .select(`
      invoice_id,
      invoice_number,
      total_amount,
      outstanding_balance,
      job:jobs!invoices_job_id_fkey(
        customer:customers!jobs_customer_id_fkey(
          name,
          primary_phone,
          secondary_phone
        )
      )
    `)
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (result.error) {
    throw new Error(`invoice.notificationContext: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error("Invoice notification context was not found.");
  }

  return {
    invoiceId: result.data.invoice_id,
    invoiceNumber: result.data.invoice_number,
    customerName: toNullableString(result.data.job?.customer?.name),
    customerPhone:
      toNullableString(result.data.job?.customer?.primary_phone) ||
      toNullableString(result.data.job?.customer?.secondary_phone),
    totalAmount: toFiniteNumber(result.data.total_amount),
    outstandingBalance: toFiniteNumber(result.data.outstanding_balance),
    invoiceUrl: null,
  };
}

async function resolveInvoiceNotificationPayload(payload) {
  const invoice = normalizeInvoiceNotificationPayload(payload);

  if (
    invoice.invoiceId &&
    (!invoice.customerName || !invoice.customerPhone || !invoice.totalAmount)
  ) {
    const hydratedInvoice = await loadInvoiceNotificationContext(invoice.invoiceId);

    return {
      ...hydratedInvoice,
      invoiceUrl: invoice.invoiceUrl || hydratedInvoice.invoiceUrl,
    };
  }

  return invoice;
}

export async function notifyLumiaAboutInvoice(payload = {}) {
  const config = getTwilioServerConfig();
  const invoice = await resolveInvoiceNotificationPayload(payload);
  const dryRun = payload.dryRun === true;

  if (!invoice.invoiceId && !invoice.invoiceNumber) {
    return {
      ok: false,
      status: 400,
      dryRun,
      message: "Invoice SMS payload must include invoiceId or invoiceNumber.",
    };
  }

  const smsBody = buildLumiaInvoiceSmsBody(invoice);
  const callMessage = buildLumiaInvoiceCallMessage(invoice);
  const customerSmsBody = buildCustomerInvoiceSmsBody(invoice);
  const customerCallMessage = buildCustomerInvoiceCallMessage(invoice);

  if (dryRun) {
    console.log("[invoice-notifications][dry-run]", {
      invoiceReference: buildInvoiceReference(invoice),
      toConfigured: Boolean(config.assistantOfficePhoneNumber),
      smsBody,
      callMessage,
      customerPhone: invoice.customerPhone,
      customerSmsBody,
      customerCallMessage,
    });

    return {
      ok: true,
      status: 200,
      dryRun: true,
      smsRequested: false,
      callRequested: false,
      toConfigured: Boolean(config.assistantOfficePhoneNumber),
      message: "Dry run prepared assistant invoice notifications.",
      preview: {
        invoiceReference: buildInvoiceReference(invoice),
        smsBody,
        callMessage,
        customerPhone: invoice.customerPhone,
        customerSmsBody,
        customerCallMessage,
      },
    };
  }

  if (!config.assistantOfficePhoneNumber) {
    return {
      ok: false,
      status: 412,
      dryRun: false,
      message: "ASSISTANT_OFFICE_PHONE_NUMBER or LUMIA_INVOICE_SMS_PHONE_NUMBER must be configured on the server.",
    };
  }

  const results = [];

  try {
    results.push(
      await sendOutboundSms({
        toNumber: config.assistantOfficePhoneNumber,
        body: smsBody,
        dryRun: false,
        label: "assistant-invoice-sms",
      }),
    );
  } catch (error) {
    results.push({
      ok: false,
      channel: "sms",
      label: "assistant-invoice-sms",
      dryRun: false,
      skipped: false,
      message: error.message,
    });
  }

  try {
    results.push(
      await sendOutboundCall({
        toNumber: config.assistantOfficePhoneNumber,
        message: callMessage,
        dryRun: false,
        label: "assistant-invoice-call",
      }),
    );
  } catch (error) {
    results.push({
      ok: false,
      channel: "call",
      label: "assistant-invoice-call",
      dryRun: false,
      skipped: false,
      message: error.message,
    });
  }

  if (invoice.customerPhone) {
    try {
      results.push(
        await sendOutboundSms({
          toNumber: invoice.customerPhone,
          body: customerSmsBody,
          dryRun: false,
          label: "customer-invoice-sms",
        }),
      );
    } catch (error) {
      results.push({
        ok: false,
        channel: "sms",
        label: "customer-invoice-sms",
        dryRun: false,
        skipped: false,
        message: error.message,
      });
    }

    try {
      results.push(
        await sendOutboundCall({
          toNumber: invoice.customerPhone,
          message: customerCallMessage,
          dryRun: false,
          label: "customer-invoice-call",
        }),
      );
    } catch (error) {
      results.push({
        ok: false,
        channel: "call",
        label: "customer-invoice-call",
        dryRun: false,
        skipped: false,
        message: error.message,
      });
    }
  }

  const succeeded = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);

  return {
    ok: succeeded.length > 0,
    status: succeeded.length > 0 ? 200 : 502,
    dryRun: false,
    smsRequested: results.some((result) => result.channel === "sms" && result.ok),
    callRequested: results.some((result) => result.channel === "call" && result.ok),
    providerMessageSid:
      results.find((result) => result.channel === "sms" && result.ok)?.providerMessageSid || null,
    providerCallSid:
      results.find((result) => result.channel === "call" && result.ok)?.providerCallSid || null,
    message:
      failed.length > 0
        ? `Invoice notifications partially failed: ${failed.map((result) => result.message).join(" ")}`
        : "Assistant and customer invoice notifications sent.",
    results,
  };
}
