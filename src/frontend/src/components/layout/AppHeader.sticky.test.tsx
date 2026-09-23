import { AppHeader } from "@/components/layout/AppHeader";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The header's pinning and identity/control separation.
 *
 * The accepted request requires the masthead to stay pinned to the top of the
 * screen while the page scrolls, and requires the 'Explor8' wordmark and the
 * full 'A product of Jewel of Africa' subtitle to remain fully visible and
 * never covered by a header control at any width or text-size step.
 *
 * jsdom has no layout engine, so these tests characterize the structural
 * contract the fix must preserve rather than measuring pixels:
 *
 *  - the <header> carries the sticky pinning utilities and the `.above-field`
 *    stacking opt-in, so it stays at the top above the animated field;
 *  - the wordmark and subtitle live in their own identity region, a sibling of
 *    the control cluster, so no control is an ancestor of the title text;
 *  - the control cluster wraps instead of overflowing its row.
 *
 * The current overlap-prone shrink behaviour is intentionally NOT asserted as
 * correct here; this file protects the adjacent working behaviour only.
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

/** The nearest ancestor of `node` that is a direct child of the <header>. */
function headerRegion(node: Element, header: Element): Element | null {
  let current: Element | null = node;
  while (current && current.parentElement !== header) {
    current = current.parentElement;
  }
  return current;
}

describe("App header pinning and identity separation", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    window.localStorage.clear();
  });

  it("pins the masthead to the top of the viewport above the animated field", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const classes = header?.className ?? "";
    // Sticky at the top edge, so it stays visible while the page scrolls.
    expect(classes).toContain("sticky");
    expect(classes).toContain("top-0");
    // Above the fixed diamond field, which sits at -z-10.
    expect(classes).toContain("above-field");
    // Opaque surface, so scrolled content cannot show through the pinned bar.
    expect(classes).toContain("bg-card");
  });

  it("keeps the wordmark and full subtitle outside the control cluster", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const title = screen.getByText("Explor8");
    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();

    // The title and subtitle share one identity region...
    const titleRegion = headerRegion(title, header as Element);
    const subtitleRegion = headerRegion(subtitle as Element, header as Element);
    expect(titleRegion).not.toBeNull();
    expect(titleRegion).toBe(subtitleRegion);

    // ...and no header control is an ancestor of the title text, so a control
    // cannot structurally cover the wordmark.
    const controls = [
      screen.getByTestId("header.data_mode_toggle"),
      screen.getByTestId("header.text_size_control"),
      screen.getByTestId("theme.toggle"),
      screen.getByTestId("header.sign_in_button"),
    ];
    for (const control of controls) {
      expect(control.contains(title)).toBe(false);
      expect(control.contains(subtitle as Element)).toBe(false);
    }
  });

  it("renders the complete subtitle text in its own region", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    // Both halves of the line are present in full, so the identity is never
    // reduced to a fragment when the controls are laid out beside it.
    expect(
      subtitle?.querySelector("span:not(.subtitle-brand)")?.textContent,
    ).toBe("A product of");
    expect(subtitle?.querySelector(".subtitle-brand")?.textContent).toBe(
      "Jewel of Africa",
    );
  });

  it("lets the control cluster wrap rather than overflow its row", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The cluster that holds the controls wraps, so a narrow viewport or a
    // larger text-size step reflows the controls instead of pushing them over
    // the identity region.
    const controlRow = container.querySelector("header .flex-wrap");
    expect(controlRow).not.toBeNull();
    expect(controlRow?.className).toContain("flex-wrap");
  });

  it("keeps the header as the first region of the shell so content scrolls beneath it", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    // The header is the first element in its container, so nothing renders
    // above it and the sticky bar owns the top edge.
    expect(header?.previousElementSibling).toBeNull();
  });
});
