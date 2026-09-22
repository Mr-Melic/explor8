import { LotExpandedPanel } from "@/components/lot/LotExpandedPanel";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventKind, LotStatus, LotType } from "@/lib/backend";
import type { EventView, LotView } from "@/lib/backend";
import { SEED_HASH_47, fakePrincipal, seedLots } from "@/test/fixtures";
import type { MockActor } from "@/test/mock-actor";

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as MockActor,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  // The actor is created once here and captured by the mocked `useActor`; a
  // test must configure this instance, not replace it, or the hook keeps
  // returning the original.
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

const OPENED_AT = 1_758_153_600_000_000_000n;

function event(
  seq: number,
  kind: EventKind,
  payload: string,
  supersededBy?: bigint,
): EventView {
  return {
    seq: BigInt(seq),
    kind,
    at: OPENED_AT + BigInt(seq) * 3_600_000_000_000n,
    by: fakePrincipal(),
    payload,
    payloadHash: SEED_HASH_47,
    fileIds: [],
    ...(supersededBy === undefined ? {} : { supersededBy }),
  };
}

/** A lot with a correction that supersedes an earlier event. */
function correctedLot(): LotView {
  const base = seedLots()[0];
  return {
    ...base,
    events: [
      event(1, EventKind.extracted, "Extracted at Trench T-12"),
      event(2, EventKind.weighed, "Weighed 184.2 g", 3n),
      event(3, EventKind.correction, "corrects #2 · grossG: “184.2” → “184.0”"),
    ],
  };
}

function renderPanel(lot: LotView, canAppend = false) {
  return renderWithProviders(
    <LotExpandedPanel
      lot={lot}
      canAppend={canAppend}
      photoUrls={{}}
      onOpenLot={vi.fn()}
      childIds={[]}
    />,
  );
}

describe("Expanded lot block", () => {
  beforeEach(() => {
    // Reset the captured actor's behavior between tests without replacing it.
    holder.actor.getLot.mockReset();
    holder.actor.getLot.mockResolvedValue(null);
    holder.actor.appendEvent.mockReset();
    holder.actor.appendEvent.mockResolvedValue({ __kind__: "ok", ok: null });
    holder.actor.canonicalSnapshotJson.mockReset();
    holder.actor.canonicalSnapshotJson.mockResolvedValue("{}");
  });

  it("shows the full 64-character content hash in monospace", () => {
    renderPanel(seedLots()[0]);

    const hash = screen.getByText(SEED_HASH_47);
    expect(hash).toHaveClass("hash");
    expect(hash.textContent).toHaveLength(64);
  });

  it("renders a QR deep link carrying the lot id", () => {
    renderPanel(seedLots()[0]);

    const qr = screen.getByTestId("lot.qr_code");
    expect(qr).toBeInTheDocument();
    // The caption prints the public URL plus ?lot=<id>.
    expect(screen.getByText(/\?lot=JOA-MFB-20260918-0047/)).toBeInTheDocument();
  });

  it("reveals the hash chain on demand and keeps prior links visible", async () => {
    const user = userEvent.setup();
    renderPanel(seedLots()[0]);

    expect(screen.queryByTestId("lot.hash_chain")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("lot.hash_chain_toggle"));

    const chain = await screen.findByTestId("lot.hash_chain");
    expect(within(chain).getByTestId("lot.chain_row.1")).toBeInTheDocument();
    expect(within(chain).getByTestId("lot.chain_row.2")).toBeInTheDocument();
  });

  it("marks a superseded event as corrected without hiding it", () => {
    renderPanel(correctedLot());

    // The corrected line stays in the timeline and points at its correction.
    expect(screen.getByText("Weighed 184.2 g")).toBeInTheDocument();
    expect(screen.getByTestId("lot.event_supersedes.2")).toHaveTextContent(
      "Corrects event #3",
    );
  });

  it("offers no control that edits or deletes an event", () => {
    renderPanel(correctedLot(), true);

    for (const name of [/edit/i, /delete/i, /undo/i, /save/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("shows the frozen notice instead of the append form", () => {
    renderPanel(
      { ...seedLots()[0], frozen: true, status: LotStatus.frozen },
      true,
    );

    expect(screen.getByTestId("event.frozen_notice")).toHaveTextContent(
      /sealed\. No further events/i,
    );
    expect(screen.queryByTestId("event.panel")).not.toBeInTheDocument();
  });

  it("shows the permission notice to a reader without a writing role", () => {
    renderPanel(seedLots()[0], false);

    expect(screen.getByTestId("event.permission_notice")).toHaveTextContent(
      /writing role to append/i,
    );
    expect(screen.queryByTestId("event.panel")).not.toBeInTheDocument();
  });

  it("appends a note event through the real form and reports success", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    holder.actor.getLot.mockResolvedValue(lot);
    holder.actor.appendEvent.mockResolvedValue({ __kind__: "ok", ok: lot });

    renderPanel(lot, true);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.note,
    );
    await user.type(screen.getByTestId("event.note_input"), "Moved to store");
    await user.click(screen.getByTestId("event.submit_button"));

    await waitFor(() => {
      expect(holder.actor.appendEvent).toHaveBeenCalledWith(
        lot.id,
        expect.objectContaining({
          kind: EventKind.note,
          payload: "Moved to store",
        }),
      );
    });
    expect(await screen.findByTestId("event.success_state")).toHaveTextContent(
      `Event appended to ${lot.id}.`,
    );
  });

  it("surfaces a backend rejection as an operator-facing error", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    holder.actor.getLot.mockResolvedValue(lot);
    holder.actor.appendEvent.mockResolvedValue({
      __kind__: "err",
      err: { __kind__: "lotFrozen", lotFrozen: lot.id },
    });

    renderPanel(lot, true);

    await user.selectOptions(
      await screen.findByTestId("event.kind_select"),
      EventKind.note,
    );
    await user.type(screen.getByTestId("event.note_input"), "after freeze");
    await user.click(screen.getByTestId("event.submit_button"));

    expect(await screen.findByTestId("event.error_state")).toHaveTextContent(
      `Lot ${lot.id} is frozen and cannot change.`,
    );
  });

  it("reports a matching content hash when the snapshot recomputes to the sealed value", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    // The canonical snapshot hashes to the lot's sealed content hash.
    const { sha256Hex } = await import("@/lib/hashing");
    const canonical = "canonical-snapshot";
    const digest = await sha256Hex(canonical);
    holder.actor.canonicalSnapshotJson.mockResolvedValue(canonical);

    renderPanel({ ...lot, contentHash: digest });

    await user.click(screen.getByTestId("lot.verify_snapshot_button"));

    expect(
      await screen.findByTestId("lot.verify_snapshot_state"),
    ).toHaveTextContent(/matches the register's canonical snapshot/i);
  });

  it("reports a mismatch when the snapshot recomputes to a different hash", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    holder.actor.canonicalSnapshotJson.mockResolvedValue("tampered-snapshot");

    renderPanel(lot);

    await user.click(screen.getByTestId("lot.verify_snapshot_button"));

    expect(
      await screen.findByTestId("lot.verify_snapshot_state"),
    ).toHaveTextContent(/does not match the register's canonical snapshot/i);
  });

  it("reports an unavailable snapshot rather than a false match", async () => {
    const user = userEvent.setup();
    const lot = seedLots()[0];
    holder.actor.canonicalSnapshotJson.mockResolvedValue(null);

    renderPanel(lot);

    await user.click(screen.getByTestId("lot.verify_snapshot_button"));

    expect(
      await screen.findByTestId("lot.verify_snapshot_state"),
    ).toHaveTextContent(/no canonical snapshot for this lot/i);
  });

  it("verifies an uploaded file against the sealed per-file hashes", async () => {
    const { sha256HexOfBytes } = await import("@/lib/hashing");
    const bytes = new TextEncoder().encode("sealed bytes");
    const digest = await sha256HexOfBytes(bytes);

    const lot: LotView = {
      ...seedLots()[0],
      lotType: LotType.gold,
      fileHashes: [{ fileId: "cert-1", contentHash: digest }],
    };
    renderPanel(lot);

    const file = new File([bytes], "cert.pdf", { type: "application/pdf" });
    // jsdom's `input.files` is a read-only accessor, so define it before
    // dispatching the change the component listens for.
    const input = screen.getByTestId(
      "lot.verify_files_input",
    ) as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);

    expect(
      await screen.findByTestId("lot.verify_result_state"),
    ).toHaveTextContent("1 of 1 file match the sealed hashes.");
  });
});
