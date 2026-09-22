import { ActorRoleTable } from "@/components/admin/ActorRoleTable";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { RegisterStats } from "@/components/library/RegisterStats";
import { fakePrincipal, seedLots, seedSummary } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The responsive contract of the register's main surfaces.
 *
 * The acceptance criteria require the library, the expanded lot block and the
 * admin panel to reflow for phone and tablet with no horizontal overflow or
 * clipped controls. jsdom has no layout engine, so these tests assert the
 * structural contract the components own: a mobile-first single column that
 * widens at the `md`/`xl` breakpoints, wrapping control rows, and an
 * `overflow-x-auto` wrapper around any table wider than a phone. A real 360px
 * or 768px viewport is not measured here.
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

describe("Library grid responsive contract", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is a single column on a phone and widens at md and xl", () => {
    renderWithProviders(
      <LibraryGrid
        lots={seedLots()}
        expandedId={null}
        onToggle={vi.fn()}
        onOpenLot={vi.fn()}
        canAppend={false}
        photoUrls={{}}
        childrenByParent={{}}
      />,
    );

    const grid = screen.getByTestId("register.library_grid");
    const classes = grid.className;
    // Mobile-first: one column by default, two on a tablet, three on desktop.
    expect(classes).toContain("grid-cols-1");
    expect(classes).toContain("md:grid-cols-2");
    expect(classes).toContain("xl:grid-cols-3");
  });

  it("gives each collapsed block a full-width tap target with no fixed width", () => {
    renderWithProviders(
      <LibraryGrid
        lots={seedLots()}
        expandedId={null}
        onToggle={vi.fn()}
        onOpenLot={vi.fn()}
        canAppend={false}
        photoUrls={{}}
        childrenByParent={{}}
      />,
    );

    const openButton = screen.getByTestId("lot.open_button.1");
    // Full width, so the whole row is a tap target on a phone.
    expect(openButton.className).toContain("w-full");
    // The block's own content wraps rather than overflowing.
    const wrapping = Array.from(openButton.querySelectorAll("*")).filter(
      (node) =>
        typeof node.className === "string" &&
        node.className.includes("flex-wrap"),
    );
    expect(wrapping.length).toBeGreaterThan(0);
    // No fixed pixel width that could exceed a 360px viewport.
    expect(openButton.className).not.toMatch(/\bw-\[\d+px\]/u);
  });

  it("spans the expanded block across the full grid at every breakpoint", () => {
    renderWithProviders(
      <LibraryGrid
        lots={seedLots()}
        expandedId={seedLots()[0].id}
        onToggle={vi.fn()}
        onOpenLot={vi.fn()}
        canAppend={false}
        photoUrls={{}}
        childrenByParent={{}}
      />,
    );

    const expanded = screen.getByTestId("lot.item.1");
    // The open block takes the whole row rather than one narrow column.
    expect(expanded.className).toContain("md:col-span-2");
    expect(expanded.className).toContain("xl:col-span-3");
  });
});

describe("Register stats responsive contract", () => {
  it("stacks into two columns on a phone and four on a tablet", () => {
    renderWithProviders(
      <RegisterStats summary={seedSummary()} visibleCount={3} totalCount={3} />,
    );

    const stats = screen.getByTestId("register.stats");
    expect(stats.className).toContain("grid-cols-2");
    expect(stats.className).toContain("md:grid-cols-4");
  });
});

describe("Admin role table responsive contract", () => {
  it("wraps a wide table in a horizontal scroll container", () => {
    renderWithProviders(
      <ActorRoleTable
        actors={[{ principal: fakePrincipal("aaaaa-aa"), role: Role.admin }]}
        isLoading={false}
        selfPrincipal={null}
        onEdit={vi.fn()}
      />,
    );

    const wrapper = screen.getByTestId("admin.actors_table");
    // A table wider than a phone scrolls inside its own container rather than
    // pushing the page into horizontal overflow.
    expect(wrapper.className).toContain("overflow-x-auto");
  });

  it("keeps the change-role control on one line so it is never clipped", () => {
    renderWithProviders(
      <ActorRoleTable
        actors={[{ principal: fakePrincipal("aaaaa-aa"), role: Role.admin }]}
        isLoading={false}
        selfPrincipal={null}
        onEdit={vi.fn()}
      />,
    );

    const button = screen.getByTestId("admin.change_role_button.1");
    expect(button.className).toContain("whitespace-nowrap");
  });
});
