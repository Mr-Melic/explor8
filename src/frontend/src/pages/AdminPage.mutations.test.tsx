import { AdminPage } from "@/pages/AdminPage";
import { renderWithRouter } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefKind, Role } from "@/lib/backend";
import type { AnalysisDocumentView, RefEntryView } from "@/lib/backend";
import {
  SEED_HASH_47,
  fakePrincipal,
  seedReferenceEntries,
} from "@/test/fixtures";

/**
 * The admin panel's write journeys.
 *
 * `AdminPage.test.tsx` proves the panel's sections render and are gated on the
 * administrator role. This file drives the mutations the acceptance criteria
 * name: adding, changing and removing a role assignment, and adding, editing
 * and removing a reference-data entry. The actor is a typed local mock, so
 * these prove the frontend's contract with the register, never the canister.
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

const ADMIN = "aaaaa-aa";
const OTHER = "bbbbb-bb";

function adminActor() {
  holder.identity.principal = ADMIN;
  holder.actor.getMyRole.mockResolvedValue(Role.admin);
}

function referenceEntry(overrides: Partial<RefEntryView> = {}): RefEntryView {
  return {
    id: "ref-1",
    kind: RefKind.lot_kind,
    key: "emerald",
    displayName: "Emerald",
    value: "emerald",
    sortOrder: 1n,
    active: true,
    ...overrides,
  };
}

function analysisDocument(
  overrides: Partial<AnalysisDocumentView> = {},
): AnalysisDocumentView {
  return {
    id: "doc-1",
    title: "Fire-assay certificate AF-9921",
    docKind: "Assay report",
    note: "Covers the MFB lots.",
    fileId: "file-1",
    contentHash: SEED_HASH_47,
    uploadedAt: 1_758_153_600_000_000_000n,
    uploadedBy: fakePrincipal(ADMIN),
    ...overrides,
  };
}

describe("Admin panel write journeys", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.listActors.mockReset();
    holder.actor.listActors.mockResolvedValue({ __kind__: "ok", ok: [] });
    holder.actor.assignRole.mockReset();
    holder.actor.assignRole.mockResolvedValue({
      __kind__: "ok",
      ok: { principal: fakePrincipal(OTHER), role: Role.assayer },
    });
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
      ok: seedReferenceEntries(),
    });
    holder.actor.addReferenceEntry.mockReset();
    holder.actor.addReferenceEntry.mockResolvedValue({
      __kind__: "ok",
      ok: referenceEntry(),
    });
    holder.actor.updateReferenceEntry.mockReset();
    holder.actor.updateReferenceEntry.mockResolvedValue({
      __kind__: "ok",
      ok: referenceEntry(),
    });
    holder.actor.removeReferenceEntry.mockReset();
    holder.actor.removeReferenceEntry.mockResolvedValue({
      __kind__: "ok",
      ok: null,
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

  it("assigns a role to a principal that is not in the actor list yet", async () => {
    const user = userEvent.setup();
    adminActor();
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.roles_panel");
    await user.click(screen.getByTestId("admin.add_role_button"));

    // The add dialog parses the pasted principal before the role is chosen.
    // `aaaaa-aa` is a valid principal text, so `Principal.fromText` accepts it.
    await user.type(
      await screen.findByTestId("admin.add_principal_input"),
      "aaaaa-aa",
    );
    await user.click(screen.getByTestId("admin.add_principal_continue_button"));

    // The shared assign dialog opens with the parsed principal.
    const dialog = await screen.findByTestId("admin.assign_role_dialog");
    expect(within(dialog).getByText(/aaaaa-aa/)).toBeInTheDocument();

    await user.click(screen.getByTestId("admin.assign_role_select"));
    // The accepted request renamed the role's display label: the role stored
    // as `assayer` now reads 'Quality Tester'.
    await user.click(
      await screen.findByRole("option", { name: "Quality Tester" }),
    );
    await user.click(screen.getByTestId("admin.assign_role_confirm_button"));

    await waitFor(() => {
      expect(holder.actor.assignRole).toHaveBeenCalledTimes(1);
    });
    const [target, role] = holder.actor.assignRole.mock.calls[0];
    expect(target.toString()).toBe("aaaaa-aa");
    expect(role).toBe(Role.assayer);
  });

  it("rejects a malformed principal before calling the register", async () => {
    const user = userEvent.setup();
    adminActor();
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.roles_panel");
    await user.click(screen.getByTestId("admin.add_role_button"));
    await user.type(
      await screen.findByTestId("admin.add_principal_input"),
      "not-a-principal",
    );
    await user.click(screen.getByTestId("admin.add_principal_continue_button"));

    expect(
      await screen.findByTestId("admin.add_principal_error_state"),
    ).toHaveTextContent(/not a valid principal/i);
    expect(holder.actor.assignRole).not.toHaveBeenCalled();
  });

  it("changes an existing role assignment from the actor table", async () => {
    const user = userEvent.setup();
    adminActor();
    holder.actor.listActors.mockResolvedValue({
      __kind__: "ok",
      ok: [
        { principal: fakePrincipal(ADMIN), role: Role.admin },
        { principal: fakePrincipal(OTHER), role: Role.field_officer },
      ],
    });
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.actors_table");
    // The second row is the other actor; change its role to the role stored as
    // `workshop`, which the accepted request now displays as 'Custom Role'.
    await user.click(screen.getByTestId("admin.change_role_button.2"));

    const dialog = await screen.findByTestId("admin.assign_role_dialog");
    expect(within(dialog).getByText(/bbbbb-bb/)).toBeInTheDocument();

    await user.click(screen.getByTestId("admin.assign_role_select"));
    await user.click(
      await screen.findByRole("option", { name: "Custom Role" }),
    );
    await user.click(screen.getByTestId("admin.assign_role_confirm_button"));

    await waitFor(() => {
      expect(holder.actor.assignRole).toHaveBeenCalledTimes(1);
    });
    const [target, role] = holder.actor.assignRole.mock.calls[0];
    expect(target.toString()).toBe(OTHER);
    expect(role).toBe(Role.workshop);
  });

  it("removes a role assignment by returning the principal to guest", async () => {
    const user = userEvent.setup();
    adminActor();
    holder.actor.listActors.mockResolvedValue({
      __kind__: "ok",
      ok: [
        { principal: fakePrincipal(ADMIN), role: Role.admin },
        { principal: fakePrincipal(OTHER), role: Role.assayer },
      ],
    });
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.actors_table");
    await user.click(screen.getByTestId("admin.change_role_button.2"));

    await screen.findByTestId("admin.assign_role_dialog");
    await user.click(screen.getByTestId("admin.assign_role_select"));
    await user.click(
      await screen.findByRole("option", { name: "Guest reader" }),
    );
    await user.click(screen.getByTestId("admin.assign_role_confirm_button"));

    await waitFor(() => {
      expect(holder.actor.assignRole).toHaveBeenCalledTimes(1);
    });
    const [target, role] = holder.actor.assignRole.mock.calls[0];
    expect(target.toString()).toBe(OTHER);
    expect(role).toBe(Role.guest);
  });

  it("adds a reference-data entry through the block's form", async () => {
    const user = userEvent.setup();
    adminActor();
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.reference_block.lot_kind");
    await user.click(screen.getByTestId("admin.reference_add_button.lot_kind"));

    await user.type(
      await screen.findByTestId("admin.reference_key_input.lot_kind"),
      "platinum",
    );
    await user.type(
      screen.getByTestId("admin.reference_name_input.lot_kind"),
      "Platinum",
    );
    await user.type(
      screen.getByTestId("admin.reference_value_input.lot_kind"),
      "platinum",
    );
    await user.click(
      screen.getByTestId("admin.reference_save_button.lot_kind"),
    );

    await waitFor(() => {
      expect(holder.actor.addReferenceEntry).toHaveBeenCalledTimes(1);
    });
    expect(holder.actor.addReferenceEntry.mock.calls[0][0]).toMatchObject({
      kind: RefKind.lot_kind,
      key: "platinum",
      displayName: "Platinum",
      value: "platinum",
    });
  });

  it("edits an existing reference-data entry", async () => {
    const user = userEvent.setup();
    adminActor();
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.reference_row.lot_kind.1");
    await user.click(
      screen.getByTestId("admin.reference_edit_button.lot_kind.1"),
    );

    const nameInput = await screen.findByTestId(
      "admin.reference_name_input.lot_kind",
    );
    // The edit form is prefilled from the entry being changed.
    expect(nameInput).toHaveValue("Emerald");
    await user.clear(nameInput);
    await user.type(nameInput, "Emerald (rough)");
    await user.click(
      screen.getByTestId("admin.reference_save_button.lot_kind"),
    );

    await waitFor(() => {
      expect(holder.actor.updateReferenceEntry).toHaveBeenCalledTimes(1);
    });
    expect(holder.actor.updateReferenceEntry.mock.calls[0][0]).toMatchObject({
      id: "ref-1",
      displayName: "Emerald (rough)",
    });
  });

  it("removes a reference-data entry only after confirmation", async () => {
    const user = userEvent.setup();
    adminActor();
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.reference_row.lot_kind.1");
    await user.click(
      screen.getByTestId("admin.reference_remove_button.lot_kind.1"),
    );

    // The first click only asks for confirmation; nothing is removed yet.
    expect(holder.actor.removeReferenceEntry).not.toHaveBeenCalled();
    await user.click(
      await screen.findByTestId(
        "admin.reference_confirm_remove_button.lot_kind.1",
      ),
    );

    await waitFor(() => {
      expect(holder.actor.removeReferenceEntry).toHaveBeenCalledWith("ref-1");
    });
  });

  it("removes a stored analysis document", async () => {
    const user = userEvent.setup();
    adminActor();
    holder.actor.listAnalysisDocuments.mockResolvedValue({
      __kind__: "ok",
      ok: [analysisDocument()],
    });
    holder.actor.removeAnalysisDocument.mockReset();
    holder.actor.removeAnalysisDocument.mockResolvedValue({
      __kind__: "ok",
      ok: null,
    });
    renderWithRouter(<AdminPage />, "/admin");

    await screen.findByTestId("admin.document_row.1");
    await user.click(screen.getByTestId("admin.document_remove_button.1"));

    await waitFor(() => {
      expect(holder.actor.removeAnalysisDocument).toHaveBeenCalledWith("doc-1");
    });
  });

  it("lists the stored analysis documents with their sealed hash", async () => {
    adminActor();
    holder.actor.listAnalysisDocuments.mockResolvedValue({
      __kind__: "ok",
      ok: [
        analysisDocument(),
        analysisDocument({
          id: "doc-2",
          title: "Kafubu grade spreadsheet",
          docKind: "Spreadsheet",
          note: "",
        }),
      ],
    });
    renderWithRouter(<AdminPage />, "/admin");

    const list = await screen.findByTestId("admin.documents_list");
    expect(within(list).getAllByTestId(/^admin\.document_row\./)).toHaveLength(
      2,
    );
    expect(
      within(list).getByText("Fire-assay certificate AF-9921"),
    ).toBeInTheDocument();
    expect(
      within(list).getByText("Kafubu grade spreadsheet"),
    ).toBeInTheDocument();
    // The row shows the shortened content hash, not the full 64 characters.
    const hash = within(list).getByTestId("admin.document_hash.1");
    expect(hash.textContent?.length).toBeLessThan(64);
    expect(hash).toHaveAttribute("title", SEED_HASH_47);
    // The empty state is gone once documents exist.
    expect(
      screen.queryByTestId("admin.documents_empty_state"),
    ).not.toBeInTheDocument();
  });
});
