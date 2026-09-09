export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function firstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const value = readString(candidate);
    if (value) {
      return value;
    }
  }
  return null;
}

export function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function firstFiniteNumber(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const value = readFiniteNumber(candidate);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function firstPositiveNumber(...candidates: unknown[]): number | null {
  const value = firstFiniteNumber(...candidates);
  return value !== null && value > 0 ? value : null;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function pickUnknown(
  record: Record<string, unknown>,
  knownKeys: readonly string[]
): Record<string, unknown> {
  const known = new Set(knownKeys);
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!known.has(key)) {
      extra[key] = value;
    }
  }
  return extra;
}

export function mergePassthrough<T extends Record<string, unknown>>(
  base: T,
  extra: Record<string, unknown>
): T {
  return { ...extra, ...base };
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
