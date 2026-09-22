import { AppHeader } from "@/components/layout/AppHeader";
import { HomePage } from "@/pages/HomePage";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LotStatus } from "@/lib/backend";
import type { LotView } from "@/lib/backend";

/**
 * Sealed-record immutability and demo/live isolation.
 *
 * The accepted request adds a per-status information section and a purchase
 * enquiry form to the home page, and an enquiry inbox to the admin panel.
 * Neither may disturb the two invariants this file characterizes:
 *
 * - a sealed (frozen) block stays fully readable and auditable — its facts,
 *   its complete event timeline and its hash chain are all still shown, and
 *   only the append affordance is withdrawn;
 * - the demo/live switch is browser-only: entering Demo-data mode never reads
 *   the live register, and returning to Real-time reads it again.
 *
 * The actor is a typed local mock, so this proves the frontend's rendering and
 * data-source contract, never the canister's own storage.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  lots: [] as LotView[],
  summary: undefined as unknown as ReturnType<
    typeof import("@/test/fixtures").seedSummary
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedLots, seedReferenceByKind, seedSummary } = await import(
    "@/test/fixtures"
  );
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.lots = seedLots();
  holder.summary = seedSummary();
  holder.actor = createMockActor({
    lots: holder.lots,
    summary: holder.summary,
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

/** The first seed lot, sealed: frozen with its full history still present. */
function sealedLot(): LotView {
  return { ...holder.lots[0], frozen: true, status: LotStatus.frozen };
}

function resetUrl() {
  window.history.replaceState(null, "", "/");
}

describe("Sealed block stays readable", () => {
  beforeEach(() => {
    resetUrl();
    window.localStorage.clear();
    holder.actor.listLots.mockReset();
    holder.actor.listLots.mockResolvedValue([sealedLot()]);
    holder.actor.registerSummary.mockReset();
    holder.actor.registerSummary.mockResolvedValue(holder.summary);
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue("guest");
    holder.actor.getMyCapabilities.mockReset();
    holder.actor.getMyCapabilities.mockResolvedValue([]);
  });

  it("still shows a sealed block's facts, events and hash chain", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    const opened = screen.getByTestId("lot.item.1");

    // The sealed block's own facts are still readable.
    expect(within(opened).getByText("Mufumbwe / Kikonge")).toBeInTheDocument();
    expect(within(opened).getByText("TYV-88341")).toBeInTheDocument();

    // Its complete event timeline is preserved, not hidden.
    const timeline = within(opened).getByTestId("lot.event_timeline");
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(4);
    expect(
      within(opened).getByText(
        "Independent fire-assay Au 4.1 g/t cert AF-9921",
      ),
    ).toBeInTheDocument();

    // Its hash chain is still auditable on demand.
    await user.click(within(opened).getByTestId("lot.hash_chain_toggle"));
    const chain = within(opened).getByTestId("lot.hash_chain");
    expect(within(chain).getByTestId("lot.chain_row.1")).toBeInTheDocument();
    expect(within(chain).getByTestId("lot.chain_row.2")).toBeInTheDocument();
  });

  it("withdraws only the append affordance from a sealed block", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    // The append form is replaced by the sealed notice...
    expect(screen.getByTestId("event.frozen_notice")).toHaveTextContent(
      /sealed\. No further events/i,
    );
    expect(screen.queryByTestId("event.panel")).not.toBeInTheDocument();
    // ...and no control rewrites or removes an existing line.
    for (const name of [/edit/i, /delete/i, /undo/i, /save/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});

describe("Demo/live switch isolation", () => {
  beforeEach(() => {
    resetUrl();
    window.localStorage.clear();
    holder.actor.listLots.mockReset();
    holder.actor.listLots.mockResolvedValue(holder.lots);
    holder.actor.registerSummary.mockReset();
    holder.actor.registerSummary.mockResolvedValue(holder.summary);
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue("guest");
    holder.actor.getMyCapabilities.mockReset();
    holder.actor.getMyCapabilities.mockResolvedValue([]);
  });

  it("never reads the live register while Demo-data mode is active", async () => {
    const user = userEvent.setup();
    // The mode switch lives in the header, so render the shell the app uses.
    renderWithProviders(
      <>
        <AppHeader />
        <HomePage />
      </>,
    );

    // Real-time mode reads the register's own lots.
    await screen.findByText("JOA-MFB-20260918-0047");
    await waitFor(() => {
      expect(holder.actor.listLots).toHaveBeenCalled();
    });

    // Switch into demo and let the generated dataset paint.
    await user.click(screen.getByTestId("header.demo_button"));
    await screen.findByTestId("register.demo_notice");
    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        /of 48 lots shown/,
      );
    });

    // The live register's own lots are gone from the view, and no further
    // live read was issued for the demo dataset.
    expect(screen.queryByText("JOA-MFB-20260918-0047")).not.toBeInTheDocument();
    const callsAfterDemo = holder.actor.listLots.mock.calls.length;
    expect(callsAfterDemo).toBe(1);
  });

  it("reads the live register again after returning to Real-time mode", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppHeader />
        <HomePage />
      </>,
    );

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("header.demo_button"));
    await screen.findByTestId("register.demo_notice");

    // Back to Real-time: the live register's own lots are shown again.
    await user.click(screen.getByTestId("header.realtime_button"));

    await waitFor(() => {
      expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("register.demo_notice"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("register.result_count")).toHaveTextContent(
      "3 of 3 lots shown",
    );
  });
});
