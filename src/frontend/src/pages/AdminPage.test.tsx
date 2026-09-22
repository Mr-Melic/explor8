import { AdminPage } from "@/pages/AdminPage";
import { renderWithRouter } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";
import { fakePrincipal, seedLots, seedReferenceEntries } from "@/test/fixtures";

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

describe("Admin page", () => {
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

  it("asks a signed-out visitor to sign in and locks every admin section", async () => {
    renderWithRouter(<AdminPage />, "/admin");

    expect(
      await screen.findByTestId("admin.signed_out_state"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sign in with Internet Identity to see the role assigned to you/i,
      ),
    ).toBeInTheDocument();

    // Every section is present but locked for a visitor with no role.
    expect(screen.getByTestId("admin.analytics_section")).toBeInTheDocument();
    expect(screen.getByTestId("admin.documents_section")).toBeInTheDocument();
    expect(screen.getByTestId("admin.roles_section")).toBeInTheDocument();
    expect(screen.getByTestId("admin.reference_section")).toBeInTheDocument();

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

    // No admin-only panel is rendered for a visitor with no role.
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
    expect(
      screen.queryByTestId("admin.bootstrap_section"),
    ).not.toBeInTheDocument();
  });

  it("shows a signed-in non-admin their role but keeps every section locked", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.field_officer);
    renderWithRouter(<AdminPage />, "/admin");

    await waitFor(() => {
      expect(screen.getByTestId("admin.principal")).toHaveTextContent(
        "aaaaa-aa",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("auth.role_badge")).toHaveTextContent(
        "Field officer",
      );
    });

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
    expect(screen.queryByTestId("admin.roles_panel")).not.toBeInTheDocument();
  });

  it("gives an administrator the analytics, documents, roles and reference panels", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    holder.actor.listActors.mockResolvedValue({
      __kind__: "ok",
      ok: [
        { principal: fakePrincipal("aaaaa-aa"), role: Role.admin },
        { principal: fakePrincipal("bbbbb-bb"), role: Role.assayer },
      ],
    });
    holder.actor.listLots.mockResolvedValue(seedLots());
    holder.actor.listAllReferenceEntries.mockResolvedValue({
      __kind__: "ok",
      ok: seedReferenceEntries(),
    });
    holder.actor.registerAnalytics.mockResolvedValue({
      __kind__: "ok",
      ok: {
        totalLots: 3n,
        totalEvents: 7n,
        lotsOverTime: [{ day: "20260918", lots: 2n, events: 5n }],
        eventsOverTime: [],
        byKind: [{ key: "gold", count: 2n }],
        byStatus: [{ key: "assayed", count: 1n }],
        bySite: [{ key: "MFB", count: 2n }],
      },
    });

    renderWithRouter(<AdminPage />, "/admin");

    // Analytics: the register's own figures, read in full.
    await waitFor(() => {
      expect(screen.getByTestId("admin.analytics_panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("admin.analytics_totals")).toHaveTextContent(
      "Lots sealed",
    );
    expect(screen.getByTestId("admin.analytics_kind")).toHaveTextContent(
      "Gold",
    );

    // Documents: the upload form plus the empty state when nothing is stored.
    await waitFor(() => {
      expect(screen.getByTestId("admin.documents_panel")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("admin.document_upload_form"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByTestId("admin.documents_empty_state"),
      ).toBeInTheDocument();
    });

    // Roles: the actor table, the signed-in admin's own row, and the freeze control.
    await waitFor(() => {
      expect(screen.getByTestId("admin.roles_panel")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("admin.actors_table")).toBeInTheDocument();
    });
    expect(screen.getByTestId("admin.actor_row.1")).toBeInTheDocument();
    expect(screen.getByTestId("admin.actor_row.2")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByTestId("admin.freeze_panel")).toBeInTheDocument();

    // Reference data: one editable block per catalogue kind.
    await waitFor(() => {
      expect(screen.getByTestId("admin.reference_panel")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("admin.reference_block.lot_kind"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.reference_block.site"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.reference_block.status"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.reference_block.event_kind"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.reference_block.caption"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.reference_block.form_default"),
    ).toBeInTheDocument();
    // The seeded lot-kind block lists exactly Emerald and Gold.
    expect(
      screen.getByTestId("admin.reference_row.lot_kind.1"),
    ).toHaveTextContent("emerald");
    expect(
      screen.getByTestId("admin.reference_row.lot_kind.2"),
    ).toHaveTextContent("gold");
  });

  it("offers the claim-admin bootstrap only while no administrator exists", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(null);
    holder.actor.hasAdmin.mockResolvedValue(false);
    holder.actor.listActors.mockResolvedValue({ __kind__: "ok", ok: [] });

    renderWithRouter(<AdminPage />, "/admin");

    await waitFor(() => {
      expect(screen.getByTestId("admin.claim_card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("admin.claim_admin_button")).toBeInTheDocument();
  });

  it("offers the claim-admin bootstrap to a signed-in guest-role identity while no admin exists", async () => {
    // The register answers `guest` — not `null` — for a principal it has never
    // assigned a role, so `awaitingRole` is false for exactly the identity the
    // bootstrap exists for. The gate must key on `hasAdmin`, not `awaitingRole`.
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.hasAdmin.mockResolvedValue(false);

    renderWithRouter(<AdminPage />, "/admin");

    await waitFor(() => {
      expect(screen.getByTestId("admin.claim_card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("admin.claim_admin_button")).toBeInTheDocument();
  });

  it("withdraws the claim-admin bootstrap from a guest-role identity once an admin exists", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.hasAdmin.mockResolvedValue(true);

    renderWithRouter(<AdminPage />, "/admin");

    // Wait for the hasAdmin query to settle before asserting absence.
    await waitFor(() => {
      expect(holder.actor.hasAdmin).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("admin.claim_card")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.bootstrap_section"),
    ).not.toBeInTheDocument();
  });

  it("withdraws the claim-admin bootstrap once an administrator exists", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(null);
    holder.actor.hasAdmin.mockResolvedValue(true);

    renderWithRouter(<AdminPage />, "/admin");

    // Wait for the hasAdmin query to settle before asserting absence.
    await waitFor(() => {
      expect(holder.actor.hasAdmin).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("admin.claim_card")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.bootstrap_section"),
    ).not.toBeInTheDocument();
  });

  it("does not offer the claim-admin bootstrap to a signed-out visitor", async () => {
    renderWithRouter(<AdminPage />, "/admin");

    expect(
      await screen.findByTestId("admin.signed_out_state"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("admin.claim_card")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.bootstrap_section"),
    ).not.toBeInTheDocument();
  });
});
