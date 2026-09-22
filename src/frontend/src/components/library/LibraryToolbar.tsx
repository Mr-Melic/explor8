import { toggleFilter } from "@/hooks/use-library-filters";
import type { LibraryFilters } from "@/hooks/use-library-filters";
import { useQrScan } from "@/hooks/use-qr-scan";
import { useReferenceData } from "@/hooks/use-reference-data";
import { RefKind } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { Camera, Search, X } from "lucide-react";

interface LibraryToolbarProps {
  filters: LibraryFilters;
  onChange: (next: Partial<LibraryFilters>) => void;
  onClear: () => void;
  /** Expand a lot read from a scanned QR code. */
  onScanLot: (lotId: string) => void;
  /** Total lots in the register, for the result count line. */
  totalCount: number;
  visibleCount: number;
}

/**
 * The library's control strip: one search field, three rows of filter chips,
 * and the camera control. Every control writes straight into the URL-backed
 * filter state, so the view is always shareable.
 *
 * The chip rows are built from the admin-managed reference catalogue, so a
 * kind, status or site the administrator adds appears here without a rebuild.
 *
 * On a phone the search field and the two action buttons stack full width, and
 * each chip row wraps under its own label so nothing is clipped or scrolled
 * sideways.
 */
export function LibraryToolbar({
  filters,
  onChange,
  onClear,
  onScanLot,
  totalCount,
  visibleCount,
}: LibraryToolbarProps) {
  const scan = useQrScan({ onLotId: onScanLot });
  const { optionsFor } = useReferenceData();

  const kindOptions = optionsFor(RefKind.lot_kind);
  const statusOptions = optionsFor(RefKind.status);
  const siteOptions = optionsFor(RefKind.site);

  const hasFilters =
    filters.q.trim() !== "" ||
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.site !== "all";

  return (
    <div className="flex flex-col gap-4" data-ocid="register.toolbar">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Search lot id, hash prefix, seal or working ref"
            aria-label="Search the register"
            data-ocid="register.search_input"
            className="h-12 w-full rounded-sm border border-input bg-background pl-10 pr-3 text-base text-foreground transition-quick placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() =>
              scan.status === "scanning" ? scan.stop() : void scan.start()
            }
            data-ocid="register.scan_qr_button"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-border bg-background px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:w-auto"
          >
            <Camera className="size-4" aria-hidden="true" />
            {scan.status === "scanning" ? "Stop camera" : "Scan QR"}
          </button>

          {hasFilters ? (
            <button
              type="button"
              onClick={onClear}
              data-ocid="register.clear_filters_button"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-border bg-background px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:w-auto"
            >
              <X className="size-4" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {scan.status === "scanning" || scan.status === "starting" ? (
        <div
          className="block-face overflow-hidden p-3"
          data-ocid="register.scan_panel"
        >
          <div className="relative mx-auto max-w-sm">
            <video
              ref={scan.videoRef}
              muted
              playsInline
              aria-label="Camera preview for scanning a lot QR code"
              className="aspect-square w-full border border-border bg-muted object-cover"
            />
            <div className="pointer-events-none absolute inset-6 border-2 border-accent/70" />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {scan.status === "starting"
              ? "Opening the camera…"
              : "Point the camera at a lot's QR code."}
          </p>
        </div>
      ) : null}

      {scan.status === "error" && scan.error ? (
        <p
          className="text-sm text-destructive"
          data-ocid="register.scan_error_state"
        >
          {scan.error}
        </p>
      ) : null}

      <div className="space-y-3" data-ocid="register.filter_chips">
        <ChipRow
          label="Kind"
          options={kindOptions}
          active={filters.type}
          onSelect={(value) =>
            onChange({ type: toggleFilter(filters.type, value) })
          }
          marker="register.filter.type"
        />
        <ChipRow
          label="Status"
          options={statusOptions}
          active={filters.status}
          onSelect={(value) =>
            onChange({ status: toggleFilter(filters.status, value) })
          }
          marker="register.filter.status"
        />
        <ChipRow
          label="Mining Site"
          options={siteOptions}
          active={filters.site}
          onSelect={(value) =>
            onChange({ site: toggleFilter(filters.site, value) })
          }
          marker="register.filter.site"
        />
      </div>

      <p className="hash text-sm" data-ocid="register.result_count">
        {visibleCount} of {totalCount} lots shown
      </p>
    </div>
  );
}

function ChipRow({
  label,
  options,
  active,
  onSelect,
  marker,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  onSelect: (value: string) => void;
  marker: string;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] shrink-0 text-muted-foreground sm:w-14">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={active === option.value}
            data-ocid={`${marker}.${option.value}`}
            className={cn(
              "inline-flex min-h-9 items-center rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-accent hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
