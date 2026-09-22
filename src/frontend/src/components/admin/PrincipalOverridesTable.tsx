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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useRemovePrincipalOverride,
  useSetPrincipalOverride,
} from "@/hooks/use-admin-data";
import { useActors } from "@/hooks/use-register";
import type { Capability, PrincipalOverride, Role } from "@/lib/backend";
import { shortenPrincipal } from "@/lib/format";
import {
  ALL_CAPABILITIES,
  ASSIGNABLE_ROLES,
  capabilityLabel,
  roleLabel,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

interface PrincipalOverridesTableProps {
  /** The per-principal overrides, from `getPermissions`. */
  overrides: PrincipalOverride[];
  /** Whether the signed-in principal may change overrides. */
  editable: boolean;
}

/**
 * Per-principal permission overrides.
 *
 * An override replaces one principal's effective capability set regardless of
 * their role. The table lists every override with the principal, their role and
 * the capabilities they actually hold, and lets an administrator add or remove
 * one.
 */
export function PrincipalOverridesTable({
  overrides,
  editable,
}: PrincipalOverridesTableProps) {
  const removeOverride = useRemovePrincipalOverride();
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted-foreground">
          {overrides.length === 0
            ? "No per-principal overrides. Every principal uses their role's defaults."
            : `${overrides.length} ${overrides.length === 1 ? "principal has" : "principals have"} an override.`}
        </p>
        {editable ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            data-ocid="admin.add_override_button"
            className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add override
          </button>
        ) : null}
      </div>

      {overrides.length === 0 ? (
        <div
          className="block-face px-4 py-6"
          data-ocid="admin.overrides_empty_state"
        >
          <p className="text-base text-muted-foreground">
            No overrides yet. Add one to give a single principal a capability
            set that differs from their role.
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-sm border border-border"
          data-ocid="admin.overrides_table"
        >
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <thead className="sticky top-0 bg-secondary">
              <tr>
                <th scope="col" className="micro-label px-4 py-3">
                  Principal
                </th>
                <th scope="col" className="micro-label px-4 py-3">
                  Role
                </th>
                <th scope="col" className="micro-label px-4 py-3">
                  Effective capabilities
                </th>
                <th scope="col" className="micro-label px-4 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((override, index) => {
                const principalText = override.principal.toString();
                const isConfirming = confirming === principalText;

                return (
                  <tr
                    key={principalText}
                    className="border-t border-border bg-card transition-quick hover:bg-muted/40"
                    data-ocid={`admin.override_row.${index + 1}`}
                  >
                    <td className="min-w-0 px-4 py-3">
                      <span
                        className="hash break-all"
                        title={principalText}
                        data-ocid={`admin.override_principal.${index + 1}`}
                      >
                        {shortenPrincipal(principalText, 8, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge userRole={override.role} />
                    </td>
                    <td className="px-4 py-3">
                      {override.capabilities.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          None
                        </span>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {override.capabilities.map((capability) => (
                            <li
                              key={capability}
                              className="pill border-border bg-transparent text-muted-foreground"
                            >
                              {capabilityLabel(capability)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editable ? (
                        isConfirming ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                removeOverride.mutate(override.principal, {
                                  onSettled: () => setConfirming(null),
                                })
                              }
                              disabled={removeOverride.isPending}
                              data-ocid={`admin.override_confirm_remove_button.${index + 1}`}
                              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                              {removeOverride.isPending
                                ? "Removing…"
                                : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming(null)}
                              data-ocid={`admin.override_cancel_remove_button.${index + 1}`}
                              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                            >
                              <X className="size-3.5" aria-hidden="true" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirming(principalText)}
                            data-ocid={`admin.override_remove_button.${index + 1}`}
                            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            Remove
                          </button>
                        )
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {removeOverride.isError ? (
        <p
          className="text-base text-destructive"
          data-ocid="admin.override_remove_error_state"
        >
          {removeOverride.error instanceof Error
            ? removeOverride.error.message
            : "The override could not be removed."}
        </p>
      ) : null}

      <AddOverrideDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

/**
 * Add a per-principal override: pick an actor, a role and the capabilities.
 *
 * The draft lives in local state and is only cleared when the dialog closes, so
 * a failed write never loses the admin's selection.
 */
function AddOverrideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: actorsResult, isLoading } = useActors(open);
  const setOverride = useSetPrincipalOverride();

  const [principalText, setPrincipalText] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [capabilities, setCapabilities] = useState<Set<Capability>>(new Set());

  const actors = actorsResult?.__kind__ === "ok" ? actorsResult.ok : [];

  function reset() {
    setPrincipalText(null);
    setRole(null);
    setCapabilities(new Set());
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function toggleCapability(capability: Capability) {
    setCapabilities((current) => {
      const next = new Set(current);
      if (next.has(capability)) {
        next.delete(capability);
      } else {
        next.add(capability);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (principalText === null || role === null) return;
    const target = actors.find(
      (actor) => actor.principal.toString() === principalText,
    );
    if (!target) return;

    setOverride.mutate(
      {
        principal: target.principal,
        role,
        capabilities: [...capabilities],
      },
      { onSuccess: () => handleClose(false) },
    );
  }

  const canSubmit = principalText !== null && role !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="rounded-sm border-border bg-card sm:max-w-lg"
        data-ocid="admin.add_override_dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Add a permission override
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Choose a principal and the capabilities they should hold, whatever
            their role's defaults say.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0">
          <label htmlFor="override-principal-select" className="micro-label">
            Principal
          </label>
          {isLoading ? (
            <Skeleton className="mt-1.5 h-11 w-full rounded-sm md:h-10" />
          ) : actors.length === 0 ? (
            <p
              className="mt-1.5 text-base text-muted-foreground"
              data-ocid="admin.override_no_actors_state"
            >
              No actors are known to the register yet. Assign a role first.
            </p>
          ) : (
            <Select
              value={principalText ?? undefined}
              onValueChange={(value) => setPrincipalText(value)}
            >
              <SelectTrigger
                id="override-principal-select"
                data-ocid="admin.override_principal_select"
                className="mt-1.5 h-11 w-full rounded-sm border-input bg-background text-base md:h-10"
              >
                <SelectValue placeholder="Choose a principal" />
              </SelectTrigger>
              <SelectContent className="rounded-sm">
                {actors.map((actor) => {
                  const text = actor.principal.toString();
                  return (
                    <SelectItem key={text} value={text}>
                      {shortenPrincipal(text, 8, 8)} · {roleLabel(actor.role)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <label htmlFor="override-role-select" className="micro-label">
            Role
          </label>
          <Select
            value={role ?? undefined}
            onValueChange={(value) => setRole(value as Role)}
          >
            <SelectTrigger
              id="override-role-select"
              data-ocid="admin.override_role_select"
              className="mt-1.5 h-11 w-full rounded-sm border-input bg-background text-base md:h-10"
            >
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent className="rounded-sm">
              {ASSIGNABLE_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {roleLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="min-w-0">
          <legend className="micro-label">Capabilities</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_CAPABILITIES.map((capability) => {
              const checked = capabilities.has(capability);
              return (
                <label
                  key={capability}
                  className={cn(
                    "flex min-w-0 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-quick",
                    checked
                      ? "border-accent/60 bg-accent/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-accent/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCapability(capability)}
                    data-ocid={`admin.override_capability_checkbox.${capability}`}
                    className="size-4 shrink-0 rounded-sm border-input accent-[oklch(var(--lime))]"
                  />
                  <span className="min-w-0">{capabilityLabel(capability)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {setOverride.isError ? (
          <p
            className="text-base text-destructive"
            data-ocid="admin.override_error_state"
          >
            {setOverride.error instanceof Error
              ? setOverride.error.message
              : "The override could not be saved."}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => handleClose(false)}
            data-ocid="admin.override_cancel_button"
            className="inline-flex h-11 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={setOverride.isPending || !canSubmit}
            data-ocid="admin.override_save_button"
            className="inline-flex h-11 items-center justify-center rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
          >
            {setOverride.isPending ? "Saving…" : "Save override"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
