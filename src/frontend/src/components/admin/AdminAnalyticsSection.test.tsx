import { AdminAnalyticsSection } from "@/components/admin/AdminAnalyticsSection";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";
import type { RegisterAnalytics } from "@/lib/backend";

/**
 * The admin analytics section's two data sources.
 *
 * `AdminPage.test.tsx` proves the section renders for an administrator. This
 * file drives the behavior the accepted request changed: the "lots and events
 * over time" chart must plot two genuine, independent series, and the section
 * must follow the active data mode — reading the canister in Real-time mode and
 * deriving the same figures from the browser-held demo dataset in Demo-data
 * mode, without a live read.
 *
 * The actor is a typed local mock, so these prove the frontend's contract with
 * the register, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
  return mockCoreInfrastructure({
    actor: holder.actor,
    identity: holder.identity,
  });
});

/**
 * Two independent series over the same days: lots registered on 20260918 and
 * 20260920, events recorded on 20260918 and 20260919. The union of days is
 * 20260918–20260920, and each day carries its own genuine counts.
 */
function independentAnalytics(): RegisterAnalytics {
  return {
    totalLots: 3n,
    totalEvents: 5n,
    lotsOverTime: [
      { day: "20260918", lots: 2n, events: 0n },
      { day: "20260920", lots: 1n, events: 0n },
    ],
    eventsOverTime: [
      { day: "20260918", lots: 0n, events: 4n },
      { day: "20260919", lots: 0n, events: 1n },
    ],
    byKind: [{ key: "gold", count: 2n }],
    byStatus: [{ key: "assayed", count: 1n }],
    bySite: [{ key: "MFB", count: 2n }],
  };
}

function adminActor() {
  holder.identity.principal = "aaaaa-aa";
  holder.actor.getMyRole.mockResolvedValue(Role.admin);
}

describe("Admin analytics section", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.registerAnalytics.mockReset();
    holder.actor.registerAnalytics.mockResolvedValue({
      __kind__: "ok",
      ok: independentAnalytics(),
    });
    window.localStorage.clear();
  });

  it("plots genuine independent lot and event series in Real-time mode", async () => {
    adminActor();
    renderWithProviders(<AdminAnalyticsSection enabled />);

    // The chart is built from the union of both series' days, so the three
    // distinct days across lots and events all appear.
    const chart = await screen.findByRole("img", {
      name: /Lots sealed and events recorded per day across the register/i,
    });
    expect(chart).toBeInTheDocument();

    // The totals come from the register's own figures, not from the chart.
    const totals = screen.getByTestId("admin.analytics_totals");
    expect(totals).toHaveTextContent("Lots sealed");
    expect(totals).toHaveTextContent("3");
    expect(totals).toHaveTextContent("Events recorded");
    expect(totals).toHaveTextContent("5");
    // Three days carry activity: the union of the two series' days.
    expect(totals).toHaveTextContent("Days with activity");
    expect(totals).toHaveTextContent("3");

    // The chart draws one bar per day for lots and one point per day for
    // events, so the two series are genuinely independent rather than one
    // array reused for both.
    expect(chart.querySelectorAll("rect")).toHaveLength(3);
    expect(chart.querySelectorAll("circle")).toHaveLength(3);
    expect(chart.querySelector("path")).not.toBeNull();
  });

  it("reads the register's analytics only in Real-time mode", async () => {
    adminActor();
    renderWithProviders(<AdminAnalyticsSection enabled />);

    await waitFor(() => {
      expect(holder.actor.registerAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  it("derives the figures locally in Demo-data mode without a live read", async () => {
    adminActor();
    window.localStorage.setItem("explor8-data-mode", "demo");
    renderWithProviders(<AdminAnalyticsSection enabled />);

    // The demo notice marks the figures as generated, not sealed.
    expect(
      await screen.findByTestId("admin.analytics_demo_notice"),
    ).toBeInTheDocument();

    // The panel renders the demo dataset's own totals and chart.
    const totals = screen.getByTestId("admin.analytics_totals");
    expect(totals).toHaveTextContent("Lots sealed");
    expect(totals).toHaveTextContent("48");
    expect(
      screen.getByRole("img", {
        name: /Lots sealed and events recorded per day across the register/i,
      }),
    ).toBeInTheDocument();

    // No live canister read fires while the app is showing demo data.
    expect(holder.actor.registerAnalytics).not.toHaveBeenCalled();
  });

  it("shows the empty chart state when the register has no activity", async () => {
    adminActor();
    holder.actor.registerAnalytics.mockResolvedValue({
      __kind__: "ok",
      ok: {
        totalLots: 0n,
        totalEvents: 0n,
        lotsOverTime: [],
        eventsOverTime: [],
        byKind: [],
        byStatus: [],
        bySite: [],
      },
    });
    renderWithProviders(<AdminAnalyticsSection enabled />);

    expect(
      await screen.findByTestId("admin.analytics_chart_empty_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", {
        name: /Lots sealed and events recorded per day across the register/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("locks the analytics for a caller who is not an administrator", () => {
    renderWithProviders(<AdminAnalyticsSection enabled={false} />);

    expect(
      screen.getByTestId("admin.analytics_locked_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.analytics_panel"),
    ).not.toBeInTheDocument();
    expect(holder.actor.registerAnalytics).not.toHaveBeenCalled();
  });
});
