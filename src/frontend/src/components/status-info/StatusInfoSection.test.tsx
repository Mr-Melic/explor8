import { StatusInfoSection } from "@/components/status-info/StatusInfoSection";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Capability, RefKind } from "@/lib/backend";
import type { RefEntryView } from "@/lib/backend";
import { seedReferenceByKind } from "@/test/fixtures";

/**
 * The home page's per-status information section.
 *
 * The accepted request adds a section that is hidden by default and folds open
 * one status at a time via 'CLICK HERE TO UNDERSTAND THIS STATUS'. The
 * explanation texts are reference data (`RefKind.status_explanation`) that an
 * administrator can edit and save inline.
 *
 * The actor is a typed local mock, so this proves the section's own behaviour
 * and its contract with the reference-data endpoint, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
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

/** One stored status explanation, as the register returns it. */
function explanation(
  key: string,
  displayName: string,
  value: string,
  sortOrder: number,
): RefEntryView {
  return {
    id: `expl-${key}`,
    kind: RefKind.status_explanation,
    key,
    displayName,
    value,
    sortOrder: BigInt(sortOrder),
    active: true,
  };
}

function seedWithExplanations(): Partial<Record<RefKind, RefEntryView[]>> {
  return {
    ...seedReferenceByKind(),
    [RefKind.status_explanation]: [
      explanation(
        "open",
        "Recently Mined",
        "Freshly mined and not yet tested.",
        1,
      ),
      explanation(
        "assayed",
        "Testing Quality",
        "At the lab for quality testing.",
        2,
      ),
    ],
  };
}

describe("Status information section", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue("guest");
    holder.actor.getMyCapabilities.mockReset();
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    holder.actor.listReferenceEntries.mockReset();
    holder.actor.listReferenceEntries.mockImplementation(
      async (kind: RefKind) => seedWithExplanations()[kind] ?? [],
    );
    holder.actor.updateReferenceEntry.mockReset();
    holder.actor.updateReferenceEntry.mockResolvedValue({
      __kind__: "ok",
      ok: explanation("open", "Recently Mined", "Updated text.", 1),
    });
  });

  it("is collapsed on first load with one fold-out control per status", async () => {
    renderWithProviders(<StatusInfoSection />);

    expect(
      await screen.findByTestId("home.status_info_section"),
    ).toBeInTheDocument();

    // Every status the register carries gets its own control, all collapsed.
    const toggles = await screen.findAllByRole("button", {
      name: /CLICK HERE TO UNDERSTAND THIS STATUS/i,
    });
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
    // No explanation panel is mounted while collapsed.
    expect(
      screen.queryByTestId("home.status_info_panel.1"),
    ).not.toBeInTheDocument();
  });

  it("expands only the clicked status and collapses the previous one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusInfoSection />);

    const first = await screen.findByTestId("home.status_info_toggle.1");
    const second = screen.getByTestId("home.status_info_toggle.2");

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "false");
    expect(
      await screen.findByTestId("home.status_info_panel.1"),
    ).toBeInTheDocument();

    // Opening another status collapses the first: only one is open at a time.
    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByTestId("home.status_info_panel.1"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByTestId("home.status_info_panel.2"),
    ).toBeInTheDocument();
  });

  it("shows the stored explanation text for a status", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusInfoSection />);

    await user.click(await screen.findByTestId("home.status_info_toggle.1"));

    const panel = await screen.findByTestId("home.status_info_panel.1");
    expect(
      within(panel).getByText("Freshly mined and not yet tested."),
    ).toBeInTheDocument();
  });

  it("offers no inline edit affordance to a non-admin reader", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusInfoSection />);

    await user.click(await screen.findByTestId("home.status_info_toggle.1"));

    expect(
      screen.queryByTestId("home.status_info_edit_button.1"),
    ).not.toBeInTheDocument();
  });

  it("lets an admin edit and save a status explanation through the reference endpoint", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyCapabilities.mockResolvedValue([
      Capability.manage_reference_data,
    ]);

    renderWithProviders(<StatusInfoSection />);

    await user.click(await screen.findByTestId("home.status_info_toggle.1"));
    await user.click(
      await screen.findByTestId("home.status_info_edit_button.1"),
    );

    const textarea = await screen.findByTestId("home.status_info_textarea.1");
    await user.clear(textarea);
    await user.type(textarea, "Updated explanation text.");
    await user.click(screen.getByTestId("home.status_info_save_button.1"));

    await waitFor(() => {
      expect(holder.actor.updateReferenceEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "expl-open",
          value: "Updated explanation text.",
        }),
      );
    });
  });
});
