import type { StagedFile } from "@/hooks/use-file-upload";
import { shortenHash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useCallback, useId, useRef } from "react";

interface PhotoUploaderProps {
  files: StagedFile[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  /** The three-photo pattern the register asks for, shown as guidance. */
  pattern?: readonly string[];
  /** True when this item kind must carry at least one photo. */
  required?: boolean;
  /** True when fewer than the pattern's photos are attached. */
  warning?: boolean;
  error?: string;
  className?: string;
}

/**
 * Attach photos to a lot or event.
 *
 * Bytes are hashed in the browser before upload, so each thumbnail carries the
 * content hash that will be sealed into the register.
 */
export function PhotoUploader({
  files,
  onAdd,
  onRemove,
  pattern,
  required = false,
  warning = false,
  error,
  className,
}: PhotoUploaderProps) {
  const inputId = useId();
  const cameraId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? []);
      if (selected.length > 0) onAdd(selected);
      event.target.value = "";
    },
    [onAdd],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          data-ocid="lot.photo_upload_button"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-within:ring-2 focus-within:ring-ring"
        >
          <ImagePlus className="size-3.5" aria-hidden="true" />
          Choose photos
        </label>
        <input
          id={inputId}
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          className="sr-only"
        />

        <label
          htmlFor={cameraId}
          data-ocid="lot.photo_camera_button"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-within:ring-2 focus-within:ring-ring"
        >
          <Camera className="size-3.5" aria-hidden="true" />
          Take photo
        </label>
        <input
          id={cameraId}
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          className="sr-only"
        />
      </div>

      {pattern && pattern.length > 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {required ? "Required" : "Optional"} · requested pattern:{" "}
          {pattern.join(" · ")}
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : warning ? (
        <output className="inline-flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          Fewer than the requested three photos — you can still register, but
          the pattern is working, material, and sealed bag with tag visible.
        </output>
      ) : null}

      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((item, index) => (
            <li
              key={item.key}
              className="relative overflow-hidden rounded-sm border border-border bg-card"
              data-ocid={`lot.photo_item.${index + 1}`}
            >
              <img
                src={URL.createObjectURL(item.file)}
                alt={item.file.name}
                className="h-24 w-full object-cover"
              />
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="hash truncate" title={item.file.name}>
                  {item.contentHash
                    ? shortenHash(item.contentHash, 6, 4)
                    : "hashing…"}
                </span>
                {item.error ? (
                  <AlertTriangle
                    className="size-3.5 shrink-0 text-destructive"
                    aria-label={item.error}
                  />
                ) : item.fileId ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
                    Sealed
                  </span>
                ) : (
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                    aria-label="Uploading"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                aria-label={`Remove ${item.file.name}`}
                data-ocid={`lot.photo_remove_button.${index + 1}`}
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-sm bg-background/90 text-muted-foreground transition-quick hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
