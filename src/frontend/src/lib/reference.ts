import { RefKind } from "@/lib/backend";
import type { RefEntryView } from "@/lib/backend";

/**
 * The register's admin-managed reference data.
 *
 * Every list the register offers — item kinds, sites, statuses, event kinds,
 * captions and form defaults — is stored in the canister and edited from the
 * admin panel. The frontend never hardcodes these lists; it reads them through
 * `useReferenceData` and falls back to the built-in defaults only while the
 * register is unreachable.
 */

/** The reference kinds the admin panel groups and edits, in ledger order. */
export const REF_KINDS: RefKind[] = [
  RefKind.lot_kind,
  RefKind.site,
  RefKind.status,
  RefKind.event_kind,
  RefKind.caption,
  RefKind.form_default,
  RefKind.status_explanation,
  RefKind.enquiry_destination,
];

/** Human-readable heading for each reference kind. */
export const REF_KIND_LABEL: Record<RefKind, string> = {
  [RefKind.lot_kind]: "Item kinds",
  [RefKind.site]: "Mining Sites",
  [RefKind.status]: "Statuses",
  [RefKind.event_kind]: "Event kinds",
  [RefKind.caption]: "Captions",
  [RefKind.form_default]: "Form defaults",
  [RefKind.status_explanation]: "Status explanations",
  [RefKind.enquiry_destination]: "Enquiry destination",
};

/** One-line explanation of what each reference kind drives. */
export const REF_KIND_HINT: Record<RefKind, string> = {
  [RefKind.lot_kind]: "The item kinds an officer can register.",
  [RefKind.site]:
    "Extraction and workshop mining sites, and the id prefix each one uses.",
  [RefKind.status]: "The register statuses a lot can carry.",
  [RefKind.event_kind]:
    "The Precious Material Origin History events an officer can append.",
  [RefKind.caption]: "The photo captions the register asks for.",
  [RefKind.form_default]: "Prefilled values for the register-lot form.",
  [RefKind.status_explanation]:
    "The explanation shown for each status in the home page's status information section.",
  [RefKind.enquiry_destination]:
    "The optional email address that receives purchase enquiries.",
};

/** A reference entry keyed by its kind, ready for lookup. */
export type ReferenceIndex = Record<RefKind, RefEntryView[]>;

/** An empty index, so a caller always has a defined list per kind. */
export function emptyReferenceIndex(): ReferenceIndex {
  return {
    [RefKind.lot_kind]: [],
    [RefKind.site]: [],
    [RefKind.status]: [],
    [RefKind.event_kind]: [],
    [RefKind.caption]: [],
    [RefKind.form_default]: [],
    [RefKind.status_explanation]: [],
    [RefKind.enquiry_destination]: [],
  };
}

/** Group a flat list of entries by kind, preserving the register's order. */
export function indexReferenceEntries(entries: RefEntryView[]): ReferenceIndex {
  const index = emptyReferenceIndex();
  for (const entry of entries) {
    index[entry.kind] = [...index[entry.kind], entry];
  }
  for (const kind of REF_KINDS) {
    index[kind] = sortEntries(index[kind]);
  }
  return index;
}

/** Sort by the admin-set order, then by display name as a stable tiebreak. */
export function sortEntries(entries: RefEntryView[]): RefEntryView[] {
  return [...entries].sort((a, b) => {
    const order = Number(a.sortOrder) - Number(b.sortOrder);
    if (order !== 0) return order;
    return a.displayName.localeCompare(b.displayName);
  });
}

/** The active entries of one kind, in order. */
export function activeEntries(
  index: ReferenceIndex,
  kind: RefKind,
): RefEntryView[] {
  return index[kind].filter((entry) => entry.active);
}

/** The display name for a stored key, falling back to a humanized token. */
export function labelFor(
  index: ReferenceIndex,
  kind: RefKind,
  key: string,
): string {
  const match = index[kind].find((entry) => entry.key === key);
  if (match) return match.displayName;
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/** The stored value for a key, or `null` when the register has no entry. */
export function valueFor(
  index: ReferenceIndex,
  kind: RefKind,
  key: string,
): string | null {
  const match = index[kind].find((entry) => entry.key === key);
  return match ? match.value : null;
}

/** The first active entry of a kind, used to seed a form default. */
export function firstActive(
  index: ReferenceIndex,
  kind: RefKind,
): RefEntryView | null {
  return activeEntries(index, kind)[0] ?? null;
}

/** The next free sort order for a kind, so a new entry lands at the end. */
export function nextSortOrder(index: ReferenceIndex, kind: RefKind): bigint {
  const orders = index[kind].map((entry) => Number(entry.sortOrder));
  const max = orders.length > 0 ? Math.max(...orders) : 0;
  return BigInt(max + 1);
}

/** Turn a backend reference error into operator-facing copy. */
export function describeReferenceError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "notAuthorized":
      return "Only an administrator can change reference data.";
    case "notAuthenticated":
      return "Sign in with Internet Identity to change reference data.";
    case "invalidInput":
      return String(error.invalidInput);
    case "duplicateEntry":
      return `An entry with the key “${String(error.duplicateEntry)}” already exists.`;
    case "unknownEntry":
      return "That entry is no longer in the register.";
    case "unknownDocument":
      return "That document is no longer in the register.";
    default:
      return "The register rejected this change.";
  }
}
