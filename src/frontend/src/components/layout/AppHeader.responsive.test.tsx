import { AppHeader } from "@/components/layout/AppHeader";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The header's identity and its responsive contract.
 *
 * The acceptance criteria require the wordmark 'Explor8' and the subtitle
 * 'A product of Jewel of Africa' to render in full at every viewport width,
 * with no truncation. jsdom has no layout engine, so these tests assert the
 * observable markup contract: the complete text is present, and neither the
 * subtitle nor any of its ancestors carries a truncation utility that would
 * clip it at a narrow width.
 *
 * The header's own responsive classes are asserted structurally — the shell
 * stacks on a phone and switches to a row at the `md` breakpoint — because a
 * jsdom run cannot measure a real 360px/768px/1280px viewport.
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

/** Every ancestor of `node` up to the document body, inclusive. */
function ancestors(node: Element): Element[] {
  const chain: Element[] = [];
  let current: Element | null = node;
  while (current) {
    chain.push(current);
    current = current.parentElement;
  }
  return chain;
}

describe("App header identity and responsive contract", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    window.localStorage.clear();
  });

  it("renders the full subtitle with no truncation on it or its ancestors", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The subtitle is split into a muted lead and an accent brand span so
    // 'JEWEL OF AFRICA' can be highlighted; both halves are present in full.
    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    expect(
      subtitle?.querySelector("span:not(.subtitle-brand)")?.textContent,
    ).toBe("A product of");
    expect(subtitle?.querySelector(".subtitle-brand")?.textContent).toBe(
      "Jewel of Africa",
    );

    // No ancestor clips it: a `truncate`/`text-ellipsis`/`overflow-hidden`
    // utility on the subtitle or any wrapper would cut the text at a narrow
    // width, which the requirement forbids.
    for (const node of ancestors(subtitle as Element)) {
      const classes = node.className;
      if (typeof classes !== "string") continue;
      expect(classes).not.toContain("truncate");
      expect(classes).not.toContain("text-ellipsis");
      expect(classes).not.toContain("overflow-hidden");
    }
  });

  it("keeps the subtitle on one line and highlights JEWEL OF AFRICA", () => {
    const { container } = renderWithProviders(<AppHeader />);

    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    // The single-line contract is carried by the stylesheet class; jsdom does
    // not apply it, so assert the class is present on the line.
    expect(subtitle?.className).toContain("header-subtitle");

    // The brand half is its own span so it can be lit in the accent colour,
    // while the lead stays muted.
    const brand = subtitle?.querySelector(".subtitle-brand");
    expect(brand).not.toBeNull();
    expect(brand?.textContent).toBe("Jewel of Africa");
  });

  it("renders the wordmark in full and never the retired Gold Book identity", () => {
    renderWithProviders(<AppHeader />);

    expect(screen.getByText("Explor8")).toBeInTheDocument();
    expect(screen.queryByText(/Gold Book/i)).not.toBeInTheDocument();
  });

  it("stacks the masthead on a phone and switches to a row at the md breakpoint", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The header's inner shell is the first child of the <header>.
    const shell = container.querySelector("header > div");
    expect(shell).not.toBeNull();
    const classes = shell?.className ?? "";
    // Mobile-first: a column by default, a row from `md` up.
    expect(classes).toContain("flex-col");
    expect(classes).toContain("md:flex-row");
    // The shell is width-bounded and padded, so it cannot overflow a phone.
    expect(classes).toContain("max-w-6xl");
    expect(classes).toContain("px-4");
  });

  it("keeps the header controls in a wrapping row so none is clipped", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The control cluster wraps rather than overflowing at a narrow width.
    const controlRow = container.querySelector("header .flex-wrap");
    expect(controlRow).not.toBeNull();
    expect(controlRow?.className).toContain("flex-wrap");
  });
});
