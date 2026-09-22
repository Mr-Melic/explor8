import { StatusPill } from "@/components/lot/StatusPill";
import { STATUS_LABEL } from "@/components/lot/StatusPill";
import { useReferenceData } from "@/hooks/use-reference-data";
import { useChangeStatus } from "@/hooks/use-register";
import { useMyRole } from "@/hooks/use-role";
import { Capability, type LotView, RefKind } from "@/lib/backend";
import { humanizeToken } from "@/lib/format";
import { allowedTransitions, canTransition } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface StatusChangeControlProps {
  lot: LotView;
  className?: string;
}

/**
 * Move a block's status, recording the change as a provenance event.
 *
 * The control offers only the transitions the caller's role is permitted to
 * make: the backend's `getMyCapabilities` is the authority for whether the
 * caller may change a status at all, and `allowedTransitions` narrows that to
 * the specific moves available from the block's current status. A transition
 * the role may not make is never rendered, and the backend rejects it if it is
 * attempted anyway.
 *
 * A sealed block cannot change status, so the control explains that instead of
 * offering a dead action.
 */
export function StatusChangeControl({
  lot,
  className,
}: StatusChangeControlProps) {
  const { capabilities, effectiveCapabilities } = useMyRole();
  const { labelFor } = useReferenceData();
  const changeStatus = useChangeStatus();

  const [target, setTarget] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [seen, setSeen] = useState({ lotId: lot.id, status: lot.status });

  const role = capabilities.role;
  const holdsChangeStatus =
    effectiveCapabilities.includes(Capability.change_status) ||
    capabilities.canAdminister;

  // The backend grants `change_status` only to an admin by default, yet its
  // `canTransition` matrix also authorizes Quality Tester and Custom Role
  // transitions. Offer the control whenever the caller is signed in and either
  // holds the capability or their role has at least one transition available
  // from the block's current status. The backend stays the final authority.
  const options = allowedTransitions(role, lot.status);
  const mayChangeStatus =
    capabilities.isAuthenticated && (holdsChangeStatus || options.length > 0);

  // A refreshed lot (or a new status) invalidates a stale selection. Adjusting
  // during render rather than in an effect keeps the control consistent on the
  // first paint after the chain refreshes.
  if (seen.lotId !== lot.id || seen.status !== lot.status) {
    setSeen({ lotId: lot.id, status: lot.status });
    setTarget("");
    setError(null);
    setSuccess(null);
  }

  const label = (status: string): string =>
    labelFor(RefKind.status, status) ??
    STATUS_LABEL[status] ??
    humanizeToken(status);

  if (lot.frozen) {
    return (
      <p
        className={cn("text-base text-muted-foreground", className)}
        data-ocid="lot.status_change_frozen_notice"
      >
        This block is sealed. Its status can no longer change.
      </p>
    );
  }

  if (!mayChangeStatus) {
    return (
      <p
        className={cn("text-base text-muted-foreground", className)}
        data-ocid="lot.status_change_permission_notice"
      >
        Your role may not change a block's status.
      </p>
    );
  }

  if (options.length === 0) {
    return (
      <p
        className={cn("text-base text-muted-foreground", className)}
        data-ocid="lot.status_change_no_transition_notice"
      >
        No status change is available from {label(lot.status)} for your role.
      </p>
    );
  }

  const submit = () => {
    setError(null);
    setSuccess(null);

    if (!target || !canTransition(role, lot.status, target as never)) {
      setError("Choose a status your role may move this block to.");
      return;
    }

    const payload = note.trim();
    changeStatus.mutate(
      { lotId: lot.id, input: { to: target as never, payload } },
      {
        onSuccess: () => {
          setTarget("");
          setNote("");
          setSuccess(`Status recorded for ${lot.id}.`);
        },
        onError: (caught) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "The status change could not be recorded.",
          );
        },
      },
    );
  };

  return (
    <div
      className={cn("min-w-0", className)}
      data-ocid="lot.status_change_control"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Current status
        </span>
        <StatusPill status={lot.status} />
      </div>

      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`status-target-${lot.id}`}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Move to
          </label>
          <select
            id={`status-target-${lot.id}`}
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            data-ocid="lot.status_change_select"
            className={inputClass}
          >
            <option value="">Choose a status…</option>
            {options.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`status-note-${lot.id}`}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Note (optional)
          </label>
          <input
            id={`status-note-${lot.id}`}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="Reason for the change"
            data-ocid="lot.status_change_note_input"
            className={inputClass}
          />
        </div>

        {error ? (
          <p
            className="inline-flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            role="alert"
            data-ocid="lot.status_change_error_state"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {error}
          </p>
        ) : null}

        {success ? (
          <output
            className="inline-flex items-start gap-2 rounded-sm border border-success/40 bg-success/5 px-3 py-2.5 text-sm text-success"
            data-ocid="lot.status_change_success_state"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {success}
          </output>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm text-muted-foreground">
            The change is appended to the chain and never rewrites it.
          </p>
          <button
            type="submit"
            disabled={changeStatus.isPending || !target}
            data-ocid="lot.status_change_submit_button"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-11 sm:w-auto"
          >
            {changeStatus.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {changeStatus.isPending ? "Recording…" : "Record status change"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground transition-quick placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11";
