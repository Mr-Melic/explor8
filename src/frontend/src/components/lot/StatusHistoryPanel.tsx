import { StatusPill } from "@/components/lot/StatusPill";
import { STATUS_LABEL } from "@/components/lot/StatusPill";
import { useReferenceData } from "@/hooks/use-reference-data";
import { useStatusHistory } from "@/hooks/use-register";
import type { LotView, StatusChange } from "@/lib/backend";
import { RefKind } from "@/lib/backend";
import { formatTimestamp, humanizeToken, shortenPrincipal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface StatusHistoryPanelProps {
  lot: LotView;
  className?: string;
}

/**
 * The block's status-change history, oldest first.
 *
 * Every status change is a Precious Material Origin History event, so this
 * reads the register's own
 * ordered history and falls back to the history carried on the lot view while
 * the query resolves. A long chain is stepped through with in-block arrow
 * navigation: the reader moves one entry at a time without leaving the block,
 * and the current index and total stay visible.
 *
 * The entry stacks its from → to terms, actor and timestamp on a phone so the
 * row never runs off the edge of the block.
 */
export function StatusHistoryPanel({
  lot,
  className,
}: StatusHistoryPanelProps) {
  const { data, isLoading } = useStatusHistory(lot.id);
  const { labelFor } = useReferenceData();
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState({ lotId: lot.id, length: 0 });

  const history = orderHistory(
    data && data.length > 0 ? data : lot.statusHistory,
  );
  // A new lot, or a refreshed chain, resets the reader to the newest entry.
  // Adjusting during render (rather than in an effect) keeps the first paint
  // of a newly opened block on the latest change.
  if (seen.lotId !== lot.id || seen.length !== history.length) {
    setSeen({ lotId: lot.id, length: history.length });
    setIndex(history.length === 0 ? 0 : history.length - 1);
  }

  const label = (status: string): string =>
    labelFor(RefKind.status, status) ??
    STATUS_LABEL[status] ??
    humanizeToken(status);

  if (history.length === 0) {
    return (
      <p
        className={cn("text-base text-muted-foreground", className)}
        data-ocid="lot.status_history_empty_state"
      >
        {isLoading
          ? "Reading the status history…"
          : "No status changes have been recorded for this block yet."}
      </p>
    );
  }

  const safeIndex = Math.min(Math.max(index, 0), history.length - 1);
  const hasNavigation = history.length > 1;

  return (
    <div className={cn("min-w-0", className)} data-ocid="lot.status_history">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Status change {safeIndex + 1} of {history.length}
        </p>

        {hasNavigation ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              disabled={safeIndex === 0}
              aria-label="Previous status change"
              data-ocid="lot.status_history_prev"
              className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() =>
                setIndex((value) => Math.min(history.length - 1, value + 1))
              }
              disabled={safeIndex === history.length - 1}
              aria-label="Next status change"
              data-ocid="lot.status_history_next"
              className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <ol className="mt-3 space-y-2.5">
        {history.map((change, position) => (
          <StatusChangeRow
            key={`status-${change.seq.toString()}`}
            change={change}
            position={position}
            active={position === safeIndex}
            label={label}
          />
        ))}
      </ol>
    </div>
  );
}

function StatusChangeRow({
  change,
  position,
  active,
  label,
}: {
  change: StatusChange;
  position: number;
  active: boolean;
  label: (status: string) => string;
}) {
  return (
    <li
      className={cn(
        "border-l-2 pl-3 transition-quick",
        active ? "border-accent" : "border-border",
      )}
      data-ocid={`lot.status_change_row.${position + 1}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="hash shrink-0 text-sm">#{change.seq.toString()}</span>
        <span className="text-sm text-muted-foreground">
          {label(change.from)}
        </span>
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <StatusPill status={change.to} />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="hash text-sm">{formatTimestamp(change.at)}</span>
        <span className="hash text-sm" title={change.by.toString()}>
          {shortenPrincipal(change.by.toString())}
        </span>
      </div>
    </li>
  );
}

/** Oldest first, by Precious Material Origin History sequence. */
function orderHistory(history: StatusChange[] | undefined): StatusChange[] {
  if (!history) return [];
  return [...history].sort((a, b) =>
    a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0,
  );
}
