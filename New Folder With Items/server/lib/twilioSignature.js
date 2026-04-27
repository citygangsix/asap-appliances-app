function buildValidationPayload(url, params) {
  const sortedKeys = Object.keys(params).sort();
  return sortedKeys.reduce((payload, key) => payload + key + String(params[key] ?? ""), url);
}

function encodeUtf8(value) {
  return new TextEncoder().encode(String(value));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

async function hmacSha1Base64(secret, value) {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encodeUtf8(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, encodeUtf8(value));
  return bytesToBase64(new Uint8Array(signature));
}

function timingSafeEqualString(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function isValidTwilioSignature({ authToken, signature, url, params }) {
  if (!signature) {
    return false;
  }

  const expectedSignature = await hmacSha1Base64(authToken, buildValidationPayload(url, params));
  return timingSafeEqualString(signature, expectedSignature);
}
