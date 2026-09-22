import type { Timestamp } from "@/lib/backend";

/** Motoko `Time.now()` values are nanosecond bigints. */
const NANOS_PER_MILLI = 1_000_000n;

/**
 * Convert a backend nanosecond timestamp into a `Date`.
 * Returns `null` for values that cannot be represented as a valid date.
 */
export function timestampToDate(timestamp: Timestamp): Date | null {
  const date = new Date(Number(timestamp / NANOS_PER_MILLI));
  return Number.isNaN(date.getTime()) ? null : date;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Ledger-style UTC stamp, e.g. `14 Mar 2026, 09:41`. */
export function formatTimestamp(timestamp: Timestamp): string {
  const date = timestampToDate(timestamp);
  return date ? DATE_TIME_FORMAT.format(date) : "—";
}

/** Ledger-style UTC date, e.g. `14 Mar 2026`. */
export function formatDate(timestamp: Timestamp): string {
  const date = timestampToDate(timestamp);
  return date ? DATE_FORMAT.format(date) : "—";
}

/** `2026-03-14` in UTC — the shape `suggestLotId` expects. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Shorten a 64-character content hash to `a1b2c3d4…9f8e7d6c`. */
export function shortenHash(hash: string, lead = 8, tail = 8): string {
  if (hash.length <= lead + tail + 1) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

/** Shorten a principal to `abcd1-2efgh…wxyz2-34567`. */
export function shortenPrincipal(
  principal: string,
  lead = 5,
  tail = 5,
): string {
  if (principal.length <= lead + tail + 1) return principal;
  return `${principal.slice(0, lead)}…${principal.slice(-tail)}`;
}

/** Group a numeric string with thin separators, e.g. `12 480`. */
export function formatCount(value: bigint | number): string {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-GB").format(numeric);
}

/** Gram weights arrive as strings; render them with a unit and no float drift. */
export function formatGrams(grams: string): string {
  const trimmed = grams.trim();
  if (!trimmed) return "—";
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return `${trimmed} g`;
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(numeric)} g`;
}

/** Turn a snake_case enum value into a readable label. */
export function humanizeToken(token: string): string {
  return token
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** `2026-03-14` → `14 Mar 2026`. */
export function formatIsoDay(day: string): string {
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? day : DATE_FORMAT.format(parsed);
}
