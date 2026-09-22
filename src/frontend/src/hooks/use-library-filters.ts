import type { LotView } from "@/lib/backend";
import { useCallback, useMemo } from "react";

/**
 * The shareable view state of the library, mirrored into the page URL.
 *
 * Filter values are reference-data keys (admin-managed), not compile-time
 * enums: a lot kind, status or site the administrator adds is immediately
 * filterable, and one they remove simply stops appearing in the chips.
 */
export interface LibraryFilters {
  /** Free-text term matched against id, hash prefix, seal and working ref. */
  q: string;
  /** Lot-kind reference key, or `all`. */
  type: string;
  /** Status reference key, or `all`. */
  status: string;
  /** Site reference key, or `all`. */
  site: string;
  /** The lot currently expanded in the accordion, or `null`. */
  lot: string | null;
}

export const EMPTY_FILTERS: LibraryFilters = {
  q: "",
  type: "all",
  status: "all",
  site: "all",
  lot: null,
};

/**
 * Read the library view state from the current page URL.
 *
 * The URL is the single source of truth so a filtered view is shareable and
 * survives a refresh. Values are kept as opaque strings and validated against
 * the live reference data by the caller, so a hand-edited link still renders.
 */
export function readFiltersFromUrl(): LibraryFilters {
  if (typeof window === "undefined") return EMPTY_FILTERS;
  const params = new URLSearchParams(window.location.search);
  const lot = params.get("lot");

  return {
    q: params.get("q") ?? "",
    type: params.get("type") ?? "all",
    status: params.get("status") ?? "all",
    site: params.get("site") ?? "all",
    lot: lot?.trim() ? lot.trim() : null,
  };
}

/**
 * Write the library view state back into the page URL without adding a
 * history entry, so filtering never floods the back button.
 */
export function writeFiltersToUrl(filters: LibraryFilters): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.site !== "all") params.set("site", filters.site);
  if (filters.lot) params.set("lot", filters.lot);

  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}

/**
 * The site a lot was extracted at, derived from its id.
 *
 * Ids read `JOA-<SITE>-YYYYMMDD-NNNN`, so the site is the second segment at
 * index 4-6 — the first three characters are always the `JOA` register prefix.
 * The segment is returned as-is; the caller matches it against the live site
 * reference keys rather than a hardcoded list.
 */
export function siteOfLot(lot: LotView): string | null {
  const segment = lot.id.slice(4, 7).toUpperCase();
  return segment.length === 3 ? segment : null;
}

/**
 * Apply the library filters to the register's lots.
 *
 * Text matching is done locally against the already-loaded lots so the grid
 * never flickers while a backend search is in flight; the backend search is
 * used to widen the match set for hash prefixes and seal numbers.
 */
export function filterLots(
  lots: LotView[],
  filters: LibraryFilters,
  matchedIds: Set<string>,
): LotView[] {
  const term = filters.q.trim().toLowerCase();

  return lots.filter((lot) => {
    if (filters.type !== "all" && lot.lotType !== filters.type) return false;
    if (filters.status !== "all" && lot.status !== filters.status) return false;
    if (filters.site !== "all" && siteOfLot(lot) !== filters.site) return false;
    if (!term) return true;

    return (
      matchedIds.has(lot.id) ||
      lot.id.toLowerCase().includes(term) ||
      lot.sealNo.toLowerCase().includes(term) ||
      lot.workingRef.toLowerCase().includes(term) ||
      lot.contentHash.toLowerCase().startsWith(term)
    );
  });
}

/**
 * A small helper for the toolbar: toggle a single filter value, treating a
 * repeat click on the active value as "clear back to all".
 */
export function toggleFilter(current: string, next: string): string {
  return current === next ? "all" : next;
}

/** Stable identity for the expanded lot, used to key the accordion. */
export function useExpandedLot(filters: LibraryFilters) {
  return useMemo(() => filters.lot, [filters.lot]);
}

/** Convenience wrapper so callers do not repeat the URL round-trip. */
export function useFilterWriter() {
  return useCallback((filters: LibraryFilters) => {
    writeFiltersToUrl(filters);
  }, []);
}
