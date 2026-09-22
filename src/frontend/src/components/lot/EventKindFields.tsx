import { PhotoUploader } from "@/components/lot/PhotoUploader";
import type { AppendEventDraft } from "@/hooks/use-append-event-form";
import type { StagedFile } from "@/hooks/use-file-upload";
import { EventKind } from "@/lib/backend";
import { cn } from "@/lib/utils";

interface EventKindFieldsProps {
  draft: AppendEventDraft;
  setField: <K extends keyof AppendEventDraft>(
    key: K,
    value: AppendEventDraft[K],
  ) => void;
  /** Photo staging, shared with the panel's uploader. */
  photoFiles: StagedFile[];
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (key: string) => void;
  photoError?: string;
  className?: string;
}

/**
 * Reveal only the fields the chosen event kind needs.
 *
 * Every kind writes a canonical payload string; this component owns the inputs
 * that compose it and nothing else.
 */
export function EventKindFields({
  draft,
  setField,
  photoFiles,
  onAddPhotos,
  onRemovePhoto,
  photoError,
  className,
}: EventKindFieldsProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {draft.kind === EventKind.photo ? (
        <>
          <PhotoUploader
            files={photoFiles}
            onAdd={onAddPhotos}
            onRemove={onRemovePhoto}
            error={photoError}
          />
          <Field label="Caption" htmlFor="event-caption">
            <input
              id="event-caption"
              value={draft.caption}
              onChange={(event) => setField("caption", event.target.value)}
              placeholder="Working face, sealed bag, material…"
              data-ocid="event.caption_input"
              className={inputClass}
            />
          </Field>
        </>
      ) : null}

      {draft.kind === EventKind.weighed ? (
        <Field label="Weight (grams)" htmlFor="event-grams">
          <input
            id="event-grams"
            value={draft.grams}
            onChange={(event) => setField("grams", event.target.value)}
            inputMode="decimal"
            placeholder="12480"
            data-ocid="event.grams_input"
            className={inputClass}
          />
        </Field>
      ) : null}

      {draft.kind === EventKind.sealed ? (
        <Field label="Seal number" htmlFor="event-seal">
          <input
            id="event-seal"
            value={draft.sealNo}
            onChange={(event) => setField("sealNo", event.target.value)}
            placeholder="JOA-SEAL-0042"
            data-ocid="event.seal_input"
            className={inputClass}
          />
        </Field>
      ) : null}

      {draft.kind === EventKind.moved ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="event-from">
            <input
              id="event-from"
              value={draft.fromPlace}
              onChange={(event) => setField("fromPlace", event.target.value)}
              placeholder="Mufumbwe mining site"
              data-ocid="event.from_input"
              className={inputClass}
            />
          </Field>
          <Field label="To" htmlFor="event-to">
            <input
              id="event-to"
              value={draft.toPlace}
              onChange={(event) => setField("toPlace", event.target.value)}
              placeholder="Lusaka vault"
              data-ocid="event.to_input"
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}

      {draft.kind === EventKind.assay ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Laboratory" htmlFor="event-lab">
              <input
                id="event-lab"
                value={draft.labName}
                onChange={(event) => setField("labName", event.target.value)}
                placeholder="SGS Lusaka"
                data-ocid="event.lab_input"
                className={inputClass}
              />
            </Field>
            <Field label="Method" htmlFor="event-method">
              <input
                id="event-method"
                value={draft.method}
                onChange={(event) => setField("method", event.target.value)}
                placeholder="Fire assay"
                data-ocid="event.method_input"
                className={inputClass}
              />
            </Field>
            <Field label="Au grade" htmlFor="event-grade">
              <input
                id="event-grade"
                value={draft.auGrade}
                onChange={(event) => setField("auGrade", event.target.value)}
                placeholder="92.4%"
                data-ocid="event.grade_input"
                className={inputClass}
              />
            </Field>
            <Field label="Certificate number" htmlFor="event-cert">
              <input
                id="event-cert"
                value={draft.certificateNo}
                onChange={(event) =>
                  setField("certificateNo", event.target.value)
                }
                placeholder="SGS-2026-1187"
                data-ocid="event.certificate_input"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Certificate PDF (optional)" htmlFor="event-cert-file">
            <input
              id="event-cert-file"
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                if (selected.length > 0) onAddPhotos(selected);
                event.target.value = "";
              }}
              data-ocid="event.certificate_upload_button"
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-sm file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.08em] file:text-muted-foreground"
            />
          </Field>
        </>
      ) : null}

      {draft.kind === EventKind.split ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Child lot ids (comma separated)"
            htmlFor="event-children"
          >
            <input
              id="event-children"
              value={draft.childIds}
              onChange={(event) => setField("childIds", event.target.value)}
              placeholder="JOA-MFB-20260314-0002, JOA-MFB-20260314-0003"
              data-ocid="event.child_ids_input"
              className={inputClass}
            />
          </Field>
          <Field label="Weight to each (grams)" htmlFor="event-child-weights">
            <input
              id="event-child-weights"
              value={draft.childWeights}
              onChange={(event) => setField("childWeights", event.target.value)}
              placeholder="6200, 6280"
              data-ocid="event.child_weights_input"
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}

      {draft.kind === EventKind.merge ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Source lot ids (comma separated)"
            htmlFor="event-sources"
          >
            <input
              id="event-sources"
              value={draft.sourceIds}
              onChange={(event) => setField("sourceIds", event.target.value)}
              placeholder="JOA-MFB-20260314-0002"
              data-ocid="event.source_ids_input"
              className={inputClass}
            />
          </Field>
          <Field label="Combined weight (grams)" htmlFor="event-merge-grams">
            <input
              id="event-merge-grams"
              value={draft.grams}
              onChange={(event) => setField("grams", event.target.value)}
              inputMode="decimal"
              placeholder="12480"
              data-ocid="event.merge_grams_input"
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}

      {draft.kind === EventKind.cut || draft.kind === EventKind.retail ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Description" htmlFor="event-description">
            <input
              id="event-description"
              value={draft.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Cut and polished, 3 stones"
              data-ocid="event.description_input"
              className={inputClass}
            />
          </Field>
          <Field label="Buyer reference" htmlFor="event-buyer">
            <input
              id="event-buyer"
              value={draft.buyerRef}
              onChange={(event) => setField("buyerRef", event.target.value)}
              placeholder="private buyer"
              data-ocid="event.buyer_input"
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}

      {draft.kind === EventKind.correction ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Corrects sequence" htmlFor="event-correction-seq">
            <input
              id="event-correction-seq"
              value={draft.correctionSeq}
              onChange={(event) =>
                setField("correctionSeq", event.target.value)
              }
              inputMode="numeric"
              placeholder="3"
              data-ocid="event.correction_seq_input"
              className={inputClass}
            />
          </Field>
          <Field label="Field" htmlFor="event-correction-field">
            <input
              id="event-correction-field"
              value={draft.correctionField}
              onChange={(event) =>
                setField("correctionField", event.target.value)
              }
              placeholder="grossG"
              data-ocid="event.correction_field_input"
              className={inputClass}
            />
          </Field>
          <Field label="Old value" htmlFor="event-correction-old">
            <input
              id="event-correction-old"
              value={draft.correctionOld}
              onChange={(event) =>
                setField("correctionOld", event.target.value)
              }
              data-ocid="event.correction_old_input"
              className={inputClass}
            />
          </Field>
          <Field label="New value" htmlFor="event-correction-new">
            <input
              id="event-correction-new"
              value={draft.correctionNew}
              onChange={(event) =>
                setField("correctionNew", event.target.value)
              }
              data-ocid="event.correction_new_input"
              className={inputClass}
            />
          </Field>
          <Field
            label="Reason"
            htmlFor="event-correction-reason"
            className="sm:col-span-2"
          >
            <input
              id="event-correction-reason"
              value={draft.correctionReason}
              onChange={(event) =>
                setField("correctionReason", event.target.value)
              }
              placeholder="Scale re-read after calibration"
              data-ocid="event.correction_reason_input"
              className={inputClass}
            />
          </Field>
        </div>
      ) : null}

      {draft.kind === EventKind.note ? (
        <Field label="Note" htmlFor="event-note">
          <textarea
            id="event-note"
            value={draft.note}
            onChange={(event) => setField("note", event.target.value)}
            rows={3}
            placeholder="Anything the register should carry forward."
            data-ocid="event.note_input"
            className={cn(inputClass, "h-auto py-2")}
          />
        </Field>
      ) : null}

      {/*
       * A status change is recorded by the block's status control, not by this
       * append form, so it contributes no fields here. The branch keeps the
       * kind explicitly handled rather than falling through silently.
       */}
      {draft.kind === EventKind.status_change ? null : null}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-sm border border-input bg-background px-2.5 text-sm text-foreground transition-quick placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
