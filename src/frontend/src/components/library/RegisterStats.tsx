import type { RegisterSummary } from "@/lib/backend";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RegisterStatsProps {
  summary: RegisterSummary | undefined;
  /** Number of lots currently visible after search and filters. */
  visibleCount: number;
  totalCount: number;
  className?: string;
}

/**
 * The register's headline figures, split by thin rules rather than boxed into
 * cards — a ledger header, not a dashboard. The visible count sits beside the
 * sealed total so a filtered view always states what it is hiding.
 *
 * On a phone the four figures stack into a two-column grid with generous
 * vertical rhythm so the large numerals never crowd the labels.
 */
export function RegisterStats({
  summary,
  visibleCount,
  totalCount,
  className,
}: RegisterStatsProps) {
  const filtered = visibleCount !== totalCount;

  return (
    <section
      className={cn(
        "grid grid-cols-2 divide-border border-y border-border md:grid-cols-4 md:divide-x",
        className,
      )}
      data-ocid="register.stats"
    >
      <Kpi
        label="Lots sealed"
        value={summary ? formatCount(summary.totalLots) : "—"}
      />
      <Kpi
        label="Events recorded"
        value={summary ? formatCount(summary.totalEvents) : "—"}
      />
      <Kpi
        label="Mining Sites"
        value={summary ? formatCount(summary.bySite.length) : "—"}
      />
      <Kpi
        label={filtered ? "Lots in view" : "Item kinds"}
        value={
          filtered
            ? `${formatCount(visibleCount)} / ${formatCount(totalCount)}`
            : summary
              ? formatCount(summary.byType.length)
              : "—"
        }
      />
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-5 md:px-6 md:py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl leading-none tracking-tight text-foreground md:text-4xl">
        {value}
      </p>
    </div>
  );
}
