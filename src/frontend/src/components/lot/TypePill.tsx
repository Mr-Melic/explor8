import { useReferenceData } from "@/hooks/use-reference-data";
import { RefKind } from "@/lib/backend";
import { humanizeToken } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Fallback labels for the two lot kinds the register ships with.
 *
 * The live labels come from the admin-managed `lot_kind` reference entries;
 * this map only covers the moment before that query resolves, or a lot whose
 * kind was removed from the catalogue after it was sealed.
 */
const TYPE_LABEL: Record<string, string> = {
  emerald: "Emerald",
  gold: "Gold",
};

interface TypePillProps {
  lotType: string;
  className?: string;
}

/** The item kind of a lot, set as a quiet outline stamp. */
export function TypePill({ lotType, className }: TypePillProps) {
  const { labelFor } = useReferenceData();

  return (
    <span
      className={cn(
        "pill border-border bg-transparent text-muted-foreground",
        className,
      )}
      data-ocid="lot.type_pill"
    >
      {labelFor(RefKind.lot_kind, lotType) ??
        TYPE_LABEL[lotType] ??
        humanizeToken(lotType)}
    </span>
  );
}

export { TYPE_LABEL };
