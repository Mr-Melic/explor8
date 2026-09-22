import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";
import { useState } from "react";

interface PhotoStripProps {
  /** Object-storage file ids attached to the lot as photographs. */
  photoFileIds: string[];
  /** Resolved gateway URLs, keyed by file id. */
  urls: Record<string, string>;
  className?: string;
}

/**
 * The lot's photographs, laid out as a contact sheet.
 *
 * A photo that has not resolved yet shows a quiet placeholder rather than a
 * broken image, and a photo that fails to load is marked as unavailable so the
 * strip never collapses or shifts the block beneath it.
 *
 * The tiles are sized so two fit a phone width without horizontal scroll.
 */
export function PhotoStrip({ photoFileIds, urls, className }: PhotoStripProps) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  if (photoFileIds.length === 0) {
    return (
      <p
        className={cn("text-base text-muted-foreground", className)}
        data-ocid="lot.photos_empty_state"
      >
        No photographs are attached to this lot.
      </p>
    );
  }

  return (
    <ul
      className={cn("grid grid-cols-2 gap-2 sm:flex sm:flex-wrap", className)}
      data-ocid="lot.photo_strip"
    >
      {photoFileIds.map((fileId, index) => {
        const url = urls[fileId];
        const isFailed = failed[fileId];

        return (
          <li
            key={fileId}
            className="min-w-0 sm:w-32 sm:shrink-0"
            data-ocid={`lot.photo.${index + 1}`}
          >
            <div className="aspect-square overflow-hidden border border-border bg-muted">
              {url && !isFailed ? (
                <img
                  src={url}
                  alt={`Lot photograph ${index + 1}`}
                  loading="lazy"
                  onError={() =>
                    setFailed((current) => ({ ...current, [fileId]: true }))
                  }
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImageOff className="size-5" aria-hidden="true" />
                  <span className="px-1 text-center text-[11px] uppercase tracking-[0.12em]">
                    {isFailed ? "Unavailable" : "Loading"}
                  </span>
                </div>
              )}
            </div>
            <span className="hash mt-1.5 block truncate text-xs" title={fileId}>
              {fileId}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
