import crypto from "node:crypto";

function buildValidationPayload(url, params) {
  const sortedKeys = Object.keys(params).sort();
  return sortedKeys.reduce((payload, key) => payload + key + String(params[key] ?? ""), url);
}

export function isValidTwilioSignature({ authToken, signature, url, params }) {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(buildValidationPayload(url, params), "utf8")
    .digest("base64");

  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
