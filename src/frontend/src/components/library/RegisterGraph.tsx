import { useReferenceData } from "@/hooks/use-reference-data";
import { RefKind } from "@/lib/backend";
import type { CountBucket, RegisterSummary } from "@/lib/backend";
import { formatCount, formatIsoDay, humanizeToken } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type GraphView = "activity" | "type" | "status" | "site";

const VIEWS: { value: GraphView; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "type", label: "By kind" },
  { value: "status", label: "By status" },
  { value: "site", label: "By mining site" },
];

/**
 * The register's chart series, drawn from the eight-colour scheme. Each series
 * is a distinct token so a reader can tell them apart at a glance: lime,
 * blue-green, baby blue, light green, then night sky.
 */
const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

interface RegisterGraphProps {
  summary: RegisterSummary | undefined;
  className?: string;
}

/**
 * The register's own data, drawn as a ledger chart.
 *
 * Every view is computed from `registerSummary` — nothing here is decorative.
 * Activity plots events appended per day; the other three views rank the
 * register's buckets so a reader can see where the volume actually sits.
 *
 * Bucket labels resolve through the admin-managed reference catalogue, so a
 * renamed kind, status or site reads correctly here without a rebuild.
 */
export function RegisterGraph({ summary, className }: RegisterGraphProps) {
  const [view, setView] = useState<GraphView>("activity");
  const { labelFor } = useReferenceData();

  const activity = useMemo(
    () =>
      (summary?.activity ?? []).map((point) => ({
        day: point.day,
        count: Number(point.count),
      })),
    [summary],
  );

  const buckets = useMemo<CountBucket[]>(() => {
    if (!summary) return [];
    if (view === "type") return summary.byType;
    if (view === "status") return summary.byStatus;
    if (view === "site") return summary.bySite;
    return [];
  }, [summary, view]);

  const hasData =
    view === "activity" ? activity.length > 0 : buckets.length > 0;

  const labelForBucket = (key: string): string => {
    if (view === "type") {
      return labelFor(RefKind.lot_kind, key) ?? humanizeToken(key);
    }
    if (view === "status") {
      return labelFor(RefKind.status, key) ?? humanizeToken(key);
    }
    if (view === "site") {
      return labelFor(RefKind.site, key) ?? key;
    }
    return key;
  };

  return (
    <div className={cn("block-face px-4 py-5 md:px-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Register graph
        </p>
        <div className="flex flex-wrap gap-1.5" data-ocid="register.graph_tabs">
          {VIEWS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setView(option.value)}
              aria-pressed={view === option.value}
              data-ocid={`register.graph_tab.${option.value}`}
              className={cn(
                "inline-flex min-h-9 items-center rounded-sm border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-accent hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5" data-ocid="register.chart">
        {!hasData ? (
          <div
            className="flex h-48 items-center justify-center border border-dashed border-border"
            data-ocid="register.chart_empty_state"
          >
            <p className="max-w-sm px-4 text-center text-base text-muted-foreground">
              {view === "activity"
                ? "No events have been appended yet, so there is nothing to plot."
                : "No lots are recorded for this breakdown yet."}
            </p>
          </div>
        ) : view === "activity" ? (
          <ActivityChart points={activity} />
        ) : (
          <BucketChart buckets={buckets} labelFor={labelForBucket} />
        )}
      </div>
    </div>
  );
}

interface ActivityDatum {
  day: string;
  count: number;
}

/** Events appended per day: lime bars under a blue-green trend line. */
function ActivityChart({ points }: { points: ActivityDatum[] }) {
  const width = 720;
  const height = 176;
  const padding = { top: 12, right: 8, bottom: 8, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = Math.max(...points.map((point) => point.count), 1);
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => ({
    x: padding.left + index * step,
    y: padding.top + plotHeight - (point.count / max) * plotHeight,
    point,
  }));

  const linePath = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x} ${coord.y}`)
    .join(" ");

  const barWidth = Math.max(2, Math.min(14, plotWidth / points.length - 4));

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label="Events appended per day across the register"
        preserveAspectRatio="none"
      >
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={`grid-${ratio}`}
            className="chart-grid"
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * ratio}
            y2={padding.top + plotHeight * ratio}
          />
        ))}

        {coords.map((coord) => (
          <rect
            key={`bar-${coord.point.day}`}
            x={coord.x - barWidth / 2}
            y={coord.y}
            width={barWidth}
            height={padding.top + plotHeight - coord.y}
            fill="oklch(var(--chart-1) / 0.22)"
          />
        ))}

        <path
          d={linePath}
          fill="none"
          stroke="oklch(var(--chart-2))"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((coord) => (
          <circle
            key={`dot-${coord.point.day}`}
            cx={coord.x}
            cy={coord.y}
            r={2.5}
            fill="oklch(var(--chart-2))"
          />
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1">
        <span className="chart-axis-label">{formatIsoDay(points[0].day)}</span>
        <span className="chart-axis-label">Peak {formatCount(max)} events</span>
        <span className="chart-axis-label">
          {formatIsoDay(points[points.length - 1].day)}
        </span>
      </div>
    </>
  );
}

/** Ranked horizontal bars for the kind, status and site breakdowns. */
function BucketChart({
  buckets,
  labelFor,
}: {
  buckets: CountBucket[];
  labelFor: (key: string) => string;
}) {
  const ordered = [...buckets].sort((a, b) =>
    a.count < b.count ? 1 : a.count > b.count ? -1 : 0,
  );
  const max = Math.max(...ordered.map((bucket) => Number(bucket.count)), 1);

  return (
    <ul className="space-y-3 py-1">
      {ordered.map((bucket, index) => {
        const count = Number(bucket.count);
        const ratio = count / max;
        return (
          <li key={bucket.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-base text-foreground">
                {labelFor(bucket.key)}
              </span>
              <span className="hash shrink-0 text-sm">
                {formatCount(count)}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full bg-muted">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(ratio * 100, 2)}%`,
                  backgroundColor: `oklch(${SERIES[index % SERIES.length]})`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
