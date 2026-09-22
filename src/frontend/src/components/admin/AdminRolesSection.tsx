import { ActorRoleTable } from "@/components/admin/ActorRoleTable";
import { AssignRoleDialog } from "@/components/admin/AssignRoleDialog";
import { FreezeLotControl } from "@/components/admin/FreezeLotControl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActors } from "@/hooks/use-register";
import type { ActorRole } from "@/lib/backend";
import { Principal } from "@icp-sdk/core/principal";
import { ShieldAlert, UserPlus } from "lucide-react";
import { useState } from "react";

interface AdminRolesSectionProps {
  /** Whether the signed-in principal may view and change roles. */
  canAdminister: boolean;
  /** The signed-in principal, so the admin can spot their own row. */
  selfPrincipal: string | null;
}

/**
 * Roles and access: every actor the register knows, with the role each holds.
 *
 * An administrator can add a role to a new principal, change an existing
 * assignment, or remove it by returning the principal to `guest`. The register
 * is append-only, so this changes authority only — it never rewrites a lot or
 * an event.
 */
export function AdminRolesSection({
  canAdminister,
  selfPrincipal,
}: AdminRolesSectionProps) {
  const { data: actorsResult, isLoading } = useActors(canAdminister);
  const [editing, setEditing] = useState<ActorRole | null>(null);
  const [adding, setAdding] = useState(false);

  const actors = actorsResult?.__kind__ === "ok" ? actorsResult.ok : [];

  if (!canAdminister) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.actors_locked_state"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-base leading-relaxed text-muted-foreground">
            Only an administrator can view the full actor list and change roles.
            Ask an administrator to grant you access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4" data-ocid="admin.roles_panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted-foreground">
          {actors.length === 0
            ? "No roles have been assigned yet."
            : `${actors.length} ${actors.length === 1 ? "actor holds" : "actors hold"} a role.`}
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          data-ocid="admin.add_role_button"
          className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          Assign a role
        </button>
      </div>

      <ActorRoleTable
        actors={actors}
        isLoading={isLoading}
        selfPrincipal={selfPrincipal}
        onEdit={setEditing}
      />

      <div className="pt-2">
        <h3 className="micro-label">Seal a lot</h3>
        <FreezeLotControl className="mt-3" />
      </div>

      <AssignRoleDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        target={editing?.principal ?? null}
        currentRole={editing?.role ?? null}
      />

      <AddPrincipalDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

/**
 * Assign a role to a principal that is not in the actor list yet.
 *
 * The admin pastes the principal text; it is parsed to a `Principal` and handed
 * to the same assign-role dialog the table uses, so both paths share one write.
 */
function AddPrincipalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Principal | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Enter the principal to assign a role to.");
      return;
    }
    try {
      setParsed(Principal.fromText(trimmed));
      setError(null);
    } catch {
      setError("That is not a valid principal. Check the text and try again.");
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      setText("");
      setParsed(null);
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <>
      <Dialog open={open && parsed === null} onOpenChange={handleClose}>
        <DialogContent
          className="rounded-sm border-border bg-card sm:max-w-md"
          data-ocid="admin.add_principal_dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">
              Assign a role
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Paste the principal of the actor who needs access. They can read
              it from their own signed-in header.
            </DialogDescription>
          </DialogHeader>

          <label className="block min-w-0">
            <span className="micro-label">Principal</span>
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="aaaaa-aa…"
              data-ocid="admin.add_principal_input"
              className="mt-1.5 h-11 w-full rounded-sm border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            />
          </label>

          {error ? (
            <p
              className="text-base text-destructive"
              data-ocid="admin.add_principal_error_state"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => handleClose(false)}
              data-ocid="admin.add_principal_cancel_button"
              className="inline-flex h-11 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleContinue}
              data-ocid="admin.add_principal_continue_button"
              className="inline-flex h-11 items-center justify-center rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            >
              Continue
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignRoleDialog
        open={parsed !== null}
        onOpenChange={(next) => {
          if (!next) handleClose(false);
        }}
        target={parsed}
        currentRole={null}
      />
    </>
  );
}
