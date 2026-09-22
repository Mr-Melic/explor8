import { StatusPill } from "@/components/lot/StatusPill";
import { RefKind } from "@/lib/backend";
import type { RefEntryView } from "@/lib/backend";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The status stamp's label-resolution mechanism.
 *
 * The accepted requirement renames several status display terms, and those
 * names live in the register's admin-managed reference data. This suite pins
 * the mechanism the rename relies on rather than any particular term: an
 * administrator's stored display name wins over the built-in fallback, and a
 * status the register has no entry for still renders a readable humanized
 * token. Neither assertion names a status term that the rename changes.
 *
 * The actor is a typed local mock, so this proves the frontend's contract with
 * the reference catalogue, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
  return mockCoreInfrastructure({ actor: holder.actor });
});

function statusEntry(key: string, displayName: string): RefEntryView {
  return {
    id: `ref-${key}`,
    kind: RefKind.status,
    key,
    displayName,
    value: key,
    sortOrder: 1n,
    active: true,
  };
}

describe("Status pill label resolution", () => {
  beforeEach(() => {
    holder.actor.listReferenceEntries.mockReset();
    holder.actor.listReferenceEntries.mockResolvedValue([]);
  });

  it("renders the administrator's stored display name for a status key", async () => {
    holder.actor.listReferenceEntries.mockImplementation(
      async (kind: RefKind) =>
        kind === RefKind.status
          ? [statusEntry("open", "Operator's own wording")]
          : [],
    );

    renderWithProviders(<StatusPill status="open" />);

    await waitFor(() => {
      expect(screen.getByTestId("lot.status_pill")).toHaveTextContent(
        "Operator's own wording",
      );
    });
  });

  it("humanizes a status the reference catalogue does not carry", async () => {
    renderWithProviders(<StatusPill status="in_transit" />);

    // With no stored entry, the key is humanized rather than shown raw.
    await waitFor(() => {
      expect(screen.getByTestId("lot.status_pill")).toHaveTextContent(
        "In transit",
      );
    });
  });

  it("always renders a single status stamp element", async () => {
    renderWithProviders(<StatusPill status="assayed" />);

    const pill = await screen.findByTestId("lot.status_pill");
    expect(pill.tagName).toBe("SPAN");
    expect(pill.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it.each([
    ["open", "Recently Mined"],
    ["assayed", "Testing Quality"],
    ["closed", "Applied for crafting"],
    ["frozen", "Confiscated by Authorities"],
  ])(
    "falls back to the accepted display term for %s",
    async (status, label) => {
      // No stored reference entry, so the built-in fallback is what shows.
      renderWithProviders(<StatusPill status={status} />);

      await waitFor(() => {
        expect(screen.getByTestId("lot.status_pill")).toHaveTextContent(label);
      });
    },
  );
});
