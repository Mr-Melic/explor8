import { useRegisterAnalytics } from "@/hooks/use-admin-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { useReferenceData } from "@/hooks/use-reference-data";
import { RefKind } from "@/lib/backend";
import type { AnalyticsBucket, AnalyticsPoint } from "@/lib/backend";
import { summarizeDemoAnalytics } from "@/lib/demo-data";
import { formatCount, formatIsoDay, humanizeToken } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface AdminAnalyticsSectionProps {
  /** Whether the signed-in principal may read the register's analytics. */
  enabled: boolean;
}

/**
 * The register's own analytics, read in full.
 *
 * This is the home-page graph's data taken further: lots and events plotted
 * together over time, then every breakdown the register keeps — by kind, by
 * status and by site. Nothing here is decorative; every figure comes from
 * `registerAnalytics`.
 *
 * The panel follows the active data mode. In Real-time mode it reads the
 * canister's own analytics; in Demo-data mode it derives the same figures from
 * the browser-held demo dataset, so the panel never shows the live register
 * while the rest of the app is showing demo data.
 */
export function AdminAnalyticsSection({ enabled }: AdminAnalyticsSectionProps) {
  const { mode, demoLots } = useDataMode();
  const isDemo = mode === "demo";
  const { labelFor } = useReferenceData();

  const {
    data: liveData,
    isLoading,
    isError,
  } = useRegisterAnalytics(enabled && !isDemo);

  const demoData = useMemo(
    () => (isDemo && demoLots ? summarizeDemoAnalytics(demoLots) : null),
    [isDemo, demoLots],
  );

  const data = isDemo ? demoData : liveData;

  /**
   * The register keeps two independent series: lot registrations and event
   * activity. Each `AnalyticsPoint` carries its own `lots` and `events` count,
   * so the chart is built from the union of both series' days rather than
   * assuming one array holds both.
   */
  const points = useMemo<AnalyticsPoint[]>(() => {
    if (!data) return [];
    const byDay = new Map<string, AnalyticsPoint>();
    for (const point of data.lotsOverTime) {
      byDay.set(point.day, { ...point, events: 0n });
    }
    for (const point of data.eventsOverTime) {
      const existing = byDay.get(point.day);
      byDay.set(
        point.day,
        existing
          ? { ...existing, events: point.events }
          : { ...point, lots: 0n },
      );
    }
    return [...byDay.values()].sort((a, b) =>
      a.day < b.day ? -1 : a.day > b.day ? 1 : 0,
    );
  }, [data]);

  const totals = useMemo(
    () => ({
      lots: data ? Number(data.totalLots) : 0,
      events: data ? Number(data.totalEvents) : 0,
    }),
    [data],
  );

  if (!enabled) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.analytics_locked_state"
      >
        <p className="text-base text-muted-foreground">
          Only an administrator can read the register's analytics.
        </p>
      </div>
    );
  }

  if (!isDemo && isLoading) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.analytics_loading_state"
      >
        <p className="text-base text-muted-foreground">
          Reading the register's analytics…
        </p>
      </div>
    );
  }

  if (!isDemo && (isError || !data)) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.analytics_error_state"
      >
        <p className="text-base text-destructive">
          The register's analytics could not be read. Reload the page to try
          again.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.analytics_loading_state"
      >
        <p className="text-base text-muted-foreground">
          Preparing the demo dataset…
        </p>
      </div>
    );
  }

  const hasActivity = points.length > 0;

  return (
    <div className="mt-3 space-y-6" data-ocid="admin.analytics_panel">
      {isDemo ? (
        <p
          className="inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-muted-foreground"
          data-ocid="admin.analytics_demo_notice"
        >
          Demo data — these figures are derived from the randomly generated
          register held only in this browser, not from the live register.
        </p>
      ) : null}
      <div
        className="grid grid-cols-2 divide-border border-y border-border md:grid-cols-4 md:divide-x"
        data-ocid="admin.analytics_totals"
      >
        <Figure label="Lots sealed" value={formatCount(totals.lots)} />
        <Figure label="Events recorded" value={formatCount(totals.events)} />
        <Figure
          label="Events per lot"
          value={
            totals.lots > 0 ? (totals.events / totals.lots).toFixed(1) : "—"
          }
        />
        <Figure label="Days with activity" value={formatCount(points.length)} />
      </div>

      <div className="block-face px-3 py-4 md:px-5">
        <p className="micro-label">Lots and events over time</p>

        {!hasActivity ? (
          <div
            className="mt-3 flex h-44 items-center justify-center border border-dashed border-border"
            data-ocid="admin.analytics_chart_empty_state"
          >
            <p className="max-w-sm px-4 text-center text-base text-muted-foreground">
              No lots have been sealed yet, so there is no activity to plot.
            </p>
          </div>
        ) : (
          <ActivityChart points={points} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Breakdown
          title="By kind"
          buckets={data.byKind}
          labelForBucket={(key) =>
            labelFor(RefKind.lot_kind, key) ?? humanizeToken(key)
          }
          ocid="admin.analytics_kind"
        />
        <Breakdown
          title="By status"
          buckets={data.byStatus}
          labelForBucket={(key) =>
            labelFor(RefKind.status, key) ?? humanizeToken(key)
          }
          ocid="admin.analytics_status"
        />
        <Breakdown
          title="By mining site"
          buckets={data.bySite}
          labelForBucket={(key) => labelFor(RefKind.site, key) ?? key}
          ocid="admin.analytics_site"
        />
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-4 md:px-6">
      <p className="micro-label">{label}</p>
      <p className="stat-figure mt-2">{value}</p>
    </div>
  );
}

/**
 * Lots and events plotted together. Lots are lime bars, events a blue-green
 * line, so the two series stay legible against each other on one axis and
 * against the dark ground at phone width.
 */
function ActivityChart({ points }: { points: AnalyticsPoint[] }) {
  const width = 720;
  const height = 200;
  const padding = { top: 14, right: 10, bottom: 10, left: 10 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const lots = points.map((point) => Number(point.lots));
  const events = points.map((point) => Number(point.events));
  const max = Math.max(...lots, ...events, 1);
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const eventCoords = points.map((point, index) => ({
    x: padding.left + index * step,
    y: padding.top + plotHeight - (Number(point.events) / max) * plotHeight,
    day: point.day,
  }));

  const linePath = eventCoords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x} ${coord.y}`)
    .join(" ");

  const barWidth = Math.max(2, Math.min(16, plotWidth / points.length - 4));

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-40 w-full sm:h-48"
        role="img"
        aria-label="Lots sealed and events recorded per day across the register"
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

        {points.map((point, index) => {
          const x = padding.left + index * step;
          const barHeight = (Number(point.lots) / max) * plotHeight;
          return (
            <rect
              key={`lots-${point.day}`}
              x={x - barWidth / 2}
              y={padding.top + plotHeight - barHeight}
              width={barWidth}
              height={barHeight}
              fill="oklch(var(--chart-1) / 0.28)"
            />
          );
        })}

        <path
          d={linePath}
          fill="none"
          stroke="oklch(var(--chart-2))"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {eventCoords.map((coord) => (
          <circle
            key={`events-${coord.day}`}
            cx={coord.x}
            cy={coord.y}
            r={2}
            fill="oklch(var(--chart-2))"
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="chart-axis-label">{formatIsoDay(points[0].day)}</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 bg-chart-1/40"
              aria-hidden="true"
            />
            <span className="chart-axis-label">Lots</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full bg-chart-2"
              aria-hidden="true"
            />
            <span className="chart-axis-label">Events</span>
          </span>
        </span>
        <span className="chart-axis-label">
          {formatIsoDay(points[points.length - 1].day)}
        </span>
      </div>
    </>
  );
}

/** A ranked breakdown of one register dimension. */
function Breakdown({
  title,
  buckets,
  labelForBucket,
  ocid,
}: {
  title: string;
  buckets: AnalyticsBucket[];
  labelForBucket: (key: string) => string;
  ocid: string;
}) {
  const ordered = useMemo(
    () =>
      [...buckets].sort((a, b) =>
        a.count < b.count ? 1 : a.count > b.count ? -1 : 0,
      ),
    [buckets],
  );
  const max = Math.max(...ordered.map((bucket) => Number(bucket.count)), 1);

  return (
    <div className="block-face px-4 py-4" data-ocid={ocid}>
      <p className="micro-label">{title}</p>

      {ordered.length === 0 ? (
        <p
          className="mt-3 text-base text-muted-foreground"
          data-ocid={`${ocid}_empty_state`}
        >
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {ordered.map((bucket) => {
            const count = Number(bucket.count);
            const ratio = count / max;
            return (
              <li key={bucket.key} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-base text-foreground">
                    {labelForBucket(bucket.key)}
                  </span>
                  <span className="hash shrink-0">{formatCount(count)}</span>
                </div>
                <div className="mt-1.5 h-2 w-full bg-muted">
                  <div
                    className={cn("h-full bg-chart-1")}
                    style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
