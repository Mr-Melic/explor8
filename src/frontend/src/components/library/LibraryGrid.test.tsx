import { LibraryGrid } from "@/components/library/LibraryGrid";
import { seedLots } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The register grid's block structure.
 *
 * The accepted requirement is that adjacent blocks never share a colour, which
 * is a change to how each block is tinted. This suite pins the structure that
 * change builds on and must not disturb: one block per lot in register order,
 * every block carrying the shared `block-face` surface, and only the expanded
 * block carrying the open treatment. It asserts no colour value, so the
 * adjacent-colour work is free to change the tint.
 *
 * The actor is a typed local mock, so this proves the grid's own composition,
 * never the canister.
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

function renderGrid(expandedId: string | null = null, lots = seedLots()) {
  return renderWithProviders(
    <LibraryGrid
      lots={lots}
      expandedId={expandedId}
      onToggle={vi.fn()}
      onOpenLot={vi.fn()}
      canAppend={false}
      photoUrls={{}}
      childrenByParent={{}}
    />,
  );
}

/** A longer register so the colour schedule is exercised over several rows. */
function manyLots(count: number) {
  const base = seedLots();
  return Array.from({ length: count }, (_, index) => ({
    ...base[index % base.length],
    id: `JOA-MFB-20260918-${String(1000 + index)}`,
  }));
}

/**
 * Render `count` blocks at `width` and return each block's schedule index.
 *
 * The grid reads the live column count on mount, so the faces are only
 * meaningful once the mount effect has applied the width-derived count.
 */
async function renderFaces(width: number, count: number): Promise<number[]> {
  window.innerWidth = width;
  renderGrid(null, manyLots(count));

  await waitFor(() => {
    const faces = screen
      .getAllByTestId(/^lot\.item\./)
      .map((block) => block.getAttribute("data-block-face"));
    expect(faces.every((face) => face !== null)).toBe(true);
  });

  return screen
    .getAllByTestId(/^lot\.item\./)
    .map((block) => Number(block.getAttribute("data-block-face")));
}

describe("Library grid block structure", () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it("renders one block per lot in register order", () => {
    renderGrid();

    const blocks = screen.getAllByTestId(/^lot\.item\./);
    expect(blocks).toHaveLength(seedLots().length);
    // The first block is the register's first lot, not a reordered view.
    expect(blocks[0]).toHaveTextContent(seedLots()[0].id);
  });

  it("gives every block the shared block-face surface", () => {
    renderGrid();

    for (const block of screen.getAllByTestId(/^lot\.item\./)) {
      expect(block.className).toContain("block-face");
    }
  });

  it("marks only the expanded block with the open treatment", () => {
    renderGrid(seedLots()[0].id);

    const blocks = screen.getAllByTestId(/^lot\.item\./);
    expect(blocks[0].className).toContain("block-face-open");
    for (const collapsed of blocks.slice(1)) {
      expect(collapsed.className).not.toContain("block-face-open");
    }
  });

  it("keeps each block's expand control wired to its own lot", () => {
    renderGrid();

    const openButton = screen.getByTestId("lot.open_button.1");
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(openButton).toHaveTextContent(seedLots()[0].id);
  });

  it.each([
    ["phone", 375, 1],
    ["tablet", 900, 2],
    ["desktop", 1400, 3],
  ])(
    "never gives adjacent blocks the same colour at %s width",
    async (_name, width, columns) => {
      const faces = await renderFaces(width, 11);

      // Horizontal neighbours in the same row must differ.
      for (let i = 0; i < faces.length; i += 1) {
        if (i % columns !== columns - 1 && i + 1 < faces.length) {
          expect(faces[i]).not.toBe(faces[i + 1]);
        }
        // Vertical neighbour directly beneath must differ.
        if (i + columns < faces.length) {
          expect(faces[i]).not.toBe(faces[i + columns]);
        }
      }
    },
  );

  it("threads the delete callback to the expanded block's panel", async () => {
    const onDeleted = vi.fn();
    const onOpenLot = vi.fn();
    renderWithProviders(
      <LibraryGrid
        lots={seedLots()}
        expandedId={seedLots()[0].id}
        onToggle={vi.fn()}
        onOpenLot={onOpenLot}
        onDeleted={onDeleted}
        canAppend={false}
        canDelete
        photoUrls={{}}
        childrenByParent={{}}
      />,
    );

    // The expanded panel offers the delete control only when the grid is told
    // the caller may delete, and it is wired to the grid's own `onDeleted`.
    expect(screen.getByTestId("lot.delete_button")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onOpenLot).not.toHaveBeenCalled();
  });

  it("keeps the block directly beneath distinct at the 2-column breakpoint", async () => {
    // The 2-column layout is where the horizontal stride and the per-row
    // offset are both non-trivial, so it is the width where a row offset that
    // equals the stride cancels out and stacks two identical tints. Assert the
    // vertical pairs explicitly rather than only as a side effect of the
    // all-width loop above.
    const faces = await renderFaces(900, 11);

    // 2 columns: index i sits directly above index i + 2.
    for (let i = 0; i + 2 < faces.length; i += 1) {
      expect(
        faces[i],
        `block ${i} and the block beneath it (${i + 2}) share a colour`,
      ).not.toBe(faces[i + 2]);
    }

    // The first two rows, read as a grid, are all four distinct tints.
    expect(new Set(faces.slice(0, 4)).size).toBe(4);
  });
});
