import { getTwilioServerConfig } from "./supabaseAdmin.js";
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
  return `Hey, they're finished there. I need you to invoice ${customerLabel}. We just texted you the invoice. You can look at it now.`;
}

export async function notifyLumiaAboutInvoice(payload = {}) {
  const config = getTwilioServerConfig();
  const invoice = normalizeInvoiceNotificationPayload(payload);
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

  if (dryRun) {
    console.log("[invoice-notifications][dry-run]", {
      invoiceReference: buildInvoiceReference(invoice),
      toConfigured: Boolean(config.assistantOfficePhoneNumber),
      smsBody,
      callMessage,
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
        ? `Assistant invoice notifications partially failed: ${failed.map((result) => result.message).join(" ")}`
        : "Assistant invoice SMS sent and call placed.",
    results,
  };
}
