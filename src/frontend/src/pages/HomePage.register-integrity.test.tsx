import { HomePage } from "@/pages/HomePage";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Capability, Role } from "@/lib/backend";

/**
 * Register integrity across blocks.
 *
 * The accepted request adds admin-only single-block deletion. Whatever removes
 * one block must leave every other block and its chain of custody untouched, so
 * this file characterizes the invariants that must survive that change:
 *
 * - every block stays listed and independently readable;
 * - expanding one block never rewrites another block's own facts or events;
 * - lineage links still navigate between blocks;
 * - a reader without a writing role is offered no destructive control.
 *
 * The actor is a typed local mock, so this proves the frontend's rendering and
 * navigation contract, never the canister's own storage.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
  lots: [] as ReturnType<typeof import("@/test/fixtures").seedLots>,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedLots, seedReferenceByKind, seedSummary } = await import(
    "@/test/fixtures"
  );
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.lots = seedLots();
  holder.actor = createMockActor({
    lots: holder.lots,
    summary: seedSummary(),
    referenceEntries: seedReferenceByKind(),
  });
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

function resetUrl() {
  window.history.replaceState(null, "", "/");
}

describe("Register integrity across blocks", () => {
  beforeEach(() => {
    resetUrl();
    window.localStorage.clear();
    holder.identity.principal = null;
    holder.actor.listLots.mockReset();
    holder.actor.listLots.mockResolvedValue(holder.lots);
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.getMyCapabilities.mockReset();
    holder.actor.getMyCapabilities.mockResolvedValue([]);
  });

  it("keeps every block listed when one block is expanded", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    // Opening one block does not remove or replace any other block.
    expect(screen.getByTestId("lot.item.1")).toBeInTheDocument();
    expect(screen.getByTestId("lot.item.2")).toBeInTheDocument();
    expect(screen.getByTestId("lot.item.3")).toBeInTheDocument();
    expect(screen.getByTestId("lot.item.2")).toHaveTextContent(
      "JOA-MFB-20260918-0048",
    );
    expect(screen.getByTestId("lot.item.3")).toHaveTextContent(
      "JOA-LUS-20260912-0003",
    );
  });

  it("shows only the opened block's own facts and events", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    const opened = screen.getByTestId("lot.item.1");
    // The first seed lot's own facts and events are shown...
    expect(within(opened).getByText("Mufumbwe / Kikonge")).toBeInTheDocument();
    expect(
      within(opened).getByText(
        "Independent fire-assay Au 4.1 g/t cert AF-9921",
      ),
    ).toBeInTheDocument();
    // ...and the third lot's own project and events are not leaked into it.
    expect(
      within(opened).queryByText("Lusaka workshop"),
    ).not.toBeInTheDocument();
    expect(
      within(opened).queryByText("Cut and polished at Bench B"),
    ).not.toBeInTheDocument();
  });

  it("leaves a sibling block's collapsed summary unchanged after another opens", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    const sibling = screen.getByTestId("lot.item.2");
    const before = sibling.textContent;

    await user.click(screen.getByTestId("lot.open_button.1"));

    // The sibling block's own rendered summary is byte-for-byte what it was.
    expect(screen.getByTestId("lot.item.2").textContent).toBe(before);
    expect(screen.getByTestId("lot.item.2")).toHaveAttribute(
      "data-ocid",
      "lot.item.2",
    );
  });

  it("navigates a lineage link from a child block to its parent block", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    // The second seed lot was split from the first, so its lineage names it.
    await screen.findByText("JOA-MFB-20260918-0048");
    await user.click(screen.getByTestId("lot.open_button.2"));

    const parentLink = await screen.findByTestId("lot.parent_link");
    expect(parentLink).toHaveTextContent("JOA-MFB-20260918-0047");

    await user.click(parentLink);

    // The parent block is now the expanded one, and the child stays listed.
    await waitFor(() => {
      expect(screen.getByTestId("lot.open_button.1")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
    expect(screen.getByTestId("lot.item.2")).toBeInTheDocument();
    expect(window.location.search).toContain("lot=JOA-MFB-20260918-0047");
  });

  it("offers a reader with no writing role no destructive control on an opened block", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    // A guest may read the block but is offered no delete affordance.
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
  });

  it("withholds the delete control from a signed-in non-admin role", async () => {
    const user = userEvent.setup();
    // A Quality Tester is signed in and may write, but does not hold the
    // `delete_lot` capability, so the destructive control must stay hidden.
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.assayer);
    holder.actor.getMyCapabilities.mockResolvedValue([Capability.append_event]);

    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    expect(screen.queryByTestId("lot.delete_button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lot.delete_section")).not.toBeInTheDocument();
  });

  it("lets an admin delete one block after typing the phrase, leaving the rest intact", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    holder.actor.getMyCapabilities.mockResolvedValue([Capability.delete_lot]);

    // The register drops the deleted block from its next listing, exactly as
    // the real canister would after `deleteLot`. The listing only changes once
    // the deletion has actually happened, so the pre-delete render still shows
    // all three blocks.
    const remaining = holder.lots.filter(
      (lot) => lot.id !== "JOA-MFB-20260918-0047",
    );
    let deleted = false;
    holder.actor.deleteLot.mockImplementation(async (lotId: string) => {
      deleted = true;
      return { __kind__: "ok", ok: lotId };
    });
    holder.actor.listLots.mockImplementation(async () =>
      deleted ? remaining : holder.lots,
    );

    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    // The admin sees the destructive control on the opened block.
    await user.click(await screen.findByTestId("lot.delete_button"));

    // The confirmation dialog gates the action on the exact phrase.
    const confirm = await screen.findByTestId("lot.delete_confirm_button");
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByTestId("lot.delete_phrase_input"),
      "DELETE BLOCK",
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(holder.actor.deleteLot).toHaveBeenCalledWith(
        "JOA-MFB-20260918-0047",
      );
    });

    // The deleted block is gone from the register...
    await waitFor(() => {
      expect(
        screen.queryByText("JOA-MFB-20260918-0047"),
      ).not.toBeInTheDocument();
    });
    // ...and the other blocks remain listed and readable.
    expect(screen.getByText("JOA-MFB-20260918-0048")).toBeInTheDocument();
    expect(screen.getByText("JOA-LUS-20260912-0003")).toBeInTheDocument();
  });

  it("closes the expanded view and clears the ?lot= deep link after a delete", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    holder.actor.getMyCapabilities.mockResolvedValue([Capability.delete_lot]);

    const remaining = holder.lots.filter(
      (lot) => lot.id !== "JOA-MFB-20260918-0047",
    );
    let deleted = false;
    holder.actor.deleteLot.mockImplementation(async (lotId: string) => {
      deleted = true;
      return { __kind__: "ok", ok: lotId };
    });
    holder.actor.listLots.mockImplementation(async () =>
      deleted ? remaining : holder.lots,
    );

    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("lot.open_button.1"));

    // Opening the block puts its id in the URL, so the view is shareable.
    await waitFor(() => {
      expect(window.location.search).toContain("lot=JOA-MFB-20260918-0047");
    });
    expect(screen.getByTestId("lot.open_button.1")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(await screen.findByTestId("lot.delete_button"));
    await user.type(
      screen.getByTestId("lot.delete_phrase_input"),
      "DELETE BLOCK",
    );
    await user.click(screen.getByTestId("lot.delete_confirm_button"));

    await waitFor(() => {
      expect(holder.actor.deleteLot).toHaveBeenCalledWith(
        "JOA-MFB-20260918-0047",
      );
    });

    // The expanded view closes rather than pointing at the removed block...
    await waitFor(() => {
      expect(
        screen.queryByTestId("lot.delete_section"),
      ).not.toBeInTheDocument();
    });
    // ...and no dangling `?lot=` deep link is left in the URL.
    await waitFor(() => {
      expect(window.location.search).not.toContain("lot=");
    });
    // The remaining blocks are still listed and can still be expanded. The
    // deleted block was first, so the survivors re-index: the second block is
    // now the emerald lot that was third before the delete.
    expect(screen.getByText("JOA-MFB-20260918-0048")).toBeInTheDocument();
    await user.click(screen.getByTestId("lot.open_button.2"));
    await waitFor(() => {
      expect(window.location.search).toContain("lot=JOA-LUS-20260912-0003");
    });
  });
});
