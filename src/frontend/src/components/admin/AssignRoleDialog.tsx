import { RoleBadge } from "@/components/auth/RoleBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignRole } from "@/hooks/use-register";
import type { Role } from "@/lib/backend";
import { shortenPrincipal } from "@/lib/format";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/permissions";
import type { Principal } from "@icp-sdk/core/principal";
import { useState } from "react";

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The actor whose role is being changed. */
  target: Principal | null;
  /** The role that actor currently holds. */
  currentRole: Role | null;
}

/**
 * Assign a role to one actor. The register is append-only, so this changes the
 * actor's authority — it never rewrites a lot or an event.
 */
export function AssignRoleDialog({
  open,
  onOpenChange,
  target,
  currentRole,
}: AssignRoleDialogProps) {
  const principalText = target?.toString() ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-sm border-border bg-card sm:max-w-md"
        data-ocid="admin.assign_role_dialog"
      >
        {target ? (
          <AssignRoleForm
            key={principalText}
            target={target}
            currentRole={currentRole}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface AssignRoleFormProps {
  target: Principal;
  currentRole: Role | null;
  onDone: () => void;
}

function AssignRoleForm({ target, currentRole, onDone }: AssignRoleFormProps) {
  const assignRole = useAssignRole();
  const [selected, setSelected] = useState<Role | null>(currentRole);
  const principalText = target.toString();
  const unchanged = selected !== null && selected === currentRole;

  function handleConfirm() {
    if (selected === null) return;
    assignRole.mutate(
      { target, role: selected },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl tracking-tight">
          Assign a role
        </DialogTitle>
        <DialogDescription className="text-base text-muted-foreground">
          The role decides what this principal may write to the register.
        </DialogDescription>
      </DialogHeader>

      <div className="min-w-0">
        <p className="micro-label">Principal</p>
        <p className="hash mt-1.5 break-all" title={principalText}>
          {shortenPrincipal(principalText, 10, 10)}
        </p>
      </div>

      <div>
        <p className="micro-label">Current role</p>
        <div className="mt-1.5">
          <RoleBadge userRole={currentRole} />
        </div>
      </div>

      <div>
        <label htmlFor="assign-role-select" className="micro-label">
          New role
        </label>
        <Select
          value={selected ?? undefined}
          onValueChange={(value) => setSelected(value as Role)}
        >
          <SelectTrigger
            id="assign-role-select"
            data-ocid="admin.assign_role_select"
            className="mt-1.5 h-11 w-full rounded-sm border-input bg-background text-base md:h-10"
          >
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent className="rounded-sm">
            {ASSIGNABLE_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {roleLabel(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {assignRole.isError ? (
        <p
          className="text-base text-destructive"
          data-ocid="admin.assign_role_error_state"
        >
          The role could not be assigned. Only an administrator may change
          roles.
        </p>
      ) : null}

      <DialogFooter className="gap-2">
        <button
          type="button"
          onClick={onDone}
          data-ocid="admin.assign_role_cancel_button"
          className="inline-flex h-11 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={assignRole.isPending || selected === null || unchanged}
          data-ocid="admin.assign_role_confirm_button"
          className="inline-flex h-11 items-center justify-center rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
        >
          {assignRole.isPending ? "Assigning…" : "Assign role"}
        </button>
      </DialogFooter>
    </>
  );
}
