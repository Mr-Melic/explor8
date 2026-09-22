import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRequestPurge } from "@/hooks/use-admin-data";
import type { PurgeOutcome } from "@/lib/backend";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

/** The exact phrase an administrator must type to open a purge request. */
export const PURGE_PHRASE = "DeLeTe ALL DATA";

interface PurgeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the backend outcome once the request is accepted. */
  onRequested: (outcome: PurgeOutcome) => void;
}

/**
 * The purge confirmation dialog.
 *
 * The register is append-only, so purging is the one irreversible action in the
 * app. The dialog refuses to submit until the administrator types the exact
 * phrase `DeLeTe ALL DATA` — case-sensitive, exact spacing — and the backend
 * re-checks the same phrase, so the guard is not merely cosmetic.
 */
export function PurgeConfirmDialog({
  open,
  onOpenChange,
  onRequested,
}: PurgeConfirmDialogProps) {
  const requestPurge = useRequestPurge();
  const [phrase, setPhrase] = useState("");

  const matches = phrase === PURGE_PHRASE;
  const canSubmit = matches && !requestPurge.isPending;

  function handleClose(next: boolean) {
    if (!next) {
      setPhrase("");
      requestPurge.reset();
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!canSubmit) return;
    const typed = phrase;
    requestPurge.mutate(typed, {
      onSuccess: (outcome) => {
        setPhrase("");
        onRequested(outcome);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="rounded-sm border-border bg-card sm:max-w-lg"
        data-ocid="admin.purge_confirm_dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
            <AlertTriangle
              className="size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            Purge all register data
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            This removes every block, its events, its hash chain and its stored
            files. Roles, actors and reference data are kept. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-3">
          <p className="text-sm leading-relaxed text-foreground">
            The purge runs automatically once more than half of the register's
            administrators have confirmed the same request.
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="purge-phrase-input" className="micro-label">
            Type the phrase to confirm
          </label>
          <p className="mt-1.5">
            <code
              className="hash rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              data-ocid="admin.purge_phrase_required"
            >
              {PURGE_PHRASE}
            </code>
          </p>
          <input
            id="purge-phrase-input"
            type="text"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={phrase.length > 0 && !matches}
            aria-describedby="purge-phrase-hint"
            placeholder={PURGE_PHRASE}
            data-ocid="admin.purge_phrase_input"
            className="mt-2 h-11 w-full rounded-sm border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
          <p
            id="purge-phrase-hint"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
            data-ocid="admin.purge_phrase_hint"
          >
            {phrase.length === 0
              ? "Case-sensitive, with the exact spacing shown above."
              : matches
                ? "The phrase matches. You can request the purge."
                : "The phrase does not match yet. Check the capital letters and spacing."}
          </p>
        </div>

        {requestPurge.isError ? (
          <p
            className="text-base text-destructive"
            data-ocid="admin.purge_request_error_state"
          >
            {requestPurge.error instanceof Error
              ? requestPurge.error.message
              : "The purge request could not be opened."}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => handleClose(false)}
            data-ocid="admin.purge_cancel_button"
            className="inline-flex h-11 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-ocid="admin.purge_confirm_button"
            className="inline-flex h-11 items-center justify-center rounded-sm bg-destructive px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive-foreground transition-quick hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
          >
            {requestPurge.isPending ? "Requesting…" : "Request purge"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
