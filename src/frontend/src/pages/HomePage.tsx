import { EmptyState } from "@/components/library/EmptyState";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { RegisterGraph } from "@/components/library/RegisterGraph";
import { RegisterStats } from "@/components/library/RegisterStats";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataMode } from "@/hooks/use-data-mode";
import { useDeepLink } from "@/hooks/use-deep-link";
import {
  EMPTY_FILTERS,
  filterLots,
  readFiltersFromUrl,
  writeFiltersToUrl,
} from "@/hooks/use-library-filters";
import type { LibraryFilters } from "@/hooks/use-library-filters";
import {
  useLots,
  useRegisterSummary,
  useSearchLots,
} from "@/hooks/use-register";
import { useMyRole } from "@/hooks/use-role";
import { Capability } from "@/lib/backend";
import type { LotView } from "@/lib/backend";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * The Library — the product's single screen.
 *
 * Guests land straight on the register: no marketing page, no hidden drawer.
 * Search, filters and the expanded block all live in the URL, so any view a
 * reader reaches can be shared and survives a refresh.
 *
 * The screen reads from one of two sources. In Real-time mode it reads the
 * register itself and shows exactly what is sealed there — an empty register
 * shows a clean empty state, never a placeholder lot. In Demo-data mode it
 * reads a randomly generated dataset held only in the browser, and every
 * write affordance is withheld because nothing in that view is real.
 *
 * The whole page is built mobile-first: a single column with generous vertical
 * rhythm on a phone, widening to the ledger grid on a tablet and desktop.
 */
export function HomePage() {
  const [filters, setFilters] = useState<LibraryFilters>(() =>
    readFiltersFromUrl(),
  );

  const { mode, demoLots, demoSummary } = useDataMode();
  const isDemo = mode === "demo";

  const { data: liveLots, isLoading, isError } = useLots();
  const { data: liveSummary } = useRegisterSummary();
  const { data: hits } = useSearchLots(filters.q);
  const { capabilities, effectiveCapabilities } = useMyRole();

  const lots = isDemo ? demoLots : liveLots;
  const summary = (isDemo ? demoSummary : liveSummary) ?? undefined;

  const updateFilters = useCallback((next: Partial<LibraryFilters>) => {
    setFilters((current) => {
      const merged = { ...current, ...next };
      writeFiltersToUrl(merged);
      return merged;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((current) => {
      const merged = { ...EMPTY_FILTERS, lot: current.lot };
      writeFiltersToUrl(merged);
      return merged;
    });
  }, []);

  const openLot = useCallback(
    (lotId: string) => {
      updateFilters({ lot: lotId });
    },
    [updateFilters],
  );

  // A successful delete removes the block from the register, so the expanded
  // view closes directly rather than pointing `?lot=` at the removed id. The
  // dangling-expansion effect below stays as a safety net for the other paths
  // that can hide an expanded block (filters, deep links to missing blocks).
  const closeLot = useCallback(() => {
    updateFilters({ lot: null });
  }, [updateFilters]);

  // The backend's `getMyCapabilities` is the authority for effective
  // permissions, so the delete control reads it rather than the role alone.
  // Demo mode withholds every write affordance because nothing there is real.
  const canDelete =
    !isDemo && effectiveCapabilities.includes(Capability.delete_lot);

  const toggleLot = useCallback((lotId: string) => {
    setFilters((current) => {
      const merged = {
        ...current,
        lot: current.lot === lotId ? null : lotId,
      };
      writeFiltersToUrl(merged);
      return merged;
    });
  }, []);

  // A `?lot=` deep link expands that block for a guest who never signed in.
  useDeepLink(openLot);

  const matchedIds = useMemo(
    () => new Set((hits ?? []).map((hit) => hit.id)),
    [hits],
  );

  const visibleLots = useMemo(
    () => filterLots(lots ?? [], filters, matchedIds),
    [lots, filters, matchedIds],
  );

  const childrenByParent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const lot of lots ?? []) {
      for (const parentId of lot.parentIds) {
        map[parentId] = [...(map[parentId] ?? []), lot.id];
      }
    }
    return map;
  }, [lots]);

  // The expanded block must be present in the filtered view; if a filter hides
  // it, drop the expansion rather than leaving a dangling deep link.
  useEffect(() => {
    if (!filters.lot || !lots) return;
    const stillVisible = visibleLots.some((lot) => lot.id === filters.lot);
    if (!stillVisible) {
      updateFilters({ lot: null });
    }
  }, [filters.lot, lots, visibleLots, updateFilters]);

  const photoUrls = useMemo(() => resolvePhotoUrls(lots ?? []), [lots]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <section className="pb-7" data-ocid="home.intro_section">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Jewel of Africa Limited · Lusaka
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-3xl leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
          The Explor8 provenance register
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          From extraction to verification, every precious metal and gemstone
          mined by Jewel of Africa is weighed, tested, and sealed as a unique
          block in this registry. Each block bears a cryptographic hash of its
          recorded data and supporting files, with every subsequent event added
          to its chain of custody. History unfolds downward, preserving a
          traceable record of provenance, integrity, and accountability; from
          the earth to the registry.
        </p>
      </section>

      {isDemo ? (
        <p
          className="mb-7 flex items-start gap-2 rounded-sm border border-accent/40 bg-accent/5 px-3 py-2.5 text-sm text-muted-foreground"
          data-ocid="register.demo_notice"
        >
          Demo data — a randomly generated register held only in this browser.
          Nothing here is sealed, and no register, append or freeze action is
          offered.
        </p>
      ) : null}

      <RegisterStats
        summary={summary}
        visibleCount={visibleLots.length}
        totalCount={lots?.length ?? 0}
      />

      <section className="py-9 md:py-12" data-ocid="home.graph_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Register at a glance
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          The register's own data — event activity over time, and how the lots
          break down by kind, status and site.
        </p>
        <RegisterGraph summary={summary} className="mt-5" />
      </section>

      <div className="rule-gold" />

      <section className="pt-9 md:pt-12" data-ocid="home.library_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Asset Registry Explorer
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Open a block to read its hash, its lineage and its full event chain.
        </p>

        <LibraryToolbar
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          onScanLot={openLot}
          totalCount={lots?.length ?? 0}
          visibleCount={visibleLots.length}
        />

        <div className="mt-7">
          {!isDemo && isLoading ? (
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
              data-ocid="register.loading_state"
            >
              {Array.from({ length: 6 }, (_, i) => `lot-skeleton-${i}`).map(
                (id) => (
                  <Skeleton key={id} className="h-32 w-full rounded-sm" />
                ),
              )}
            </div>
          ) : !isDemo && isError ? (
            <div
              className="block-face px-5 py-12 text-center"
              data-ocid="register.error_state"
            >
              <p className="font-display text-xl text-foreground md:text-2xl">
                The register could not be read
              </p>
              <p className="mt-3 text-base text-muted-foreground">
                Reload the page to try again. Sealed records are never lost.
              </p>
            </div>
          ) : visibleLots.length === 0 ? (
            <EmptyState
              filtered={(lots?.length ?? 0) > 0}
              onClear={clearFilters}
            />
          ) : (
            <LibraryGrid
              lots={visibleLots}
              expandedId={filters.lot}
              onToggle={toggleLot}
              onOpenLot={openLot}
              onDeleted={closeLot}
              canAppend={!isDemo && capabilities.canWrite}
              canDelete={canDelete}
              photoUrls={photoUrls}
              childrenByParent={childrenByParent}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Resolve object-storage file ids to gateway URLs.
 *
 * The storage gateway is injected at deploy time; until it is configured the
 * map stays empty and the photo strip shows its quiet placeholder rather than
 * a broken image.
 */
function resolvePhotoUrls(lots: LotView[]): Record<string, string> {
  const gateway = import.meta.env.VITE_STORAGE_GATEWAY_URL as
    | string
    | undefined;
  if (!gateway || gateway === "undefined") return {};

  const urls: Record<string, string> = {};
  for (const lot of lots) {
    for (const fileId of lot.photoFileIds) {
      urls[fileId] = `${gateway.replace(/\/$/, "")}/${fileId}`;
    }
  }
  return urls;
}
