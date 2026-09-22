import { cn } from "@/lib/utils";
import { Crosshair, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

interface UseMyLocationButtonProps {
  /** Receives the coordinates as editable text, e.g. `-14.1234, 27.5678`. */
  onLocated: (coordinates: string) => void;
  className?: string;
}

/**
 * Fill the GPS field from the device's location.
 *
 * Coordinates are written as plain text — the register stores them as a string
 * and never renders a map.
 */
export function UseMyLocationButton({
  onLocated,
  className,
}: UseMyLocationButtonProps) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleLocate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setMessage("This device does not offer location.");
      return;
    }

    setStatus("locating");
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocated(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setStatus("idle");
        setMessage("Coordinates captured.");
      },
      () => {
        setStatus("error");
        setMessage(
          "Location permission was refused — type coordinates instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [onLocated]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={handleLocate}
        disabled={status === "locating"}
        data-ocid="lot.use_location_button"
        className="inline-flex h-9 items-center gap-1.5 self-start rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {status === "locating" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Crosshair className="size-3.5" aria-hidden="true" />
        )}
        {status === "locating" ? "Locating…" : "Use my location"}
      </button>
      {message ? (
        <output
          className={cn(
            "text-[11px]",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {message}
        </output>
      ) : null}
    </div>
  );
}
