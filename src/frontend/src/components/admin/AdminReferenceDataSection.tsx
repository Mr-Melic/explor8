import { Skeleton } from "@/components/ui/skeleton";
import {
  REFERENCE_KINDS,
  useAddReferenceEntry,
  useAllReferenceEntries,
  useRemoveReferenceEntry,
  useUpdateReferenceEntry,
} from "@/hooks/use-admin-data";
import type { RefEntryView, RefKind } from "@/lib/backend";
import { cn } from "@/lib/utils";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

interface AdminReferenceDataSectionProps {
  /** Whether the signed-in principal may edit reference data. */
  enabled: boolean;
}

const SKELETON_IDS = Array.from(
  { length: 4 },
  (_, index) => `reference-skeleton-${index}`,
);

/**
 * The register's editable reference data, grouped by block.
 *
 * Every block — lot kinds, site names, statuses, event kinds, labels and form
 * defaults — is addable, editable and removable. These entries drive the
 * register's forms and displays, so a change here is visible across the app.
 */
export function AdminReferenceDataSection({
  enabled,
}: AdminReferenceDataSectionProps) {
  const { data: entries, isLoading, isError } = useAllReferenceEntries(enabled);

  const byKind = useMemo(() => {
    const grouped: Record<string, RefEntryView[]> = {};
    for (const entry of entries ?? []) {
      grouped[entry.kind] = [...(grouped[entry.kind] ?? []), entry];
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => {
        const order = Number(a.sortOrder) - Number(b.sortOrder);
        return order !== 0 ? order : a.key.localeCompare(b.key);
      });
    }
    return grouped;
  }, [entries]);

  if (!enabled) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.reference_locked_state"
      >
        <p className="text-base text-muted-foreground">
          Only an administrator can edit the register's reference data.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2" data-ocid="admin.reference_loading_state">
        {SKELETON_IDS.map((id) => (
          <Skeleton key={id} className="h-24 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.reference_error_state"
      >
        <p className="text-base text-destructive">
          The reference data could not be read. Reload the page to try again.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4" data-ocid="admin.reference_panel">
      {REFERENCE_KINDS.map((block) => (
        <ReferenceBlock
          key={block.kind}
          kind={block.kind}
          label={block.label}
          hint={block.hint}
          entries={byKind[block.kind] ?? []}
        />
      ))}
    </div>
  );
}

function ReferenceBlock({
  kind,
  label,
  hint,
  entries,
}: {
  kind: RefKind;
  label: string;
  hint: string;
  entries: RefEntryView[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section
      className="block-face px-4 py-4"
      data-ocid={`admin.reference_block.${kind}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg tracking-tight text-foreground md:text-xl">
            {label}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          disabled={adding}
          data-ocid={`admin.reference_add_button.${kind}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add entry
        </button>
      </div>

      {entries.length === 0 && !adding ? (
        <p
          className="mt-3 text-base text-muted-foreground"
          data-ocid={`admin.reference_empty_state.${kind}`}
        >
          No entries in this block yet. Add the first one.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry, index) =>
            editingId === entry.id ? (
              <li key={entry.id}>
                <EntryForm
                  kind={kind}
                  entry={entry}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <EntryRow
                key={entry.id}
                entry={entry}
                kind={kind}
                index={index}
                onEdit={() => {
                  setEditingId(entry.id);
                  setAdding(false);
                }}
              />
            ),
          )}
        </ul>
      )}

      {adding ? (
        <div className="mt-3">
          <EntryForm kind={kind} onDone={() => setAdding(false)} />
        </div>
      ) : null}
    </section>
  );
}

function EntryRow({
  entry,
  kind,
  index,
  onEdit,
}: {
  entry: RefEntryView;
  kind: RefKind;
  index: number;
  onEdit: () => void;
}) {
  const removeEntry = useRemoveReferenceEntry();
  const [confirming, setConfirming] = useState(false);

  return (
    <li
      className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4"
      data-ocid={`admin.reference_row.${kind}.${index + 1}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-sm text-foreground">{entry.key}</span>
          <span className="text-base text-foreground">{entry.displayName}</span>
          {!entry.active ? (
            <span className="pill pill-frozen">Inactive</span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {entry.value || "—"} · order {Number(entry.sortOrder)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="micro-label">Remove?</span>
            <button
              type="button"
              onClick={() =>
                removeEntry.mutate(entry.id, {
                  onSettled: () => setConfirming(false),
                })
              }
              disabled={removeEntry.isPending}
              data-ocid={`admin.reference_confirm_remove_button.${kind}.${index + 1}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
            >
              <Check className="size-3.5" aria-hidden="true" />
              {removeEntry.isPending ? "Removing…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              data-ocid={`admin.reference_cancel_remove_button.${kind}.${index + 1}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
            >
              <X className="size-3.5" aria-hidden="true" />
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              data-ocid={`admin.reference_edit_button.${kind}.${index + 1}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              data-ocid={`admin.reference_remove_button.${kind}.${index + 1}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove
            </button>
          </>
        )}
      </div>

      {removeEntry.isError ? (
        <p
          className="w-full text-base text-destructive"
          data-ocid={`admin.reference_remove_error_state.${kind}.${index + 1}`}
        >
          {removeEntry.error instanceof Error
            ? removeEntry.error.message
            : "The entry could not be removed."}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Add or edit one entry. The draft lives in local state and is only cleared by
 * a successful save, so a failed write never loses what the admin typed.
 */
function EntryForm({
  kind,
  entry,
  onDone,
}: {
  kind: RefKind;
  entry?: RefEntryView;
  onDone: () => void;
}) {
  const addEntry = useAddReferenceEntry();
  const updateEntry = useUpdateReferenceEntry();
  const isEdit = entry !== undefined;

  const [key, setKey] = useState(entry?.key ?? "");
  const [displayName, setDisplayName] = useState(entry?.displayName ?? "");
  const [value, setValue] = useState(entry?.value ?? "");
  const [sortOrder, setSortOrder] = useState(
    entry ? String(Number(entry.sortOrder)) : "0",
  );
  const [active, setActive] = useState(entry?.active ?? true);

  const pending = addEntry.isPending || updateEntry.isPending;
  const canSubmit = key.trim().length > 0 && displayName.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const parsedOrder = Number.parseInt(sortOrder, 10);
    const order = Number.isFinite(parsedOrder) ? BigInt(parsedOrder) : 0n;

    if (isEdit && entry) {
      updateEntry.mutate(
        {
          id: entry.id,
          displayName: displayName.trim(),
          value: value.trim(),
          sortOrder: order,
          active,
        },
        { onSuccess: () => onDone() },
      );
      return;
    }

    addEntry.mutate(
      {
        kind,
        key: key.trim(),
        displayName: displayName.trim(),
        value: value.trim(),
        sortOrder: order,
      },
      { onSuccess: () => onDone() },
    );
  }

  const error = addEntry.error ?? updateEntry.error;

  return (
    <div
      className="border border-accent/40 bg-background px-3 py-3"
      data-ocid={`admin.reference_form.${kind}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Key" htmlFor={`reference-key-${kind}`}>
          <input
            id={`reference-key-${kind}`}
            type="text"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            disabled={isEdit}
            placeholder="sample_bag"
            data-ocid={`admin.reference_key_input.${kind}`}
            className="h-11 w-full rounded-sm border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
          />
        </Field>

        <Field label="Display name" htmlFor={`reference-name-${kind}`}>
          <input
            id={`reference-name-${kind}`}
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Sample bag"
            data-ocid={`admin.reference_name_input.${kind}`}
            className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
        </Field>

        <Field label="Value" htmlFor={`reference-value-${kind}`}>
          <input
            id={`reference-value-${kind}`}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Optional value"
            data-ocid={`admin.reference_value_input.${kind}`}
            className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
        </Field>

        <Field label="Sort order" htmlFor={`reference-order-${kind}`}>
          <input
            id={`reference-order-${kind}`}
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            data-ocid={`admin.reference_order_input.${kind}`}
            className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {isEdit ? (
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              data-ocid={`admin.reference_active_checkbox.${kind}`}
              className="size-5 rounded-sm border-input accent-[oklch(var(--lime))]"
            />
            Active in the register
          </label>
        ) : (
          <span className="text-sm text-muted-foreground">
            New entries are active immediately.
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            data-ocid={`admin.reference_cancel_button.${kind}`}
            className="inline-flex h-11 items-center rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !canSubmit}
            data-ocid={`admin.reference_save_button.${kind}`}
            className={cn(
              "inline-flex h-11 items-center rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10",
            )}
          >
            {pending ? "Saving…" : isEdit ? "Save entry" : "Add entry"}
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="mt-3 text-base text-destructive"
          data-ocid={`admin.reference_form_error_state.${kind}`}
        >
          {error instanceof Error
            ? error.message
            : "The entry could not be saved."}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="micro-label">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
