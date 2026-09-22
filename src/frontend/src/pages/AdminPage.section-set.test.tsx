import { AdminPage } from "@/pages/AdminPage";
import { renderWithRouter } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The admin panel's section set.
 *
 * The accepted request adds an enquiry inbox to the admin panel. That is an
 * ADDITION: every section the panel already had must survive it, and the
 * panel's role gating must not loosen. This file characterizes the section set
 * and the gating contract without naming any copy the request changes.
 *
 * It asserts only the section markers and the locked/panel split, so the new
 * inbox can be inserted anywhere without disturbing this baseline.
 *
 * The actor is a typed local mock, so this proves the frontend's composition
 * and gating, never the canister's own authorization.
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

/** Every section the panel already carried, in the order it renders them. */
const EXISTING_SECTIONS = [
  "admin.identity_section",
  "admin.analytics_section",
  "admin.documents_section",
  "admin.roles_section",
  "admin.permissions_section",
  "admin.reference_section",
  "admin.purge_section",
];

describe("Admin panel section set", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.hasAdmin.mockReset();
    holder.actor.hasAdmin.mockResolvedValue(false);
    holder.actor.listActors.mockReset();
    holder.actor.listActors.mockResolvedValue({ __kind__: "ok", ok: [] });
    holder.actor.listLots.mockReset();
    holder.actor.listLots.mockResolvedValue([]);
    holder.actor.listAnalysisDocuments.mockReset();
    holder.actor.listAnalysisDocuments.mockResolvedValue({
      __kind__: "ok",
      ok: [],
    });
    holder.actor.listAllReferenceEntries.mockReset();
    holder.actor.listAllReferenceEntries.mockResolvedValue({
      __kind__: "ok",
      ok: [],
    });
    holder.actor.registerAnalytics.mockReset();
    holder.actor.registerAnalytics.mockResolvedValue({
      __kind__: "ok",
      ok: {
        totalLots: 0n,
        totalEvents: 0n,
        lotsOverTime: [],
        eventsOverTime: [],
        byKind: [],
        byStatus: [],
        bySite: [],
      },
    });
  });

  it("keeps every existing section for a signed-out visitor", async () => {
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.signed_out_state");
    for (const marker of EXISTING_SECTIONS) {
      expect(screen.getByTestId(marker)).toBeInTheDocument();
    }
  });

  it("keeps every existing section for an administrator", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    renderWithRouter(<AdminPage />, "/admin");

    await waitFor(() => {
      expect(screen.getByTestId("admin.analytics_panel")).toBeInTheDocument();
    });
    for (const marker of EXISTING_SECTIONS) {
      expect(screen.getByTestId(marker)).toBeInTheDocument();
    }
  });

  it("keeps the admin-only panels locked for a signed-out visitor", async () => {
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.signed_out_state");
    // The gating contract is unchanged: a visitor with no role sees the locked
    // states and none of the admin-only panels.
    expect(
      screen.getByTestId("admin.analytics_locked_state"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.documents_locked_state"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("admin.actors_locked_state")).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.reference_locked_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.analytics_panel"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.documents_panel"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.roles_panel")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.reference_panel"),
    ).not.toBeInTheDocument();
  });

  it("keeps the back link to the register on the panel", async () => {
    renderWithRouter(<AdminPage />, "/admin");

    const back = await screen.findByTestId("admin.back_link");
    expect(back).toHaveAttribute("href", "/");
  });
});
