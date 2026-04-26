const FALLBACK_DATE = "2026-04-16";

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * @param {string | null | undefined} value
 */
export function toNullable(value) {
  return value ?? null;
}

/**
 * @param {Record<string, any>} payload
 */
export function stripUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

/**
 * @param {string | null | undefined} isoLike
 * @param {string} [fallback]
 */
export function formatTimeLabelFromIso(isoLike, fallback = "Not set") {
  if (!isoLike) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoLike));
}

/**
 * @param {string | null | undefined} isoLike
 */
export function formatDateOnly(isoLike) {
  if (!isoLike) {
    return "";
  }

  return isoLike.slice(0, 10);
}

/**
 * @param {string | null | undefined} value
 * @param {string} [fallbackDate]
 */
export function withFallbackDate(value, fallbackDate = FALLBACK_DATE) {
  if (!value) {
    return null;
  }

  if (value.includes("T")) {
    return value;
  }

  return `${fallbackDate}T${value}:00`;
}

/**
 * @param {string} date
 * @param {string | null | undefined} timeLabel
 */
export function parseTimeLabelToIso(date, timeLabel) {
  if (!timeLabel) {
    return null;
  }

  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hours !== 12) {
    hours += 12;
  }

  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  return `${date}T${pad(hours)}:${pad(minutes)}:00`;
}

/**
 * @param {string} baseIso
 * @param {number} minutes
 */
export function addMinutes(baseIso, minutes) {
  const date = new Date(baseIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

/**
 * @param {number | null | undefined} value
 */
export function formatCurrencyNumber(value) {
  return Number(value || 0);
}
