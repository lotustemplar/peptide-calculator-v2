import { LOCAL_CIVIL_DATE_RE } from "./types";

const ISO_INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function normalizeScheduleId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Real Gregorian YYYY-MM-DD with exact UTC round-trip.
 * Regex alone is not enough (2026-99-99 / 2026-02-29 must fail).
 */
export function normalizeLocalCivilDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!LOCAL_CIVIL_DATE_RE.test(trimmed)) {
    return null;
  }
  const [yearText, monthText, dayText] = trimmed.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  const roundTrip = `${String(utc.getUTCFullYear()).padStart(4, "0")}-${String(
    utc.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
  return roundTrip === trimmed ? trimmed : null;
}

/**
 * IANA zone via the runtime Intl API. Fail closed. No DST/travel policy
 * and no rewrite to a different identifier.
 */
export function normalizeIanaTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const zone = value.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date("2026-09-08T15:00:00.000Z"));
    return zone;
  } catch {
    return null;
  }
}

/** ISO-8601 instant with explicit offset or Z. Date-only strings fail. */
export function normalizeIsoInstant(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!ISO_INSTANT_RE.test(trimmed)) {
    return null;
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return trimmed;
}
