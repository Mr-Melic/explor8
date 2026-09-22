import { PermissionsMatrix } from "@/components/admin/PermissionsMatrix";
import { PrincipalOverridesTable } from "@/components/admin/PrincipalOverridesTable";
import { useMyCapabilities, usePermissions } from "@/hooks/use-admin-data";
import { Capability } from "@/lib/backend";
import { ShieldAlert } from "lucide-react";

interface AdminPermissionsSectionProps {
  /** Whether the signed-in principal may view and change permissions. */
  canAdminister: boolean;
}

/**
 * Permissions: every app capability and who may perform it.
 *
 * The section renders only for a signed-in administrator. `canAdminister` is
 * the role-derived gate the admin panel already applies; the backend's
 * `getMyCapabilities` is the authority for the effective permission, so the
 * section also requires the `manage_roles` capability before it offers any
 * editing control.
 */
export function AdminPermissionsSection({
  canAdminister,
}: AdminPermissionsSectionProps) {
  const { data: myCapabilities } = useMyCapabilities(canAdminister);
  const canManagePermissions =
    canAdminister && (myCapabilities ?? []).includes(Capability.manage_roles);

  const {
    data: permissions,
    isLoading,
    isError,
  } = usePermissions(canManagePermissions);

  if (!canAdminister) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.permissions_locked_state"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-base leading-relaxed text-muted-foreground">
            Only an administrator can view and change permissions. Ask an
            administrator to grant you access.
          </p>
        </div>
      </div>
    );
  }

  if (!canManagePermissions) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.permissions_denied_state"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-base leading-relaxed text-muted-foreground">
            Your account does not hold the "Manage roles and access" capability,
            so permissions are read-only for you. Ask another administrator to
            grant it.
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.permissions_error_state"
      >
        <p className="text-base text-destructive">
          The permissions could not be read. Reload the page to try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-6" data-ocid="admin.permissions_panel">
      <section data-ocid="admin.permissions_matrix_section">
        <h3 className="font-display text-lg tracking-tight text-foreground md:text-xl">
          Role defaults
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every capability against every role. Administrators hold all
          capabilities by default; the Custom Role starts with none. Toggle a
          cell to change what a role may do.
        </p>
        <div className="mt-3">
          {isLoading || !permissions ? (
            <PermissionsMatrix roleDefaults={[]} editable={false} />
          ) : (
            <PermissionsMatrix
              roleDefaults={permissions.roleDefaults}
              editable
            />
          )}
        </div>
      </section>

      <section data-ocid="admin.overrides_section">
        <h3 className="font-display text-lg tracking-tight text-foreground md:text-xl">
          Principal overrides
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Give one principal a capability set that differs from their role's
          defaults, or remove an override to return them to the role default.
        </p>
        <div className="mt-3">
          {isLoading || !permissions ? (
            <PrincipalOverridesTable overrides={[]} editable={false} />
          ) : (
            <PrincipalOverridesTable
              overrides={permissions.overrides}
              editable
            />
          )}
        </div>
      </section>
    </div>
  );
}
