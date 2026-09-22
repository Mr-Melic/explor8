import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteLot } from "@/hooks/use-register";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

/** The exact phrase an administrator must type to delete a block. */
export const DELETE_LOT_PHRASE = "DELETE BLOCK";

interface DeleteLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The block being deleted. */
  lotId: string;
  /** Called once the backend confirms the block was removed. */
  onDeleted: (lotId: string) => void;
}

/**
 * The single-block delete confirmation.
 *
 * Deleting a block is irreversible, so the dialog names the exact block id and
 * refuses to submit until the administrator types the phrase `DELETE BLOCK` —
 * case-sensitive, exact spacing. The backend re-checks the caller's
 * `delete_lot` capability, so the guard is not merely cosmetic.
 */
export function DeleteLotDialog({
  open,
  onOpenChange,
  lotId,
  onDeleted,
}: DeleteLotDialogProps) {
  const deleteLot = useDeleteLot();
  const [phrase, setPhrase] = useState("");

  const matches = phrase === DELETE_LOT_PHRASE;
  const canSubmit = matches && !deleteLot.isPending;

  function handleClose(next: boolean) {
    if (!next) {
      setPhrase("");
      deleteLot.reset();
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!canSubmit) return;
    deleteLot.mutate(lotId, {
      onSuccess: () => {
        setPhrase("");
        onDeleted(lotId);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="rounded-sm border-border bg-card sm:max-w-lg"
        data-ocid="lot.delete_dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
            <AlertTriangle
              className="size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            Delete block {lotId}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            This removes the block, its events, its hash chain and its stored
            files from the register. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-3">
          <p className="text-sm leading-relaxed text-foreground">
            Only this one block is removed. Every other block in the register
            stays exactly as it is.
          </p>
        </div>

        <div className="min-w-0">
          <label htmlFor="delete-lot-phrase-input" className="micro-label">
            Type the phrase to confirm
          </label>
          <p className="mt-1.5">
            <code
              className="hash rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              data-ocid="lot.delete_phrase_required"
            >
              {DELETE_LOT_PHRASE}
            </code>
          </p>
          <input
            id="delete-lot-phrase-input"
            type="text"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={phrase.length > 0 && !matches}
            aria-describedby="delete-lot-phrase-hint"
            placeholder={DELETE_LOT_PHRASE}
            data-ocid="lot.delete_phrase_input"
            className="mt-2 h-11 w-full rounded-sm border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
          <p
            id="delete-lot-phrase-hint"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
            data-ocid="lot.delete_phrase_hint"
          >
            {phrase.length === 0
              ? "Case-sensitive, with the exact spacing shown above."
              : matches
                ? "The phrase matches. You can delete the block."
                : "The phrase does not match yet. Check the capital letters and spacing."}
          </p>
        </div>

        {deleteLot.isError ? (
          <p
            className="text-base text-destructive"
            data-ocid="lot.delete_error_state"
          >
            {deleteLot.error instanceof Error
              ? deleteLot.error.message
              : "The block could not be deleted."}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => handleClose(false)}
            data-ocid="lot.delete_cancel_button"
            className="inline-flex h-11 items-center justify-center rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-ocid="lot.delete_confirm_button"
            className="inline-flex h-11 items-center justify-center rounded-sm bg-destructive px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive-foreground transition-quick hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
          >
            {deleteLot.isPending ? "Deleting…" : "Delete block"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
