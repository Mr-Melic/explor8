import {
  DELETE_LOT_PHRASE,
  DeleteLotDialog,
} from "@/components/lot/DeleteLotDialog";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockActor } from "@/test/mock-actor";

/**
 * The single-block delete confirmation.
 *
 * The accepted request makes deletion admin-only and irreversible, so the
 * dialog must refuse to submit until the administrator types the exact phrase
 * `DELETE BLOCK`, and must surface a backend refusal rather than reporting a
 * success the register did not grant.
 *
 * The actor is a typed local mock, so this proves the frontend's contract with
 * the register, never the canister's own authorization.
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

const LOT_ID = "JOA-MFB-20260918-0047";

function renderDialog(overrides: { onDeleted?: (id: string) => void } = {}) {
  const onOpenChange = vi.fn();
  const onDeleted = overrides.onDeleted ?? vi.fn();
  renderWithProviders(
    <DeleteLotDialog
      open
      onOpenChange={onOpenChange}
      lotId={LOT_ID}
      onDeleted={onDeleted}
    />,
  );
  return { onOpenChange, onDeleted };
}

describe("Delete block dialog", () => {
  beforeEach(() => {
    holder.actor.deleteLot.mockReset();
    holder.actor.deleteLot.mockResolvedValue({ __kind__: "ok", ok: LOT_ID });
  });

  it("names the block and requires the exact confirmation phrase", async () => {
    const user = userEvent.setup();
    renderDialog();

    // The dialog names the exact block being removed.
    expect(screen.getByText(new RegExp(LOT_ID))).toBeInTheDocument();
    expect(screen.getByTestId("lot.delete_phrase_required")).toHaveTextContent(
      DELETE_LOT_PHRASE,
    );

    const confirm = screen.getByTestId("lot.delete_confirm_button");
    // Nothing typed yet: deletion is not available.
    expect(confirm).toBeDisabled();

    // A near-miss phrase does not unlock it.
    await user.type(
      screen.getByTestId("lot.delete_phrase_input"),
      "delete block",
    );
    expect(confirm).toBeDisabled();

    // The exact phrase does.
    await user.clear(screen.getByTestId("lot.delete_phrase_input"));
    await user.type(
      screen.getByTestId("lot.delete_phrase_input"),
      DELETE_LOT_PHRASE,
    );
    expect(confirm).toBeEnabled();
  });

  it("deletes exactly the named block once the phrase matches", async () => {
    const user = userEvent.setup();
    const { onDeleted, onOpenChange } = renderDialog();

    await user.type(
      screen.getByTestId("lot.delete_phrase_input"),
      DELETE_LOT_PHRASE,
    );
    await user.click(screen.getByTestId("lot.delete_confirm_button"));

    await waitFor(() => {
      expect(holder.actor.deleteLot).toHaveBeenCalledTimes(1);
    });
    // Only the named block is passed to the register.
    expect(holder.actor.deleteLot).toHaveBeenCalledWith(LOT_ID);
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(LOT_ID);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not call the register when the phrase is wrong", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId("lot.delete_phrase_input"), "DELETE");
    await user.click(screen.getByTestId("lot.delete_confirm_button"));

    expect(holder.actor.deleteLot).not.toHaveBeenCalled();
  });

  it("surfaces a backend refusal instead of reporting success", async () => {
    const user = userEvent.setup();
    const { onDeleted } = renderDialog();
    holder.actor.deleteLot.mockResolvedValue({
      __kind__: "err",
      err: { __kind__: "notAuthorized", notAuthorized: null },
    });

    await user.type(
      screen.getByTestId("lot.delete_phrase_input"),
      DELETE_LOT_PHRASE,
    );
    await user.click(screen.getByTestId("lot.delete_confirm_button"));

    expect(
      await screen.findByTestId("lot.delete_error_state"),
    ).toHaveTextContent(/only an administrator may delete a block/i);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
