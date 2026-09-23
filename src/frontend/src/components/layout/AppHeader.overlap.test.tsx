import { AppHeader } from "@/components/layout/AppHeader";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The header's title/subtitle overlap fix.
 *
 * The accepted request requires the 'Explor8' wordmark and the full
 * 'A product of Jewel of Africa' subtitle to stay fully visible and never be
 * overlapped, clipped or hidden behind the header control buttons at any
 * viewport width or text-size step, and requires the header to stay pinned to
 * the top while the page scrolls.
 *
 * jsdom has no layout engine, so no test here measures real pixel geometry.
 * These tests assert the structural contract the rework introduces — the
 * identity region and the control cluster each claim their own full-width row
 * (`basis-full`), so the controls can never share a row with the wordmark; the
 * identity region stays a shrinkable flex child; and the subtitle sizes against
 * the viewport rather than a container — which is what keeps the title clear of
 * the controls. The actual overlap at a given width or text-size step is NOT
 * exercised here.
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

/** The identity region: the ancestor of the wordmark that is a direct child of the header shell. */
function identityRegion(container: HTMLElement): Element {
  const region = container.querySelector(".header-identity");
  expect(region).not.toBeNull();
  return region as Element;
}

describe("App header title/subtitle overlap fix", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    window.localStorage.clear();
    document.documentElement.style.fontSize = "";
  });

  it("gives the identity region its own full-width row", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The rework makes the identity region a `basis-full` item, so it ALWAYS
    // claims its own row and the control cluster can never share a row with it
    // or compete for its width. The region is deliberately NOT a size
    // container: the subtitle sizes against the viewport, not the region.
    const region = identityRegion(container);
    expect(region.className).toContain("header-identity");
    expect(region.className).toContain("basis-full");
  });

  it("lets the identity region shrink and give width back to the controls", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // `min-w-0` lets the region shrink instead of pushing the controls over the
    // wordmark; `flex-1` on mobile claims the full row so the subtitle has the
    // whole width to scale into; `md:flex-none` stops it growing on desktop.
    const region = identityRegion(container);
    expect(region.className).toContain("min-w-0");
    expect(region.className).toContain("flex-1");
    expect(region.className).toContain("md:flex-none");
  });

  it("gives the control cluster its own full-width row that wraps rather than overflows", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The control cluster is the sibling of the identity region. It also claims
    // a `basis-full` row, so it wraps onto the row(s) below the identity and
    // can never push the wordmark off the edge; `min-w-0` and `flex-wrap` let
    // its own controls reflow instead of overflowing at a narrow width.
    const region = identityRegion(container);
    const cluster = region.nextElementSibling;
    expect(cluster).not.toBeNull();
    expect(cluster?.className).toContain("basis-full");
    expect(cluster?.className).toContain("min-w-0");
    expect(cluster?.className).toContain("flex-wrap");
  });

  it("moves the licence reminder out of the control cluster onto its own row", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The reminder used to sit inside the control cluster, where its 20rem
    // column competed with the identity region for horizontal space and
    // squeezed the subtitle into a clip. It is now a sibling of the cluster on
    // its own full-width wrapped row, so it can never crowd the wordmark.
    const region = identityRegion(container);
    const cluster = region.nextElementSibling;
    expect(cluster).not.toBeNull();

    const reminder = screen.getByText(/Licence reminder:/i);
    expect(cluster?.contains(reminder)).toBe(false);
    // It is a direct child of the shell, after the cluster, and claims a full
    // row from `md` up so it wraps beneath the identity and controls.
    expect(reminder.parentElement).toBe(cluster?.parentElement);
    expect(reminder.className).toContain("md:basis-full");
  });

  it("sizes the subtitle against the viewport and never clips it", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    // The single-line, viewport-relative sizing contract is carried by the
    // stylesheet class; jsdom does not apply it, so assert the class is present
    // and that no truncation utility would clip the line.
    expect(subtitle?.className).toContain("header-subtitle");
    expect(subtitle?.className).not.toContain("truncate");
    expect(subtitle?.className).not.toContain("overflow-hidden");
  });

  it("keeps the subtitle's single-line contract structural, not just white-space", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The line is a flex row of two spans; the stylesheet sets `flex-wrap:
    // nowrap` on `.header-subtitle`, so it can never break between 'A product
    // of' and 'JEWEL OF AFRICA'. jsdom does not apply the stylesheet, so assert
    // the structural shape the rule depends on: exactly the two spans, with the
    // brand half carrying its own accent class.
    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    const spans = subtitle?.querySelectorAll("span");
    expect(spans?.length).toBe(2);
    expect(spans?.[0].className).not.toContain("subtitle-brand");
    expect(spans?.[1].className).toContain("subtitle-brand");
  });

  it("keeps the wordmark and full subtitle visible while the page scrolls", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The header is pinned to the top edge and sits above the animated field,
    // so it stays visible as the page scrolls beneath it.
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const classes = header?.className ?? "";
    expect(classes).toContain("sticky");
    expect(classes).toContain("top-0");
    expect(classes).toContain("above-field");

    // The title and the complete subtitle are still rendered in the pinned bar.
    expect(screen.getByText("Explor8")).toBeInTheDocument();
    const subtitle = container.querySelector(".header-subtitle");
    expect(
      subtitle?.querySelector("span:not(.subtitle-brand)")?.textContent,
    ).toBe("A product of");
    expect(subtitle?.querySelector(".subtitle-brand")?.textContent).toBe(
      "Jewel of Africa",
    );
  });

  it("keeps the title and subtitle out of every control at the largest text-size step", () => {
    // The largest step scales every rem-based size, which is the worst case for
    // the controls crowding the identity. The structural separation must hold.
    window.localStorage.setItem("explor8-text-size", "4");
    const { container } = renderWithProviders(<AppHeader />);

    const title = screen.getByText("Explor8");
    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();

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
});
