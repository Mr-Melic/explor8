import { RegisterLotPanel } from "@/components/lot/RegisterLotPanel";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The register-lot drawer's responsive contract.
 *
 * The acceptance criteria require the register-lot drawer to reflow for phone
 * and tablet with no horizontal overflow or clipped controls. jsdom has no
 * layout engine, so these tests assert the structural contract the drawer owns:
 * full width on a phone, bounded from `sm` up, its own vertical scroll, a
 * single-column field grid that widens at `sm`, and full-width phone actions.
 * A real 360px or 768px viewport is not measured here.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedReferenceByKind } = await import("@/test/fixtures");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor({
    suggestedId: "JOA-MFB-20260921-0001",
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

/** Every element under `root` whose class list contains `needle`. */
function withClass(root: ParentNode, needle: string): Element[] {
  return Array.from(root.querySelectorAll("*")).filter((node) =>
    typeof node.className === "string"
      ? node.className.includes(needle)
      : false,
  );
}

function renderPanel() {
  return renderWithProviders(
    <RegisterLotPanel open onOpenChange={vi.fn()} onRegistered={vi.fn()} />,
  );
}

describe("Register-lot drawer responsive contract", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("takes the full width on a phone and caps at a tablet width", () => {
    renderPanel();

    const sheet = screen.getByTestId("register.sheet");
    // Full width on a phone, bounded from `sm` up so it never overflows.
    expect(sheet.className).toContain("w-full");
    expect(sheet.className).toContain("sm:max-w-xl");
    // The drawer scrolls its own content rather than clipping it.
    expect(sheet.className).toContain("overflow-y-auto");
  });

  it("stacks the form fields and actions on a phone", () => {
    renderPanel();

    const sheet = screen.getByTestId("register.sheet");
    // The field grid is one column by default and two from `sm` up.
    const fieldGrid = withClass(sheet, "sm:grid-cols-2")[0];
    expect(fieldGrid).toBeDefined();
    expect(fieldGrid?.className).toContain("grid");

    // The action row stacks on a phone and aligns right on a tablet.
    const actionRow = withClass(sheet, "sm:flex-row")[0];
    expect(actionRow).toBeDefined();
    expect(actionRow?.className).toContain("flex-col");
  });

  it("gives the submit and cancel controls full-width phone targets", () => {
    renderPanel();

    for (const ocid of ["register.submit_button", "register.cancel_button"]) {
      const control = screen.getByTestId(ocid);
      expect(control.className).toContain("w-full");
      expect(control.className).toContain("sm:w-auto");
    }
  });
});
