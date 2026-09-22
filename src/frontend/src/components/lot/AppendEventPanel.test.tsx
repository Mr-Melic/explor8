import { AppendEventPanel } from "@/components/lot/AppendEventPanel";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventKind, LotType, Site } from "@/lib/backend";
import type { LotView } from "@/lib/backend";
import { seedLots } from "@/test/fixtures";
import type { MockActor } from "@/test/mock-actor";

/**
 * The append-event panel's structural write paths.
 *
 * `LotExpandedPanel.test.tsx` proves the panel renders and that a simple note
 * round-trips. This file characterizes the two structural kinds the accepted
 * request must keep working — split and merge — plus the append-only correction
 * path: a correction is a new event that points at an earlier sequence, never a
 * rewrite of the original line.
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

function renderPanel(lot: LotView, canAppend = true) {
  return renderWithProviders(
    <AppendEventPanel lotId={lot.id} canAppend={canAppend} frozen={false} />,
  );
}

describe("Append event panel structural paths", () => {
  beforeEach(() => {
    const lot = seedLots()[0];
    holder.actor.getLot.mockReset();
    holder.actor.getLot.mockResolvedValue(lot);
    holder.actor.appendEvent.mockReset();
    holder.actor.appendEvent.mockResolvedValue({ __kind__: "ok", ok: lot });
    holder.actor.splitLot.mockReset();
    holder.actor.splitLot.mockResolvedValue({ __kind__: "ok", ok: [] });
    holder.actor.mergeLots.mockReset();
    holder.actor.mergeLots.mockResolvedValue({ __kind__: "ok", ok: lot });
  });

  it("records a split with one child lot per id and weight", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    renderPanel(lot);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.split,
    );
    await user.type(
      screen.getByTestId("event.child_ids_input"),
      "JOA-MFB-20260921-0002, JOA-MFB-20260921-0003",
    );
    await user.type(
      screen.getByTestId("event.child_weights_input"),
      "6200, 6280",
    );
    await user.click(screen.getByTestId("event.submit_button"));

    await waitFor(() => {
      expect(holder.actor.splitLot).toHaveBeenCalledTimes(1);
    });
    const input = holder.actor.splitLot.mock.calls[0][0];
    expect(input.parentId).toBe(lot.id);
    expect(input.children).toHaveLength(2);
    expect(input.children[0]).toMatchObject({
      grossG: "6200",
      site: Site.MFB,
      lotType: lot.lotType,
      licence: lot.licence,
      project: lot.project,
    });
    expect(input.children[1]).toMatchObject({ grossG: "6280" });
    // The split is recorded through the register, not by editing the parent.
    expect(holder.actor.appendEvent).not.toHaveBeenCalled();
    expect(await screen.findByTestId("event.success_state")).toHaveTextContent(
      "Split recorded — 2 child lots created.",
    );
  });

  it("refuses a split whose child weights do not match its child ids", async () => {
    const user = userEvent.setup();
    renderPanel(seedLots()[0]);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.split,
    );
    await user.type(
      screen.getByTestId("event.child_ids_input"),
      "JOA-MFB-20260921-0002, JOA-MFB-20260921-0003",
    );
    await user.type(screen.getByTestId("event.child_weights_input"), "6200");
    await user.click(screen.getByTestId("event.submit_button"));

    expect(await screen.findByTestId("event.error_state")).toHaveTextContent(
      "Give one weight for each child lot id.",
    );
    expect(holder.actor.splitLot).not.toHaveBeenCalled();
  });

  it("records a merge into the destination lot with the combined weight", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    renderPanel(lot);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.merge,
    );
    await user.type(
      screen.getByTestId("event.source_ids_input"),
      "JOA-MFB-20260918-0048",
    );
    await user.type(screen.getByTestId("event.merge_grams_input"), "206.2");
    await user.click(screen.getByTestId("event.submit_button"));

    await waitFor(() => {
      expect(holder.actor.mergeLots).toHaveBeenCalledTimes(1);
    });
    const input = holder.actor.mergeLots.mock.calls[0][0];
    expect(input.destinationId).toBe(lot.id);
    expect(input.sourceId).toBe("JOA-MFB-20260918-0048");
    expect(input.payload).toContain("JOA-MFB-20260918-0048");
    expect(input.payload).toContain("206.2");
    // The source is merged into the destination, never deleted.
    expect(holder.actor.appendEvent).not.toHaveBeenCalled();
    expect(await screen.findByTestId("event.success_state")).toHaveTextContent(
      `Merge recorded into ${lot.id}.`,
    );
  });

  it("refuses a merge with no source lot id", async () => {
    const user = userEvent.setup();
    renderPanel(seedLots()[0]);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.merge,
    );
    await user.type(screen.getByTestId("event.merge_grams_input"), "206.2");
    await user.click(screen.getByTestId("event.submit_button"));

    expect(await screen.findByTestId("event.error_state")).toHaveTextContent(
      "Add at least one source lot id.",
    );
    expect(holder.actor.mergeLots).not.toHaveBeenCalled();
  });

  it("appends a correction as a new event that points at the earlier sequence", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    renderPanel(lot);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.correction,
    );
    await user.type(screen.getByTestId("event.correction_seq_input"), "2");
    await user.type(
      screen.getByTestId("event.correction_field_input"),
      "grossG",
    );
    await user.type(screen.getByTestId("event.correction_old_input"), "184.2");
    await user.type(screen.getByTestId("event.correction_new_input"), "184.0");
    await user.type(
      screen.getByTestId("event.correction_reason_input"),
      "Scale re-read after calibration",
    );
    await user.click(screen.getByTestId("event.submit_button"));

    await waitFor(() => {
      expect(holder.actor.appendEvent).toHaveBeenCalledTimes(1);
    });
    const [lotId, input] = holder.actor.appendEvent.mock.calls[0];
    expect(lotId).toBe(lot.id);
    expect(input.kind).toBe(EventKind.correction);
    // The correction names the sequence it corrects; the original line is not
    // rewritten or removed.
    expect(input.payload).toContain("corrects #2");
    expect(input.payload).toContain("184.2");
    expect(input.payload).toContain("184.0");
    expect(holder.actor.splitLot).not.toHaveBeenCalled();
    expect(holder.actor.mergeLots).not.toHaveBeenCalled();
  });

  it("offers no control that rewrites an existing event", async () => {
    renderPanel(seedLots()[0]);

    await screen.findByTestId("event.panel");
    for (const name of [/edit/i, /delete/i, /undo/i, /save/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("keeps the split and merge kinds in the appendable list", async () => {
    renderPanel(seedLots()[0]);

    const select = await screen.findByTestId("event.kind_select");
    const values = Array.from(select.querySelectorAll("option")).map(
      (option) => option.value,
    );
    expect(values).toContain(EventKind.split);
    expect(values).toContain(EventKind.merge);
    expect(values).toContain(EventKind.correction);
    expect(values).toContain(EventKind.note);
  });

  it("sends a split child's site from its own id when it differs from the parent", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    renderPanel(lot);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.split,
    );
    await user.type(
      screen.getByTestId("event.child_ids_input"),
      "JOA-LUS-20260921-0002",
    );
    await user.type(screen.getByTestId("event.child_weights_input"), "100");
    await user.click(screen.getByTestId("event.submit_button"));

    await waitFor(() => {
      expect(holder.actor.splitLot).toHaveBeenCalledTimes(1);
    });
    const input = holder.actor.splitLot.mock.calls[0][0];
    expect(input.children[0].site).toBe(Site.LUS);
    // The child keeps the parent's lot kind and licence.
    expect(input.children[0].lotType).toBe(LotType.gold);
  });
});
