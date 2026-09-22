import { RegisterLotPanel } from "@/components/lot/RegisterLotPanel";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LotType, Site } from "@/lib/backend";
import { seedLots } from "@/test/fixtures";

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

function renderPanel(onRegistered = vi.fn()) {
  return renderWithProviders(
    <RegisterLotPanel
      open
      onOpenChange={vi.fn()}
      onRegistered={onRegistered}
    />,
  );
}

describe("Register lot panel", () => {
  beforeEach(() => {
    holder.actor.suggestLotId.mockClear();
    holder.actor.registerLot.mockClear();
    holder.actor.registerLot.mockResolvedValue({
      __kind__: "ok",
      ok: seedLots()[0],
    });
  });

  it("offers the three registered sites from the reference catalogue", async () => {
    renderPanel();

    const site = await screen.findByTestId("register.site_select");
    // The catalogue is read asynchronously, so wait for the options to land.
    await waitFor(() => {
      expect(site.querySelectorAll("option").length).toBe(3);
    });
    const options = Array.from(site.querySelectorAll("option")).map(
      (option) => option.value,
    );
    expect(options).toEqual([Site.MFB, Site.LUS, Site.KFB]);
  });

  it("offers only Emerald and Gold as lot kinds", async () => {
    renderPanel();

    const kind = await screen.findByTestId("register.type_select");
    await waitFor(() => {
      expect(kind.querySelectorAll("option").length).toBe(2);
    });
    const options = Array.from(kind.querySelectorAll("option")).map(
      (option) => option.value,
    );
    expect(options).toEqual([LotType.emerald, LotType.gold]);
    // The retired gold-related kinds are gone from the register's catalogue.
    for (const retired of ["sample_bag", "concentrate", "dore", "jewel"]) {
      expect(options).not.toContain(retired);
    }
  });

  it("fills the lot id from the register's own suggestion", async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });
  });

  it("refuses to submit an empty form and reports each missing field", async () => {
    const user = userEvent.setup();
    renderPanel();

    // Clear the suggested id and the prefilled licence/project defaults.
    await waitFor(() => {
      expect(screen.getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });
    await user.clear(screen.getByTestId("register.id_input"));
    await user.clear(screen.getByTestId("register.licence_input"));
    await user.clear(screen.getByTestId("register.project_input"));
    await user.click(screen.getByTestId("register.submit_button"));

    expect(
      await screen.findByText("A lot id is required."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A licence reference is required."),
    ).toBeInTheDocument();
    expect(screen.getByText("A project is required.")).toBeInTheDocument();
    expect(screen.getByText("Gross weight is required.")).toBeInTheDocument();
    expect(screen.getByText("A seal number is required.")).toBeInTheDocument();
    // Nothing reached the register.
    expect(holder.actor.registerLot).not.toHaveBeenCalled();
  });

  it("rejects a malformed lot id before calling the register", async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });
    await user.clear(screen.getByTestId("register.id_input"));
    await user.type(screen.getByTestId("register.id_input"), "not-a-lot-id");
    await user.click(screen.getByTestId("register.submit_button"));

    expect(
      await screen.findByText("Use the format JOA-<SITE>-YYYYMMDD-<NNNN>."),
    ).toBeInTheDocument();
    expect(holder.actor.registerLot).not.toHaveBeenCalled();
  });

  it("submits a valid draft and hands the sealed id back to the library", async () => {
    const user = userEvent.setup();
    const onRegistered = vi.fn();
    renderPanel(onRegistered);

    await waitFor(() => {
      expect(screen.getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });
    // Emerald needs no photo, so the draft is complete without an upload.
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
    expect(input).toMatchObject({
      site: Site.MFB,
      lotType: LotType.emerald,
      grossG: "12480",
      sealNo: "JOA-SEAL-0042",
    });
    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledWith("JOA-MFB-20260918-0047");
    });
  });

  it("surfaces a duplicate-lot rejection as operator-facing copy", async () => {
    const user = userEvent.setup();
    holder.actor.registerLot.mockResolvedValue({
      __kind__: "err",
      err: { __kind__: "duplicateLot", duplicateLot: "JOA-MFB-20260921-0001" },
    });
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

    expect(await screen.findByTestId("register.error_state")).toHaveTextContent(
      "Lot JOA-MFB-20260921-0001 already exists in the register.",
    );
  });
});
