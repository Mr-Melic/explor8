import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateRolePermissions } from "@/hooks/use-admin-data";
import type { Capability, Role, RolePermissions } from "@/lib/backend";
import {
  ALL_CAPABILITIES,
  ASSIGNABLE_ROLES,
  capabilityLabel,
  roleLabel,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";
import { useState } from "react";

interface PermissionsMatrixProps {
  /** The default capability set for every role, from `getPermissions`. */
  roleDefaults: RolePermissions[];
  /** Whether the signed-in principal may change role defaults. */
  editable: boolean;
}

const SKELETON_IDS = Array.from(
  { length: 6 },
  (_, index) => `permission-skeleton-${index}`,
);

/**
 * Every app capability against every role, one row per capability.
 *
 * A cell shows whether the role holds the capability by default. When the
 * caller may administer, each cell is a toggle that writes the role's full
 * capability list back through `updateRolePermissions`, so the register's
 * defaults stay the single source of truth.
 */
export function PermissionsMatrix({
  roleDefaults,
  editable,
}: PermissionsMatrixProps) {
  const updateRolePermissions = useUpdateRolePermissions();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  const defaultsByRole = new Map<Role, Set<Capability>>();
  for (const entry of roleDefaults) {
    defaultsByRole.set(entry.role, new Set(entry.capabilities));
  }

  function toggle(role: Role, capability: Capability) {
    const current = defaultsByRole.get(role) ?? new Set<Capability>();
    const next = new Set(current);
    if (next.has(capability)) {
      next.delete(capability);
    } else {
      next.add(capability);
    }
    setPendingRole(role);
    updateRolePermissions.mutate(
      { role, capabilities: [...next] },
      { onSettled: () => setPendingRole(null) },
    );
  }

  if (roleDefaults.length === 0) {
    return (
      <div
        className="mt-3 space-y-2"
        data-ocid="admin.permissions_loading_state"
      >
        {SKELETON_IDS.map((id) => (
          <Skeleton key={id} className="h-12 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="overflow-x-auto rounded-sm border border-border"
        data-ocid="admin.permissions_table"
      >
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              <th scope="col" className="micro-label px-4 py-3">
                Capability
              </th>
              {ASSIGNABLE_ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="micro-label px-3 py-3 text-center"
                >
                  {roleLabel(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_CAPABILITIES.map((capability, rowIndex) => (
              <tr
                key={capability}
                className="border-t border-border bg-card transition-quick hover:bg-muted/40"
                data-ocid={`admin.permission_row.${rowIndex + 1}`}
              >
                <th
                  scope="row"
                  className="px-4 py-3 text-left text-base font-normal text-foreground"
                >
                  {capabilityLabel(capability)}
                </th>
                {ASSIGNABLE_ROLES.map((role) => {
                  const held =
                    defaultsByRole.get(role)?.has(capability) ?? false;
                  const isPending =
                    updateRolePermissions.isPending && pendingRole === role;

                  return (
                    <td key={role} className="px-3 py-3 text-center">
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => toggle(role, capability)}
                          disabled={updateRolePermissions.isPending}
                          aria-pressed={held}
                          aria-label={`${capabilityLabel(capability)} for ${roleLabel(role)}: ${held ? "allowed" : "not allowed"}`}
                          data-ocid={`admin.permission_toggle.${rowIndex + 1}.${role}`}
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-sm border transition-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                            held
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-border bg-background text-muted-foreground hover:border-accent/60",
                            isPending && "opacity-60",
                          )}
                        >
                          {held ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <Minus className="size-4" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex size-8 items-center justify-center rounded-sm border",
                            held
                              ? "border-accent/50 text-accent"
                              : "border-border text-muted-foreground",
                          )}
                          data-ocid={`admin.permission_cell.${rowIndex + 1}.${role}`}
                        >
                          {held ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <Minus className="size-4" aria-hidden="true" />
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {updateRolePermissions.isError ? (
        <p
          className="text-base text-destructive"
          data-ocid="admin.permissions_error_state"
        >
          {updateRolePermissions.error instanceof Error
            ? updateRolePermissions.error.message
            : "The role's permissions could not be saved."}
        </p>
      ) : null}
    </div>
  );
}
