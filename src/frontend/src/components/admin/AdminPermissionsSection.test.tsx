import { AdminPermissionsSection } from "@/components/admin/AdminPermissionsSection";
import type { PermissionsView } from "@/lib/backend";
import { Capability, Role } from "@/lib/backend";
import {
  ALL_CAPABILITIES,
  ASSIGNABLE_ROLES,
  capabilityLabel,
} from "@/lib/permissions";
import { fakePrincipal } from "@/test/fixtures";
import type { MockActor } from "@/test/mock-actor";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The permissions section: role defaults, the renamed role labels and
 * per-principal overrides.
 *
 * The accepted request renamed the `assayer` role to 'Quality Tester' and the
 * `workshop` role to 'Custom Role', and added a permissions matrix an
 * administrator edits. These tests pin the renamed headers and the matrix's
 * write contract — a toggle sends the role's full capability list, not a delta.
 *
 * The actor is a typed local mock, so this proves the frontend's contract with
 * the register, never the canister's own authorization.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as MockActor,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
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

function permissionsView(): PermissionsView {
  return {
    roleDefaults: [
      { role: Role.admin, capabilities: [Capability.manage_roles] },
      { role: Role.assayer, capabilities: [Capability.change_status] },
      { role: Role.workshop, capabilities: [] },
    ],
    capabilities: [],
    overrides: [
      {
        principal: fakePrincipal("ccccc-cc"),
        role: Role.assayer,
        capabilities: [Capability.change_status],
      },
    ],
  };
}

describe("Admin permissions section", () => {
  beforeEach(() => {
    holder.actor.getMyCapabilities.mockReset();
    holder.actor.getMyCapabilities.mockResolvedValue([Capability.manage_roles]);
    holder.actor.getPermissions.mockReset();
    holder.actor.getPermissions.mockResolvedValue({
      __kind__: "ok",
      ok: permissionsView(),
    });
    holder.actor.updateRolePermissions.mockReset();
    holder.actor.updateRolePermissions.mockResolvedValue({
      __kind__: "ok",
      ok: { role: Role.workshop, capabilities: [Capability.change_status] },
    });
    holder.actor.removePrincipalOverride.mockReset();
    holder.actor.removePrincipalOverride.mockResolvedValue({
      __kind__: "ok",
      ok: null,
    });
  });

  it("locks the section for a caller who is not an administrator", async () => {
    renderWithProviders(<AdminPermissionsSection canAdminister={false} />);

    expect(
      await screen.findByTestId("admin.permissions_locked_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.permissions_panel"),
    ).not.toBeInTheDocument();
  });

  it("tells an administrator without the manage-roles capability that permissions are read-only", async () => {
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    renderWithProviders(<AdminPermissionsSection canAdminister />);

    expect(
      await screen.findByTestId("admin.permissions_denied_state"),
    ).toHaveTextContent(/read-only/i);
    expect(
      screen.queryByTestId("admin.permissions_panel"),
    ).not.toBeInTheDocument();
  });

  it("renders the renamed role labels as matrix column headers", async () => {
    renderWithProviders(<AdminPermissionsSection canAdminister />);

    const table = await screen.findByTestId("admin.permissions_table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    // The accepted request renamed `assayer` and `workshop`; the old labels
    // must not appear anywhere in the matrix.
    expect(headers).toContain("Quality Tester");
    expect(headers).toContain("Custom Role");
    expect(headers).not.toContain("Assayer");
    expect(headers).not.toContain("Workshop");
  });

  it("lists every capability with a per-role checkbox matrix", async () => {
    renderWithProviders(<AdminPermissionsSection canAdminister />);

    const table = await screen.findByTestId("admin.permissions_table");

    // Every capability the app offers is a row, in the register's display
    // order, so the matrix is the complete permission surface.
    const rows = within(table).getAllByTestId(/^admin\.permission_row\./);
    expect(rows).toHaveLength(ALL_CAPABILITIES.length);
    // The accepted request added the `delete_lot` capability, so the matrix
    // now lists twelve rows rather than the eleven it listed before.
    expect(ALL_CAPABILITIES).toHaveLength(12);
    expect(ALL_CAPABILITIES).toContain(Capability.delete_lot);
    for (const capability of ALL_CAPABILITIES) {
      expect(
        within(table).getByText(capabilityLabel(capability)),
      ).toBeInTheDocument();
    }

    // Each row carries one editable checkbox per assignable role, so an admin
    // can toggle any capability for any role.
    for (const [index, capability] of ALL_CAPABILITIES.entries()) {
      for (const role of ASSIGNABLE_ROLES) {
        const toggle = within(table).getByTestId(
          `admin.permission_toggle.${index + 1}.${role}`,
        );
        expect(toggle).toHaveAttribute("aria-pressed");
        expect(toggle.getAttribute("aria-label")).toContain(
          capabilityLabel(capability),
        );
      }
    }
  });

  it("writes a role's full capability list when a matrix cell is toggled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPermissionsSection canAdminister />);

    // Row 1 is "Register a lot"; the workshop column starts with no
    // capabilities, so toggling it on must send exactly that one capability.
    const toggle = await screen.findByTestId(
      `admin.permission_toggle.1.${Role.workshop}`,
    );
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    await waitFor(() => {
      expect(holder.actor.updateRolePermissions).toHaveBeenCalledWith({
        role: Role.workshop,
        capabilities: [Capability.create_lot],
      });
    });
  });

  it("lists a principal override and removes it after confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPermissionsSection canAdminister />);

    const row = await screen.findByTestId("admin.override_row.1");
    expect(row).toHaveTextContent("Quality Tester");
    expect(row).toHaveTextContent("Change a lot's status");

    await user.click(screen.getByTestId("admin.override_remove_button.1"));
    await user.click(
      screen.getByTestId("admin.override_confirm_remove_button.1"),
    );

    await waitFor(() => {
      expect(holder.actor.removePrincipalOverride).toHaveBeenCalledTimes(1);
    });
  });
});
