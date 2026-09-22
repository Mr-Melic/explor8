import { PhotoUploader } from "@/components/lot/PhotoUploader";
import { UseMyLocationButton } from "@/components/lot/UseMyLocationButton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useReferenceData } from "@/hooks/use-reference-data";
import {
  PHOTO_PATTERN,
  useRegisterLotForm,
} from "@/hooks/use-register-lot-form";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect } from "react";

interface RegisterLotPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new lot id once the register seals it. */
  onRegistered: (lotId: string) => void;
}

/**
 * Register a new lot in a drawer over the library.
 *
 * The item kinds, sites and form defaults all come from the admin-managed
 * reference catalogue, so the form follows the register's own configuration.
 * The draft is preserved across a failed submit, and the panel closes only
 * once the register has sealed the lot.
 *
 * On a phone the drawer takes the full width, every field is full width and
 * the actions sit at the foot of the form so they are reachable one-handed.
 */
export function RegisterLotPanel({
  open,
  onOpenChange,
  onRegistered,
}: RegisterLotPanelProps) {
  const form = useRegisterLotForm();
  const { createdId, reset } = form;
  const { optionsFor, valueFor } = useReferenceData();

  const kindOptions = optionsFor("lot_kind");
  const siteOptions = optionsFor("site");
  const licenceDefault = valueFor("form_default", "licence");
  const projectDefault = valueFor("form_default", "project");

  // Hand the new lot back to the library once it is sealed.
  useEffect(() => {
    if (!createdId) return;
    onRegistered(createdId);
    reset();
  }, [createdId, onRegistered, reset]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-border bg-background sm:max-w-xl"
        data-ocid="register.sheet"
      >
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="font-display text-xl tracking-tight md:text-2xl">
            Register lot
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            A new block at the top of the register. The id is composed from the
            site and date; the content hash is sealed from the uploaded bytes.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-5 px-4 pb-10 pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void form.submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Item kind" htmlFor="register-type">
              <select
                id="register-type"
                value={form.draft.lotType}
                onChange={(event) => form.setLotType(event.target.value)}
                data-ocid="register.type_select"
                className={inputClass}
              >
                {kindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Mining Site" htmlFor="register-site">
              <select
                id="register-site"
                value={form.draft.site}
                onChange={(event) => form.setSite(event.target.value)}
                data-ocid="register.site_select"
                className={inputClass}
              >
                {siteOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Date" htmlFor="register-date">
              <input
                id="register-date"
                type="date"
                value={form.draft.date}
                onChange={(event) => form.setDate(event.target.value)}
                data-ocid="register.date_input"
                className={inputClass}
              />
            </Field>

            <Field
              label="Lot id"
              htmlFor="register-id"
              error={form.errors.id}
              hint={form.isSuggestingId ? "Suggesting…" : "Editable"}
            >
              <input
                id="register-id"
                value={form.draft.id}
                onChange={(event) => form.setField("id", event.target.value)}
                placeholder="JOA-MFB-20260314-0001"
                data-ocid="register.id_input"
                className={cn(inputClass, "hash text-sm")}
              />
            </Field>

            <Field
              label="Licence"
              htmlFor="register-licence"
              error={form.errors.licence}
            >
              <input
                id="register-licence"
                value={form.draft.licence}
                onChange={(event) =>
                  form.setField("licence", event.target.value)
                }
                placeholder={licenceDefault ?? "44287-HQ-LEL"}
                data-ocid="register.licence_input"
                className={inputClass}
              />
            </Field>

            <Field
              label="Project"
              htmlFor="register-project"
              error={form.errors.project}
            >
              <input
                id="register-project"
                value={form.draft.project}
                onChange={(event) =>
                  form.setField("project", event.target.value)
                }
                placeholder={projectDefault ?? "Mufumbwe / Kikonge"}
                data-ocid="register.project_input"
                className={inputClass}
              />
            </Field>

            <Field
              label="Gross weight (grams)"
              htmlFor="register-gross"
              error={form.errors.grossG}
            >
              <input
                id="register-gross"
                value={form.draft.grossG}
                onChange={(event) =>
                  form.setField("grossG", event.target.value)
                }
                inputMode="decimal"
                placeholder="12480"
                data-ocid="register.gross_input"
                className={inputClass}
              />
            </Field>

            <Field
              label="Seal number"
              htmlFor="register-seal"
              error={form.errors.sealNo}
            >
              <input
                id="register-seal"
                value={form.draft.sealNo}
                onChange={(event) =>
                  form.setField("sealNo", event.target.value)
                }
                placeholder="JOA-SEAL-0042"
                data-ocid="register.seal_input"
                className={inputClass}
              />
            </Field>

            <Field label="Working ref" htmlFor="register-ref">
              <input
                id="register-ref"
                value={form.draft.workingRef}
                onChange={(event) =>
                  form.setField("workingRef", event.target.value)
                }
                placeholder="Pit 4 north face"
                data-ocid="register.working_ref_input"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="register-gps"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              GPS coordinates
            </label>
            <input
              id="register-gps"
              value={form.draft.gps}
              onChange={(event) => form.setField("gps", event.target.value)}
              placeholder="-14.12345, 27.56789"
              data-ocid="register.gps_input"
              className={cn(inputClass, "hash text-sm")}
            />
            <UseMyLocationButton
              onLocated={(coordinates) => form.setField("gps", coordinates)}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Photos
            </p>
            <PhotoUploader
              files={form.upload.files}
              onAdd={(files) => void form.upload.addFiles(files)}
              onRemove={form.upload.removeFile}
              pattern={PHOTO_PATTERN}
              required={form.photoRequired}
              warning={form.photoWarning}
              error={form.errors.photos}
            />
          </div>

          {form.submitError ? (
            <p
              className="inline-flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              role="alert"
              data-ocid="register.error_state"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {form.submitError}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-ocid="register.cancel_button"
              className="inline-flex h-12 w-full items-center justify-center rounded-sm border border-border bg-background px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.isSubmitting}
              data-ocid="register.submit_button"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-11 sm:w-auto"
            >
              {form.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {form.isSubmitting ? "Sealing…" : "Register lot"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const inputClass =
  "h-12 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground transition-quick placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-11";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {label}
        </label>
        {hint ? (
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
