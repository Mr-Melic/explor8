import { FreezeLotControl } from "@/components/admin/FreezeLotControl";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LotStatus } from "@/lib/backend";
import type { LotView } from "@/lib/backend";
import { seedLots } from "@/test/fixtures";
import type { MockActor } from "@/test/mock-actor";

/**
 * The admin freeze control's write path.
 *
 * `AdminPage.test.tsx` proves the freeze panel renders for an administrator.
 * This file drives the mutation the acceptance criteria name: freezing a lot
 * calls the register's `freezeLot` with the chosen id, and a frozen lot is
 * withdrawn from the list of freezable lots.
 *
 * The actor is a typed local mock, so these prove the frontend's contract with
 * the register, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as MockActor,
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

function frozenLot(lot: LotView): LotView {
  return { ...lot, frozen: true, status: LotStatus.frozen };
}

describe("Admin freeze control", () => {
  beforeEach(() => {
    holder.actor.listLots.mockReset();
    holder.actor.listLots.mockResolvedValue(seedLots());
    holder.actor.freezeLot.mockReset();
    holder.actor.freezeLot.mockResolvedValue({
      __kind__: "ok",
      ok: frozenLot(seedLots()[0]),
    });
  });

  it("freezes the chosen lot through the register", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FreezeLotControl />);

    // The first freezable lot is the first seed lot.
    const button = await screen.findByTestId("admin.freeze_button.1");
    await user.click(button);

    await waitFor(() => {
      expect(holder.actor.freezeLot).toHaveBeenCalledTimes(1);
    });
    expect(holder.actor.freezeLot).toHaveBeenCalledWith(
      "JOA-MFB-20260918-0047",
    );
  });

  it("lists only the lots that are not already frozen", async () => {
    holder.actor.listLots.mockResolvedValue([
      seedLots()[0],
      frozenLot(seedLots()[1]),
      seedLots()[2],
    ]);
    renderWithProviders(<FreezeLotControl />);

    // Two freezable lots remain; the frozen one is not offered.
    expect(await screen.findByTestId("admin.freeze_lot.1")).toBeInTheDocument();
    expect(screen.getByTestId("admin.freeze_lot.2")).toBeInTheDocument();
    expect(screen.queryByTestId("admin.freeze_lot.3")).not.toBeInTheDocument();
    expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    expect(screen.queryByText("JOA-MFB-20260918-0048")).not.toBeInTheDocument();
  });

  it("shows the empty state when every lot is already frozen", async () => {
    holder.actor.listLots.mockResolvedValue(seedLots().map(frozenLot));
    renderWithProviders(<FreezeLotControl />);

    expect(
      await screen.findByTestId("admin.freeze_empty_state"),
    ).toHaveTextContent("Every lot in the register is already frozen.");
    expect(
      screen.queryByTestId("admin.freeze_button.1"),
    ).not.toBeInTheDocument();
  });

  it("surfaces a rejected freeze as operator-facing copy", async () => {
    const user = userEvent.setup();
    // The control keys its error state on the mutation rejecting, so model the
    // register refusing the call rather than resolving an `err` variant.
    holder.actor.freezeLot.mockRejectedValue(new Error("not authorized"));
    renderWithProviders(<FreezeLotControl />);

    await user.click(await screen.findByTestId("admin.freeze_button.1"));

    expect(
      await screen.findByTestId("admin.freeze_error_state"),
    ).toHaveTextContent(
      "The lot could not be frozen. Only an administrator may freeze a lot.",
    );
  });
});
