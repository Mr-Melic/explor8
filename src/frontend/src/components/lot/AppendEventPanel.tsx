import { EventKindFields } from "@/components/lot/EventKindFields";
import {
  APPENDABLE_KINDS,
  useAppendEventForm,
} from "@/hooks/use-append-event-form";
import { useLot } from "@/hooks/use-register";
import { humanizeToken } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useEffect } from "react";

interface AppendEventPanelProps {
  /** The lot the event is appended to. */
  lotId: string;
  /** True when the signed-in role may append to this lot. */
  canAppend: boolean;
  /** True when the lot is sealed against further events. */
  frozen: boolean;
  /**
   * The event a correction should be prefilled from, when the reader asked to
   * correct a specific line. The panel consumes it once and clears it.
   */
  correctionTarget?: CorrectionTarget | null;
  /** Called after the panel has consumed `correctionTarget`. */
  onCorrectionConsumed?: () => void;
  className?: string;
}

/** The event a correction is being raised against. */
export interface CorrectionTarget {
  seq: bigint;
  field: string;
  oldValue: string;
}

/**
 * Append a provenance event at the bottom of an expanded block.
 *
 * The register is append-only: a correction is a new event that points at an
 * earlier sequence, and the original line stays visible. Split and merge are
 * structural — split also creates the child lot records, merge appends on the
 * destination and a note on each source. Sources are never deleted.
 *
 * On a phone every input is full width and the submit action sits at the foot
 * of the form, reachable with one thumb.
 */
export function AppendEventPanel({
  lotId,
  canAppend,
  frozen,
  correctionTarget,
  onCorrectionConsumed,
  className,
}: AppendEventPanelProps) {
  const { data: lot } = useLot(lotId);

  if (frozen) {
    return (
      <section
        className={cn(
          "mt-6 border-t border-border pt-4 text-base text-muted-foreground",
          className,
        )}
        data-ocid="event.frozen_notice"
      >
        This block is sealed. No further events can be appended.
      </section>
    );
  }

  if (!canAppend) {
    return (
      <section
        className={cn(
          "mt-6 border-t border-border pt-4 text-base text-muted-foreground",
          className,
        )}
        data-ocid="event.permission_notice"
      >
        Sign in with a writing role to append events to this lot.
      </section>
    );
  }

  if (!lot) {
    return (
      <section
        className={cn(
          "mt-6 border-t border-border pt-4 text-base text-muted-foreground",
          className,
        )}
        data-ocid="event.loading_state"
      >
        Reading the block before the append panel opens…
      </section>
    );
  }

  return (
    <AppendEventForm
      lot={lot}
      correctionTarget={correctionTarget}
      onCorrectionConsumed={onCorrectionConsumed}
      className={className}
    />
  );
}

/**
 * The append form itself, mounted only once the lot is loaded so the draft
 * always belongs to a real block.
 */
function AppendEventForm({
  lot,
  correctionTarget,
  onCorrectionConsumed,
  className,
}: {
  lot: NonNullable<ReturnType<typeof useLot>["data"]>;
  correctionTarget?: CorrectionTarget | null;
  onCorrectionConsumed?: () => void;
  className?: string;
}) {
  const form = useAppendEventForm(lot);
  const { prefillCorrection } = form;

  // Choosing "correct this event" on a timeline row hands the panel a target;
  // prefill the correction fields from it, then release the target so a later
  // manual kind change is not overwritten.
  useEffect(() => {
    if (!correctionTarget) return;
    prefillCorrection(
      correctionTarget.seq,
      correctionTarget.field,
      correctionTarget.oldValue,
    );
    onCorrectionConsumed?.();
  }, [correctionTarget, prefillCorrection, onCorrectionConsumed]);

  return (
    <section
      className={cn("mt-6 border-t border-border pt-5", className)}
      data-ocid="event.panel"
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Append event
      </h3>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`event-kind-${lot.id}`}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Event kind
          </label>
          <select
            id={`event-kind-${lot.id}`}
            value={form.draft.kind}
            onChange={(event) =>
              form.setKind(
                event.target.value as (typeof APPENDABLE_KINDS)[number],
              )
            }
            data-ocid="event.kind_select"
            className={inputClass}
          >
            {APPENDABLE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {humanizeToken(kind)}
              </option>
            ))}
          </select>
        </div>

        <EventKindFields
          draft={form.draft}
          setField={form.setField}
          photoFiles={form.upload.files}
          onAddPhotos={(files) => void form.upload.addFiles(files)}
          onRemovePhoto={form.upload.removeFile}
        />

        {form.error ? (
          <p
            className="inline-flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            role="alert"
            data-ocid="event.error_state"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {form.error}
          </p>
        ) : null}

        {form.success ? (
          <output
            className="inline-flex items-start gap-2 rounded-sm border border-success/40 bg-success/5 px-3 py-2.5 text-sm text-success"
            data-ocid="event.success_state"
          >
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {form.success}
          </output>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-sm text-muted-foreground">
            Appending is permanent. The chain never rewrites.
          </p>
          <button
            type="submit"
            disabled={form.isSubmitting}
            data-ocid="event.submit_button"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-11 sm:w-auto"
          >
            {form.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {form.isSubmitting ? "Appending…" : "Append event"}
          </button>
        </div>
      </form>
    </section>
  );
}

const inputClass =
  "h-12 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground transition-quick placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11";
