import { LotBlock } from "@/components/lot/LotBlock";
import { renderWithProviders } from "@/test/render";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventKind, LotStatus } from "@/lib/backend";
import type { LotView } from "@/lib/backend";
import { seedLots } from "@/test/fixtures";

/**
 * The lot block's field labels and event names.
 *
 * The accepted request renames the lot facts to 'Registered at', 'Mining Site',
 * 'Mining Licence', 'Registered by' and 'Lot number', and aligns the event
 * names shown in each block with the current status names.
 *
 * The actor is a typed local mock, so this proves the rendered block, never the
 * canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
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

/** A lot whose events cover the status-aligned event names. */
function labelledLot(): LotView {
  const base = seedLots()[0];
  return {
    ...base,
    status: LotStatus.assayed,
    events: [
      {
        ...base.events[0],
        kind: EventKind.extracted,
        payload: "Extracted at Trench T-12",
      },
      {
        ...base.events[1],
        kind: EventKind.assay,
        payload: "Independent fire-assay Au 4.1 g/t",
      },
    ],
  };
}

describe("Lot block labels and event names", () => {
  beforeEach(() => {
    holder.actor.getLot.mockReset();
    holder.actor.getLot.mockResolvedValue(null);
  });

  it("shows the accepted lot fact labels", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LotBlock lot={labelledLot()} index={0} />);

    await user.click(screen.getByTestId("lot.open_button.1"));

    const block = screen.getByTestId("lot.item.1");
    for (const label of ["Registered at", "Mining Licence", "Registered by"]) {
      expect(within(block).getByText(label)).toBeInTheDocument();
    }
    // The retired labels must not appear.
    for (const retired of ["Opened at", "Opened by", "Seal number"]) {
      expect(within(block).queryByText(retired)).not.toBeInTheDocument();
    }
  });

  it("shows the lot number and mining site in the collapsed header", () => {
    renderWithProviders(<LotBlock lot={labelledLot()} index={0} />);

    const block = screen.getByTestId("lot.item.1");
    // The collapsed card prints the lot number and the mining site.
    expect(within(block).getByText(/Lot TYV-88341/)).toBeInTheDocument();
    expect(within(block).getByText("Mufumbwe / Kikonge")).toBeInTheDocument();
  });

  it("aligns event names with the current status names", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LotBlock lot={labelledLot()} index={0} />);

    await user.click(screen.getByTestId("lot.open_button.1"));

    const block = screen.getByTestId("lot.item.1");
    // The event timeline is the ordered list under the events heading.
    const eventsHeading = within(block).getByText(
      "Precious Material Origin History events",
    );
    const timeline = eventsHeading.parentElement as HTMLElement;
    // `extracted` reads as the 'Recently Mined' status term and `assay` as
    // 'Testing Quality', rather than a generic verb.
    expect(within(timeline).getByText("Recently Mined")).toBeInTheDocument();
    expect(within(timeline).getByText("Testing Quality")).toBeInTheDocument();
  });
});
