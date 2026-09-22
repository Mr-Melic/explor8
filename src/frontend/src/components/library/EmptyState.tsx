import { cn } from "@/lib/utils";
import { Archive } from "lucide-react";

interface EmptyStateProps {
  /** True when the register holds lots but the current view matches none. */
  filtered: boolean;
  /** Clear the search term and every filter chip. */
  onClear: () => void;
  className?: string;
}

/**
 * The calm state when the library has nothing to show. It distinguishes an
 * empty register from an over-narrow view, because the two need different
 * next steps.
 *
 * In Real-time mode an empty register is the honest state: no sample or
 * placeholder lots are ever invented to fill it.
 */
export function EmptyState({ filtered, onClear, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "block-face flex flex-col items-center px-5 py-14 text-center sm:px-6",
        className,
      )}
      data-ocid="register.empty_state"
    >
      <span className="flex size-14 items-center justify-center rounded-sm border border-border bg-muted">
        <Archive className="size-6 text-muted-foreground" aria-hidden="true" />
      </span>

      <p className="mt-5 font-display text-xl tracking-tight text-foreground md:text-2xl">
        {filtered ? "No lots match this view" : "The register is empty"}
      </p>

      <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
        {filtered
          ? "The register holds lots, but none match the current search and filters. Widen the view to see them again."
          : "The first sealed lot will appear here as soon as a field officer registers one. Every block carries its own hash and chain."}
      </p>

      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          data-ocid="register.clear_filters_button"
          className="mt-6 inline-flex h-11 items-center rounded-sm border border-border bg-background px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear search and filters
        </button>
      ) : null}
    </div>
  );
}
