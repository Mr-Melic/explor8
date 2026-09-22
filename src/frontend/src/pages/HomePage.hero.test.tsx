import { HomePage } from "@/pages/HomePage";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The home hero paragraph.
 *
 * The accepted request replaced the hero copy verbatim with the supplied text
 * and renamed the term "provenance" to "Precious Material Origin History"
 * everywhere in the UI. This is the one place the exact wording is asserted, so
 * a later edit that paraphrases, truncates or reintroduces the retired term
 * fails here rather than shipping.
 *
 * The actor is a typed local mock, so this proves the rendered copy, never the
 * canister.
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

/** The supplied hero text, exactly as the hero must render it. */
const HERO_TEXT =
  "From extraction to verification, every precious metal and gemstone mined by Jewel of Africa is weighed, tested, and sealed as a unique block in this registry. Each block bears a cryptographic hash of its recorded data and supporting files, with every subsequent event added to its chain of custody. History unfolds downward, preserving a traceable record of Precious Material Origin History, integrity, and accountability; from the earth to the registry.";

describe("Home hero paragraph", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
  });

  it("renders the supplied hero text verbatim", async () => {
    renderWithProviders(<HomePage />);

    // The paragraph is matched by its full text, so any paraphrase, dropped
    // clause or reordered sentence fails the assertion.
    const hero = await screen.findByText(HERO_TEXT);
    expect(hero).toBeInTheDocument();
    expect(hero.textContent).toBe(HERO_TEXT);
  });

  it("replaces the retired term with Precious Material Origin History", async () => {
    renderWithProviders(<HomePage />);

    await screen.findByText(HERO_TEXT);
    // The accepted request retires the word "provenance" from the UI entirely.
    expect(document.body.textContent?.toLowerCase()).not.toContain(
      "provenance",
    );
    expect(
      screen.getByRole("heading", {
        name: /Precious Material Origin History register/i,
      }),
    ).toBeInTheDocument();
  });
});
