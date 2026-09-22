import { useUpdateReferenceEntry } from "@/hooks/use-admin-data";
import { referenceKeys, useReferenceData } from "@/hooks/use-reference-data";
import { useMyRole } from "@/hooks/use-role";
import { Capability, RefKind } from "@/lib/backend";
import type { RefEntryView } from "@/lib/backend";
import { humanizeToken } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { useState } from "react";

/**
 * The statuses the register ships with, in the order the section lists them.
 *
 * The section reads the live status list from reference data so an
 * administrator can add or rename a status and see it here; this list is only
 * the fallback used while the register is unreachable, and it also fixes the
 * display order of the statuses the register knows about.
 */
const FALLBACK_STATUSES = [
  "open",
  "in_transit",
  "assayed",
  "retailed",
  "closed",
  "frozen",
] as const;

/** Fallback display terms for the statuses the register ships with. */
const STATUS_LABEL: Record<string, string> = {
  open: "Recently Mined",
  in_transit: "In transit",
  assayed: "Testing Quality",
  retailed: "Retailed",
  closed: "Applied for crafting",
  frozen: "Confiscated by Authorities",
};

/** The exact label every fold-out control carries. */
const TOGGLE_LABEL = "CLICK HERE TO UNDERSTAND THIS STATUS";

/**
 * The per-status information section.
 *
 * Every status the register carries gets a fold-out control that reveals what
 * that status means for a lot. The section is collapsed by default and only
 * one explanation is open at a time, so the home page stays quiet until a
 * reader asks a specific question.
 *
 * The explanation texts are reference data (`RefKind.status_explanation`), so
 * an administrator can add, edit and remove them from the admin panel. An
 * administrator can also edit a text inline here; the write goes through the
 * same reference-data endpoint and invalidates the public reference query, so
 * the change is visible immediately without a reload.
 */
export function StatusInfoSection() {
  const { index, labelFor } = useReferenceData();
  const { effectiveCapabilities } = useMyRole();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const canEdit = effectiveCapabilities.includes(
    Capability.manage_reference_data,
  );

  // The statuses to show: the register's active statuses in reference order,
  // falling back to the built-in list while the register is unreachable.
  const statusEntries = index[RefKind.status].filter((entry) => entry.active);
  const statuses =
    statusEntries.length > 0
      ? statusEntries.map((entry) => entry.key)
      : [...FALLBACK_STATUSES];

  const explanationFor = (status: string): RefEntryView | null =>
    index[RefKind.status_explanation].find((entry) => entry.key === status) ??
    null;

  const labelForStatus = (status: string): string =>
    labelFor(RefKind.status, status) ??
    STATUS_LABEL[status] ??
    humanizeToken(status);

  return (
    <section className="py-9 md:py-12" data-ocid="home.status_info_section">
      <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
        Understanding each status
      </h2>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        What each register status means for a lot, folded open one status at a
        time.
      </p>

      <ul className="mt-5 space-y-2.5">
        {statuses.map((status, position) => (
          <li key={status}>
            <StatusExplanation
              status={status}
              label={labelForStatus(status)}
              entry={explanationFor(status)}
              open={openKey === status}
              canEdit={canEdit}
              position={position + 1}
              onToggle={() =>
                setOpenKey((current) => (current === status ? null : status))
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface StatusExplanationProps {
  status: string;
  label: string;
  entry: RefEntryView | null;
  open: boolean;
  canEdit: boolean;
  position: number;
  onToggle: () => void;
}

/**
 * One status row: a heading, the fold-out control, and the explanation.
 *
 * The control is a real button carrying the exact label the register asks for,
 * so it is keyboard reachable and announces its expanded state. The panel is
 * only mounted while open, which keeps the collapsed section light.
 */
function StatusExplanation({
  status,
  label,
  entry,
  open,
  canEdit,
  position,
  onToggle,
}: StatusExplanationProps) {
  const panelId = `status-explanation-${status}`;

  return (
    <article
      className={cn(
        "block-face px-4 py-3.5 transition-quick sm:px-5",
        open && "block-face-open",
      )}
      data-ocid={`home.status_info_item.${position}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="min-w-0 font-display text-lg tracking-tight text-foreground md:text-xl">
          {label}
        </h3>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          data-ocid={`home.status_info_toggle.${position}`}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:w-auto"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
          {TOGGLE_LABEL}
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          className="mt-3.5 border-t border-border pt-3.5"
          data-ocid={`home.status_info_panel.${position}`}
        >
          {entry ? (
            <ExplanationBody
              entry={entry}
              canEdit={canEdit}
              position={position}
            />
          ) : (
            <p
              className="text-base text-muted-foreground"
              data-ocid={`home.status_info_empty_state.${position}`}
            >
              {canEdit
                ? "No explanation is stored for this status yet. Add one from the admin panel's Status explanations block."
                : "No explanation has been recorded for this status yet."}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

/**
 * The explanation text, with an admin-only inline edit affordance.
 *
 * A non-admin sees the stored text read-only. An administrator can open an
 * editor, change the text and save it through the reference-data endpoint; the
 * draft lives in local state and is only cleared by a successful save, so a
 * failed write never loses what was typed.
 */
function ExplanationBody({
  entry,
  canEdit,
  position,
}: {
  entry: RefEntryView;
  canEdit: boolean;
  position: number;
}) {
  const updateEntry = useUpdateReferenceEntry();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.value);
  const [error, setError] = useState<string | null>(null);

  const text = entry.value.trim();

  const startEditing = () => {
    setDraft(entry.value);
    setError(null);
    setEditing(true);
  };

  const save = () => {
    setError(null);
    const next = draft.trim();
    updateEntry.mutate(
      {
        id: entry.id,
        displayName: entry.displayName,
        value: next,
        sortOrder: entry.sortOrder,
        active: entry.active,
      },
      {
        onSuccess: () => {
          // The admin panel reads `admin-reference`; the home page reads the
          // public `reference-entries` query. Invalidate both so an inline edit
          // is reflected here and in the admin panel without a reload.
          void queryClient.invalidateQueries({ queryKey: referenceKeys.all });
          setEditing(false);
        },
        onError: (caught) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "The explanation could not be saved.",
          );
        },
      },
    );
  };

  if (!editing) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <p
          className="min-w-0 whitespace-pre-line text-base leading-relaxed text-muted-foreground"
          data-ocid={`home.status_info_text.${position}`}
        >
          {text || "No explanation has been recorded for this status yet."}
        </p>

        {canEdit ? (
          <button
            type="button"
            onClick={startEditing}
            data-ocid={`home.status_info_edit_button.${position}`}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit explanation
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div data-ocid={`home.status_info_editor.${position}`}>
      <label
        htmlFor={`status-explanation-input-${entry.key}`}
        className="micro-label"
      >
        Explanation for {entry.displayName}
      </label>
      <textarea
        id={`status-explanation-input-${entry.key}`}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        rows={4}
        data-ocid={`home.status_info_textarea.${position}`}
        className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2.5 text-base leading-relaxed text-foreground transition-quick placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {error ? (
        <p
          className="mt-2.5 inline-flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          role="alert"
          data-ocid={`home.status_info_error_state.${position}`}
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          data-ocid={`home.status_info_cancel_button.${position}`}
          className="inline-flex h-11 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10"
        >
          <X className="size-3.5" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={updateEntry.isPending}
          data-ocid={`home.status_info_save_button.${position}`}
          className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-primary px-4 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-10"
        >
          {updateEntry.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-3.5" aria-hidden="true" />
          )}
          {updateEntry.isPending ? "Saving…" : "Save explanation"}
        </button>
      </div>
    </div>
  );
}
