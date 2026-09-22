import { AppHeader } from "@/components/layout/AppHeader";
import { HomePage } from "@/pages/HomePage";
import { seedLots } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The home page's section skeleton and the header's control cluster.
 *
 * The accepted request adds a per-status information section and a purchase
 * enquiry form to the home page, and a sticky text-size control to the header.
 * Each of those is an ADDITION: the sections and controls that already exist
 * must survive it. This file characterizes that additive contract without
 * naming any copy the request intentionally changes.
 *
 * It deliberately asserts no wording that the request rewrites — not the hero
 * paragraph, not the licence reminder's prefix, not the lot field labels — so
 * the presentation overhaul is free to change those while this baseline stays
 * green.
 *
 * The actor is a typed local mock, so this proves the frontend's composition,
 * never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedLots, seedReferenceByKind, seedSummary } = await import(
    "@/test/fixtures"
  );
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor({
    lots: seedLots(),
    summary: seedSummary(),
    referenceEntries: seedReferenceByKind(),
  });
  return mockCoreInfrastructure({ actor: holder.actor });
});

vi.mock("@caffeineai/object-storage", () => ({
  StorageClient: class {
    putFile = vi.fn(async () => ({ hash: "file-hash" }));
  },
  ExternalBlob: {
    fromBytes: () => ({
      withUploadProgress: () => ({ getBytes: async () => new Uint8Array() }),
      getBytes: async () => new Uint8Array(),
      contentType: "image/png",
      filename: "photo.png",
    }),
  },
}));

function resetUrl() {
  window.history.replaceState(null, "", "/");
}

describe("Home page section skeleton", () => {
  beforeEach(() => {
    resetUrl();
    window.localStorage.clear();
    holder.actor.listLots.mockReset();
    holder.actor.listLots.mockResolvedValue(seedLots());
  });

  it("keeps the intro, graph and library sections in register order", async () => {
    renderWithProviders(<HomePage />);

    // The three sections the page already had are all still present...
    const intro = await screen.findByTestId("home.intro_section");
    const graph = screen.getByTestId("home.graph_section");
    const library = screen.getByTestId("home.library_section");
    expect(intro).toBeInTheDocument();
    expect(graph).toBeInTheDocument();
    expect(library).toBeInTheDocument();

    // ...and they still read top to bottom in that order, so a new section is
    // inserted around them rather than replacing one.
    const order = [intro, graph, library].map((node) =>
      Array.from(document.body.querySelectorAll("*")).indexOf(node),
    );
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it("keeps the register graph and the library grid inside their sections", async () => {
    renderWithProviders(<HomePage />);

    // The graph section still owns the register's own chart surface, which
    // plots the summary's activity once it resolves.
    const graph = await screen.findByTestId("home.graph_section");
    expect(within(graph).getByTestId("register.chart")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        within(graph).getByRole("img", {
          name: /Events appended per day across the register/i,
        }),
      ).toBeInTheDocument();
    });

    // The library section still owns the toolbar and the block grid.
    const library = screen.getByTestId("home.library_section");
    expect(within(library).getByTestId("register.toolbar")).toBeInTheDocument();
    await waitFor(() => {
      expect(within(library).getByTestId("lot.item.1")).toBeInTheDocument();
    });
  });

  it("keeps the register's own lots and result count readable for a guest", async () => {
    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    });
    expect(screen.getByTestId("register.result_count")).toHaveTextContent(
      "3 of 3 lots shown",
    );
  });
});

describe("Header control cluster", () => {
  beforeEach(() => {
    resetUrl();
    window.localStorage.clear();
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue("guest");
  });

  it("keeps the data-mode switch, theme toggle and sign-in control together", () => {
    renderWithProviders(<AppHeader />);

    // Every control the header already offered is still present, so the new
    // text-size control is an addition to this cluster rather than a swap.
    expect(screen.getByTestId("header.data_mode_toggle")).toBeInTheDocument();
    expect(screen.getByTestId("header.realtime_button")).toBeInTheDocument();
    expect(screen.getByTestId("header.demo_button")).toBeInTheDocument();
    expect(screen.getByTestId("theme.toggle")).toBeInTheDocument();
    expect(screen.getByTestId("header.sign_in_button")).toBeInTheDocument();
  });

  it("keeps the licence reminder line in the header", () => {
    renderWithProviders(<AppHeader />);

    // The reminder's stable half is asserted; its prefix is intentionally
    // changing, so it is not named here.
    expect(
      screen.getByText(
        /Licence reminder: every lot must carry a valid JOA licence reference/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the mode switch working after the header gains a control", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    await user.click(screen.getByTestId("header.demo_button"));

    expect(screen.getByTestId("header.demo_button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem("explor8-data-mode")).toBe("demo");
  });
});
