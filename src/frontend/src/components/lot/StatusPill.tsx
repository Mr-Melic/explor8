import { useReferenceData } from "@/hooks/use-reference-data";
import { RefKind } from "@/lib/backend";
import { humanizeToken } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The status stamp's colour, keyed by the register's status reference keys.
 *
 * Colour is presentation, not reference data: an administrator can rename a
 * status but the register still needs a legible stamp, so an unknown key falls
 * back to the neutral `pill-open` treatment.
 */
const STATUS_CLASS: Record<string, string> = {
  open: "pill-open",
  in_transit: "pill-in-transit",
  assayed: "pill-assayed",
  retailed: "pill-retailed",
  frozen: "pill-frozen",
  closed: "pill-frozen",
};

/** Fallback labels for the statuses the register ships with. */
const STATUS_LABEL: Record<string, string> = {
  open: "Recently Mined",
  in_transit: "In transit",
  assayed: "Testing Quality",
  retailed: "Retailed",
  frozen: "Confiscated by Authorities",
  closed: "Applied for crafting",
};

interface StatusPillProps {
  status: string;
  className?: string;
}

/** Register status as a ledger stamp. Colours come from the `--status-*` tokens. */
export function StatusPill({ status, className }: StatusPillProps) {
  const { labelFor } = useReferenceData();

  return (
    <span
      className={cn("pill", STATUS_CLASS[status] ?? "pill-open", className)}
      data-ocid="lot.status_pill"
    >
      {labelFor(RefKind.status, status) ??
        STATUS_LABEL[status] ??
        humanizeToken(status)}
    </span>
  );
}

export { STATUS_LABEL };
