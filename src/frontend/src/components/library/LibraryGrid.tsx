import { LotExpandedPanel } from "@/components/lot/LotExpandedPanel";
import { StatusPill } from "@/components/lot/StatusPill";
import { TypePill } from "@/components/lot/TypePill";
import type { LotView } from "@/lib/backend";
import { formatGrams, shortenHash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronDown, CornerDownRight, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface LibraryGridProps {
  lots: LotView[];
  /** The single expanded lot id, or `null` when the library is collapsed. */
  expandedId: string | null;
  /** Expand a block, or collapse it when it is already open. */
  onToggle: (lotId: string) => void;
  /** Expand a linked lot, collapsing whatever is currently open. */
  onOpenLot: (lotId: string) => void;
  /**
   * Close the expanded view after a lot is removed from the register.
   * Optional so existing call sites keep compiling; falls back to `onOpenLot`.
   */
  onDeleted?: (lotId: string) => void;
  /** Whether the signed-in principal may append events. */
  canAppend: boolean;
  /** Whether the signed-in principal holds the `delete_lot` capability. */
  canDelete?: boolean;
  /** Resolved object-storage URLs, keyed by file id. */
  photoUrls: Record<string, string>;
  /** Child lot ids, keyed by parent lot id. */
  childrenByParent: Record<string, string[]>;
}

/**
 * The library itself: a responsive block grid that opens in place.
 *
 * One column on a phone with full-width tap targets, two on a tablet, three
 * on a wide desktop. Expanding never navigates — the block unfolds where it
 * stands and the rest of the register stays put.
 *
 * Colour alternation: every block takes one of the eight schedule tints, and
 * no two neighbours — horizontally or vertically — ever share one. Because
 * the grid is 1, 2 or 3 columns wide, a single formula cannot serve every
 * width, so both the horizontal stride and the per-row offset are chosen from
 * the live column count. Each is coprime with 8 (1, 3, 5 or 7), so a full
 * 8-block cycle runs before any repeat, and the two offsets are always
 * different from each other — that is what keeps a block distinct from the
 * one directly beneath it as well as from its row neighbour. The tint is
 * applied through the `data-block-face` attribute, so it re-tints
 * automatically under the light theme.
 */
const BLOCK_COUNT = 8;

/** The horizontal stride that keeps a row's neighbours distinct. */
function blockStride(columns: number): number {
  // 1 col: +1 down the column. 2 cols: +3. 3 cols: +1 across.
  if (columns === 2) return 3;
  return 1;
}

/** The per-row offset that keeps a block distinct from the one beneath it. */
function blockRowOffset(columns: number): number {
  // Must differ from the stride at the same width, or the two cancel out and
  // vertically adjacent blocks collide (the 2-column stride-3/offset-3 bug).
  if (columns === 2) return 1;
  return 3;
}

/** The schedule index (1..8) for a block at `index` in a `columns`-wide grid. */
function blockFace(index: number, columns: number): number {
  const stride = blockStride(columns);
  const rowOffset = blockRowOffset(columns);
  const row = Math.floor(index / columns);
  const column = index % columns;
  // The per-column stride keeps a row's neighbours distinct; the per-row
  // offset keeps a block distinct from the one directly beneath it.
  const slot = column * stride + row * rowOffset;
  return (slot % BLOCK_COUNT) + 1;
}

export function LibraryGrid({
  lots,
  expandedId,
  onToggle,
  onOpenLot,
  onDeleted = onOpenLot,
  canAppend,
  canDelete = false,
  photoUrls,
  childrenByParent,
}: LibraryGridProps) {
  // The grid is 1 / 2 / 3 columns; read the live count so the alternation
  // matches what is actually on screen rather than a fixed assumption.
  const columns = useGridColumns();

  return (
    <div
      className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
      data-ocid="register.library_grid"
    >
      {lots.map((lot, index) => {
        const open = expandedId === lot.id;
        return (
          <article
            key={lot.id}
            data-block-face={blockFace(index, columns)}
            className={cn(
              "block-face transition-quick",
              open &&
                "block-face-open shadow-block-open md:col-span-2 xl:col-span-3",
            )}
            data-ocid={`lot.item.${index + 1}`}
          >
            <CollapsedBlock
              lot={lot}
              index={index}
              open={open}
              onToggle={() => onToggle(lot.id)}
            />

            {open ? (
              <LotExpandedPanel
                lot={lot}
                canAppend={canAppend}
                canDelete={canDelete}
                photoUrls={photoUrls}
                onOpenLot={onOpenLot}
                onDeleted={onDeleted}
                childIds={childrenByParent[lot.id] ?? []}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/**
 * The grid's live column count, matching the `grid-cols-1 md:grid-cols-2
 * xl:grid-cols-3` classes above. It starts at 1 so the server-rendered and
 * first client paint are stable, then corrects on mount and on resize.
 */
function useGridColumns(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const read = () => {
      const width = window.innerWidth;
      setColumns(width >= 1280 ? 3 : width >= 768 ? 2 : 1);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  return columns;
}

function CollapsedBlock({
  lot,
  index,
  open,
  onToggle,
}: {
  lot: LotView;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const thumbnailId = lot.photoFileIds[0];
  const parentId = lot.parentIds[0];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-ocid={`lot.open_button.${index + 1}`}
      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-quick hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronDown
        className={cn(
          "mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
          open && "rotate-180",
        )}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-display text-lg leading-none tracking-tight text-foreground md:text-xl">
            {lot.id}
          </span>
          <TypePill lotType={lot.lotType} />
          <StatusPill status={lot.status} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-base text-foreground">
            {formatGrams(lot.grossG)}
          </span>
          <span className="hash text-sm" title={lot.contentHash}>
            {shortenHash(lot.contentHash, 8, 6)}
          </span>
        </div>

        {parentId ? (
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em] mt-2 inline-flex items-center gap-1 text-muted-foreground"
            data-ocid={`lot.parent_mark.${index + 1}`}
          >
            <CornerDownRight className="size-3.5" aria-hidden="true" />
            Split from {parentId}
          </p>
        ) : null}
      </div>

      {thumbnailId ? (
        <span
          className="hidden size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted sm:flex"
          data-ocid={`lot.thumbnail.${index + 1}`}
        >
          <ImageIcon
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        </span>
      ) : null}
    </button>
  );
}
