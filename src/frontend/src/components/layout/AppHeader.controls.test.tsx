import { AppHeader } from "@/components/layout/AppHeader";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The header's accessible control contract and pinned surface.
 *
 * The accepted request reworks the header layout so the identity region can
 * never be overlapped by the control cluster, and keeps the masthead pinned.
 * That rework may move or restructure the controls, so this file characterizes
 * the adjacent behaviour that must survive it and is not asserted elsewhere:
 *
 *  - the text-size control announces its current step to assistive technology
 *    and reports the default state through `aria-pressed`;
 *  - the two control groups keep their accessible group labels;
 *  - the pinned masthead keeps its opaque surface, hairline and stacking above
 *    the animated field.
 *
 * The current overlap-prone geometry is intentionally NOT asserted here; this
 * file protects adjacent working behaviour only. jsdom has no layout engine, so
 * the surface/stacking assertions are structural class checks, not pixels.
 *
 * The actor is a typed local mock, so this proves the header's own markup,
 * never the canister.
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

describe("App header control contract and pinned surface", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    window.localStorage.clear();
    document.documentElement.style.fontSize = "";
  });

  it("labels the text-size and data-mode control groups for assistive technology", () => {
    renderWithProviders(<AppHeader />);

    expect(
      screen.getByRole("group", { name: /text size/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /register data source/i }),
    ).toBeInTheDocument();
  });

  it("announces the current text-size step and reports the default through aria-pressed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    // The default step is 100% at index 1 of 5.
    const announcement = screen.getByTestId("header.text_size_value");
    expect(announcement).toHaveTextContent("Text size 100% (step 2 of 5)");
    expect(announcement).toHaveAttribute("aria-live", "polite");

    const reset = screen.getByRole("button", {
      name: /reset text size to default/i,
    });
    expect(reset).toHaveAttribute("aria-pressed", "true");

    // Stepping up moves the announcement and clears the default state.
    await user.click(
      screen.getByRole("button", { name: /increase text size/i }),
    );

    await waitFor(() => {
      expect(announcement).toHaveTextContent("Text size 112.5% (step 3 of 5)");
    });
    expect(reset).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the pinned masthead opaque and stacked above the animated field", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const classes = header?.className ?? "";
    // Opaque card surface and a hairline, so scrolled content cannot show
    // through the pinned bar.
    expect(classes).toContain("bg-card");
    expect(classes).toContain("border-b");
    // Stacked above the field and the page content while pinned.
    expect(classes).toContain("z-30");
    expect(classes).toContain("above-field");
  });

  it("keeps the wordmark on the display typeface", () => {
    renderWithProviders(<AppHeader />);

    const wordmark = screen.getByText("Explor8");
    expect(wordmark.className).toContain("font-display");
  });
});
