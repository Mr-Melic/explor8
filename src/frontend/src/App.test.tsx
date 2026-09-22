import App from "@/App";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The app shell's default route.
 *
 * The acceptance criteria require the app to load without a blank screen on
 * the default route. Every other suite renders a page or component directly,
 * so this is the only test that mounts the real `App` — its router, header,
 * library and footer together — and proves the default route actually paints.
 *
 * The actor and identity are local typed mocks, so this proves the shell's
 * composition, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
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

describe("App shell", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
  });

  it("paints the default route with the header, library and footer", async () => {
    // `App` builds its own router over the real browser history, so it is
    // rendered directly rather than through the shared provider helper.
    const { container } = render(<App />);

    // The shell is not blank: the header wordmark and subtitle are present.
    // The router resolves its first match asynchronously, so the first query
    // waits for the shell to paint.
    expect(await screen.findByText("Explor8")).toBeInTheDocument();
    // The subtitle is split into a muted lead and an accent brand span so
    // 'JEWEL OF AFRICA' can be highlighted; both halves are present.
    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    expect(
      subtitle?.querySelector("span:not(.subtitle-brand)")?.textContent,
    ).toBe("A product of");
    expect(subtitle?.querySelector(".subtitle-brand")?.textContent).toBe(
      "Jewel of Africa",
    );

    // The default route is the Library, not an empty outlet. The accepted
    // request renamed the section heading to 'Asset Registry Explorer'.
    expect(
      screen.getByRole("heading", { name: /Asset Registry Explorer/i }),
    ).toBeInTheDocument();

    // The register's own lots render through the real router.
    await waitFor(() => {
      expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    });

    // The footer closes the shell.
    expect(
      screen.getByText(
        /Public register of sealed lots\. Records are append-only\./i,
      ),
    ).toBeInTheDocument();

    // Something was actually mounted into the document.
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
