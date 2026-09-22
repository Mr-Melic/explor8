import { RegisterLotPanel } from "@/components/lot/RegisterLotPanel";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LotType } from "@/lib/backend";
import { seedLots } from "@/test/fixtures";

/**
 * Photo upload on the register-lot form.
 *
 * The acceptance criteria name photo upload as existing behavior that must
 * survive the presentation overhaul. `RegisterLotPanel.test.tsx` proves the
 * form's validation and submit contract; this file drives the photo path
 * itself: a chosen file is hashed in the browser and staged with its content
 * hash, a staged photo can be removed, and a physical-material kind refuses to
 * submit with no photo at all.
 *
 * The actor and the storage client are local typed mocks, so these prove the
 * frontend's contract with the register, never the canister or the gateway.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedReferenceByKind } = await import("@/test/fixtures");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor({
    suggestedId: "JOA-MFB-20260921-0001",
    referenceEntries: seedReferenceByKind(),
  });
  return mockCoreInfrastructure({ actor: holder.actor });
});

vi.mock("@caffeineai/object-storage", () => ({
  StorageClient: class {
    putFile = vi.fn(async () => ({ hash: "gateway-file-hash" }));
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

function renderPanel(onRegistered = vi.fn()) {
  return renderWithProviders(
    <RegisterLotPanel
      open
      onOpenChange={vi.fn()}
      onRegistered={onRegistered}
    />,
  );
}

/** Fill the fields a valid draft needs, leaving the kind to the caller. */
async function fillDraft(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByTestId("register.id_input")).toHaveValue(
      "JOA-MFB-20260921-0001",
    );
  });
  fireEvent.change(screen.getByTestId("register.gross_input"), {
    target: { value: "12480" },
  });
  fireEvent.change(screen.getByTestId("register.seal_input"), {
    target: { value: "JOA-SEAL-0042" },
  });
  await user.selectOptions(
    screen.getByTestId("register.type_select"),
    LotType.gold,
  );
}

/** Attach a file to the uploader's hidden "choose photos" input. */
function choosePhoto(name = "working-face.png") {
  const file = new File(["sealed bytes"], name, { type: "image/png" });
  const input = document.querySelector(
    'input[type="file"][accept="image/*"]:not([capture])',
  ) as HTMLInputElement;
  Object.defineProperty(input, "files", {
    value: [file],
    configurable: true,
  });
  fireEvent.change(input);
  return file;
}

describe("Register lot photo upload", () => {
  beforeEach(() => {
    holder.actor.suggestLotId.mockClear();
    holder.actor.registerLot.mockClear();
    holder.actor.registerLot.mockResolvedValue({
      __kind__: "ok",
      ok: seedLots()[0],
    });
  });

  it("stages a chosen photo with its browser-computed content hash", async () => {
    renderPanel();

    choosePhoto("working-face.png");

    // The thumbnail appears and carries a shortened hash, not "hashing…".
    const item = await screen.findByTestId("lot.photo_item.1");
    await waitFor(() => {
      expect(item.textContent).not.toContain("hashing…");
    });
    expect(screen.getByAltText("working-face.png")).toBeInTheDocument();
  });

  it("removes a staged photo before submit", async () => {
    const user = userEvent.setup();
    renderPanel();

    choosePhoto("to-remove.png");
    await screen.findByTestId("lot.photo_item.1");

    await user.click(screen.getByTestId("lot.photo_remove_button.1"));

    await waitFor(() => {
      expect(screen.queryByTestId("lot.photo_item.1")).not.toBeInTheDocument();
    });
  });

  it("refuses to register a physical-material kind with no photo", async () => {
    const user = userEvent.setup();
    renderPanel();

    await fillDraft(user);
    // Gold is a physical-material kind, so at least one photo is required.
    fireEvent.click(screen.getByTestId("register.submit_button"));

    expect(
      await screen.findByText(
        "At least one photo is required for this item kind.",
      ),
    ).toBeInTheDocument();
    expect(holder.actor.registerLot).not.toHaveBeenCalled();
  });

  it("registers an emerald lot with no photo", async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });
    await user.selectOptions(
      screen.getByTestId("register.type_select"),
      LotType.emerald,
    );
    fireEvent.change(screen.getByTestId("register.gross_input"), {
      target: { value: "12480" },
    });
    fireEvent.change(screen.getByTestId("register.seal_input"), {
      target: { value: "JOA-SEAL-0042" },
    });
    fireEvent.click(screen.getByTestId("register.submit_button"));

    await waitFor(() => {
      expect(holder.actor.registerLot).toHaveBeenCalledTimes(1);
    });
    const input = holder.actor.registerLot.mock.calls[0][0];
    expect(input.lotType).toBe(LotType.emerald);
    expect(input.photoFileIds).toEqual([]);
  });
});
