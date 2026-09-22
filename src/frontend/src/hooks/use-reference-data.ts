import { createActor } from "@/lib/backend";
import { RefKind } from "@/lib/backend";
import type { RefEntryView } from "@/lib/backend";
import {
  type ReferenceIndex,
  activeEntries,
  emptyReferenceIndex,
  indexReferenceEntries,
  labelFor as labelFromIndex,
  valueFor as valueFromIndex,
} from "@/lib/reference";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export const referenceKeys = {
  all: ["reference-entries"] as const,
  kind: (kind: RefKind) => ["reference-entries", kind] as const,
};

/** Every reference kind, in the order the register groups them. */
const ALL_KINDS: RefKind[] = [
  RefKind.lot_kind,
  RefKind.site,
  RefKind.status,
  RefKind.event_kind,
  RefKind.caption,
  RefKind.form_default,
  RefKind.status_explanation,
];

/** A selectable option derived from a reference entry. */
export interface ReferenceOption {
  value: string;
  label: string;
}

/**
 * The register's admin-managed reference data, grouped by kind.
 *
 * `listAllReferenceEntries` is admin-only, so the public read path is the
 * per-kind `listReferenceEntries`, which returns only active entries. The
 * admin panel reads the full list through `useAllReferenceEntries`.
 *
 * The result carries two helpers so a consumer never has to know the index
 * shape: `labelFor(kind, key)` resolves a stored key to its display name, and
 * `optionsFor(kind)` returns the active entries as selectable options.
 */
export function useReferenceData() {
  const { actor, isFetching } = useActor(createActor);
  const query = useQuery<ReferenceIndex>({
    queryKey: referenceKeys.all,
    queryFn: async () => {
      if (!actor) return emptyReferenceIndex();
      const lists = await Promise.all(
        ALL_KINDS.map((kind) => actor.listReferenceEntries(kind)),
      );
      return indexReferenceEntries(lists.flat());
    },
    enabled: !!actor && !isFetching,
  });

  const index = query.data ?? emptyReferenceIndex();

  const labelFor = useCallback(
    (kind: RefKind | string, key: string): string | null => {
      const match = index[kind as RefKind]?.find((entry) => entry.key === key);
      return match ? match.displayName : null;
    },
    [index],
  );

  const valueFor = useCallback(
    (kind: RefKind | string, key: string): string | null =>
      valueFromIndex(index, kind as RefKind, key),
    [index],
  );

  const optionsFor = useCallback(
    (kind: RefKind | string): ReferenceOption[] =>
      activeEntries(index, kind as RefKind).map((entry) => ({
        value: entry.key,
        label: entry.displayName,
      })),
    [index],
  );

  return useMemo(
    () => ({ ...query, index, labelFor, valueFor, optionsFor }),
    [query, index, labelFor, valueFor, optionsFor],
  );
}

/** Every reference entry, including inactive ones. Admin only. */
export function useAllReferenceEntries(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<RefEntryView[]>({
    queryKey: [...referenceKeys.all, "all"],
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.listAllReferenceEntries();
      return result.__kind__ === "ok" ? result.ok : [];
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

export { labelFromIndex };
