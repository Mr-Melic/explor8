import { AppHeader } from "@/components/layout/AppHeader";
import { HomePage } from "@/pages/HomePage";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The demo-mode register-lot journey.
 *
 * The accepted request lets any signed-in user register a lot while in demo
 * mode, fully simulated in the browser and never written to backend storage.
 * This is the critical journey across the real header, the register drawer and
 * the library: a signed-in reader switches to Demo data, seals a lot, and sees
 * it in the register view — while the canister's `registerLot` is never called.
 *
 * The actor is a typed local mock, so this proves the frontend journey and its
 * contract with the actor, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
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
    suggestedId: "JOA-MFB-20260921-0001",
  });
  return mockCoreInfrastructure({
    actor: holder.actor,
    identity: holder.identity,
  });
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

describe("Demo-mode register-lot journey", () => {
  beforeEach(() => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.registerLot.mockClear();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("lets a signed-in reader seal a lot in demo mode without writing to the register", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AppHeader />
        <HomePage />
      </>,
    );

    // Switch into Demo data; the register is now browser-only.
    await user.click(screen.getByTestId("header.demo_button"));
    await screen.findByTestId("register.demo_notice");

    // A signed-in reader with no writing role still gets the register action
    // in demo mode.
    const registerButton = await screen.findByTestId(
      "header.register_lot_button",
    );
    await user.click(registerButton);

    const sheet = await screen.findByTestId("register.sheet");
    await waitFor(() => {
      expect(within(sheet).getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });

    // Fill the remaining required fields.
    await user.type(within(sheet).getByTestId("register.gross_input"), "12.5");
    await user.type(
      within(sheet).getByTestId("register.seal_input"),
      "TYV-99001",
    );
    await user.click(within(sheet).getByTestId("register.submit_button"));

    // The new lot appears in the register view, marked as demo data. The
    // freshly sealed block is also expanded via the `?lot=` deep link, so the
    // id is printed by both the collapsed header and the expanded panel; the
    // library section is the register view, so assert it there.
    await waitFor(() => {
      const library = screen.getByTestId("home.library_section");
      expect(
        within(library).getAllByText("JOA-MFB-20260921-0001").length,
      ).toBeGreaterThan(0);
    });

    // Nothing reached the canister: demo registration is browser-only.
    expect(holder.actor.registerLot).not.toHaveBeenCalled();
  });

  it("shows no demo-mode lots after a reload in live mode", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <>
        <AppHeader />
        <HomePage />
      </>,
    );

    await user.click(screen.getByTestId("header.demo_button"));
    await screen.findByTestId("register.demo_notice");
    await user.click(await screen.findByTestId("header.register_lot_button"));

    const sheet = await screen.findByTestId("register.sheet");
    await waitFor(() => {
      expect(within(sheet).getByTestId("register.id_input")).toHaveValue(
        "JOA-MFB-20260921-0001",
      );
    });
    await user.type(within(sheet).getByTestId("register.gross_input"), "12.5");
    await user.type(
      within(sheet).getByTestId("register.seal_input"),
      "TYV-99001",
    );
    await user.click(within(sheet).getByTestId("register.submit_button"));
    // The sealed block lands in the register view (and is expanded, so the id
    // is printed twice within the library section).
    await waitFor(() => {
      const library = screen.getByTestId("home.library_section");
      expect(
        within(library).getAllByText("JOA-MFB-20260921-0001").length,
      ).toBeGreaterThan(0);
    });
    unmount();

    // A reload returns to Real-time mode with only the live register's lots.
    window.localStorage.setItem("explor8-data-mode", "live");
    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    });
    expect(screen.queryByText("JOA-MFB-20260921-0001")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("register.demo_notice"),
    ).not.toBeInTheDocument();
  });
});
