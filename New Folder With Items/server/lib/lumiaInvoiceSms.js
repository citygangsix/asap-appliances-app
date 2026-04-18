import { getTwilioServerConfig } from "./supabaseAdmin.js";

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

async function sendTwilioSms({ accountSid, authToken, fromNumber, toNumber, body }) {
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: body,
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

  if (!response.ok) {
    const errorMessage =
      responseJson?.message ||
      `Twilio SMS request failed with status ${response.status}.`;

    throw new Error(errorMessage);
  }

  return responseJson;
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

  if (dryRun) {
    console.log("[invoice-sms][dry-run]", {
      invoiceReference: buildInvoiceReference(invoice),
      toConfigured: Boolean(config.lumiaInvoicePhoneNumber),
      body: smsBody,
    });

    return {
      ok: true,
      status: 200,
      dryRun: true,
      smsRequested: false,
      toConfigured: Boolean(config.lumiaInvoicePhoneNumber),
      message: "Dry run prepared Lumia invoice SMS.",
      preview: {
        invoiceReference: buildInvoiceReference(invoice),
        body: smsBody,
      },
    };
  }

  if (!config.lumiaInvoicePhoneNumber) {
    return {
      ok: false,
      status: 412,
      dryRun: false,
      message: "LUMIA_INVOICE_SMS_PHONE_NUMBER is not configured on the server.",
    };
  }

  const twilioResponse = await sendTwilioSms({
    accountSid: config.accountSid,
    authToken: config.authToken,
    fromNumber: config.phoneNumber,
    toNumber: config.lumiaInvoicePhoneNumber,
    body: smsBody,
  });

  return {
    ok: true,
    status: 200,
    dryRun: false,
    smsRequested: true,
    providerMessageSid: twilioResponse?.sid || null,
    message: "Invoice SMS sent to Lumia.",
  };
}
