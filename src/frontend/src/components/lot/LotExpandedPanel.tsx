import { DeleteLotDialog } from "@/components/lot/DeleteLotDialog";
import { EventTimeline } from "@/components/lot/EventTimeline";
import { HashChainList } from "@/components/lot/HashChainList";
import { HashDisplay } from "@/components/lot/HashDisplay";
import { LotQrCode } from "@/components/lot/LotQrCode";
import { PhotoStrip } from "@/components/lot/PhotoStrip";
import { StatusChangeControl } from "@/components/lot/StatusChangeControl";
import { StatusHistoryPanel } from "@/components/lot/StatusHistoryPanel";
import { StatusPill } from "@/components/lot/StatusPill";
import { TypePill } from "@/components/lot/TypePill";
import { VerifyFilesButton } from "@/components/lot/VerifyFilesButton";
import type { LotView } from "@/lib/backend";
import { formatGrams, formatTimestamp, shortenPrincipal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronRight, Link2, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

interface LotExpandedPanelProps {
  lot: LotView;
  /** Whether the signed-in principal may append events. */
  canAppend: boolean;
  /** Whether the signed-in principal holds the `delete_lot` capability. */
  canDelete?: boolean;
  /** Resolved object-storage URLs for the lot's photographs. */
  photoUrls: Record<string, string>;
  /** Expand a linked lot and collapse the current one. */
  onOpenLot: (lotId: string) => void;
  /**
   * Close the expanded view after this lot is removed from the register.
   * Optional so existing call sites keep compiling; falls back to `onOpenLot`.
   */
  onDeleted?: (lotId: string) => void;
  /** Ids of lots that name this lot as a parent. */
  childIds: string[];
}

/**
 * The opened block face. Everything a reader needs to audit one lot, in the
 * order the register reads: identity, seal, deep link, facts, photographs,
 * lineage, then the chain of events that produced it.
 *
 * The panel is single-column on a phone — facts, QR, photos and the timeline
 * all stack — and only splits into a facts/QR row once there is tablet width.
 */
export function LotExpandedPanel({
  lot,
  canAppend,
  canDelete = false,
  photoUrls,
  onOpenLot,
  onDeleted = onOpenLot,
  childIds,
}: LotExpandedPanelProps) {
  const [showChain, setShowChain] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="animate-block-seal border-t border-border px-4 py-5 md:px-5 md:py-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-display text-xl leading-none tracking-tight text-foreground md:text-2xl">
          {lot.id}
        </span>
        <StatusPill status={lot.status} />
        <TypePill lotType={lot.lotType} />
        {lot.frozen ? (
          <span className="pill pill-frozen" data-ocid="lot.freeze_badge">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Sealed — no further events
          </span>
        ) : null}
      </div>

      <section className="mt-6" data-ocid="lot.hash_section">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sealed content hash
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
          <HashDisplay hash={lot.contentHash} full />
          <button
            type="button"
            onClick={() => setShowChain((current) => !current)}
            aria-expanded={showChain}
            data-ocid="lot.hash_chain_toggle"
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            <Link2 className="size-3.5" aria-hidden="true" />
            {showChain ? "Hide chain" : "Show chain"}
          </button>
        </div>
        {showChain ? (
          <HashChainList entries={lot.hashChain} className="mt-4" />
        ) : null}
      </section>

      <section className="mt-7" data-ocid="lot.status_section">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Status
        </p>
        <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StatusChangeControl lot={lot} />
          <StatusHistoryPanel lot={lot} />
        </div>
      </section>

      <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
        <section data-ocid="lot.facts_section">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Lot facts
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Fact label="Licence" value={lot.licence || "—"} mono />
            <Fact label="Project" value={lot.project || "—"} />
            <Fact label="Coordinates" value={lot.gps || "—"} mono />
            <Fact label="Working ref" value={lot.workingRef || "—"} mono />
            <Fact label="Seal number" value={lot.sealNo || "—"} mono />
            <Fact label="Gross weight" value={formatGrams(lot.grossG)} />
            <Fact
              label="Opened at"
              value={formatTimestamp(lot.openedAt)}
              mono
            />
            <Fact
              label="Opened by"
              value={shortenPrincipal(lot.openedBy.toString())}
              title={lot.openedBy.toString()}
              mono
            />
          </dl>
        </section>

        <section className="lg:w-60" data-ocid="lot.qr_section">
          <LotQrCode lotId={lot.id} />
        </section>
      </div>

      <section className="mt-7" data-ocid="lot.photos_section">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Photographs
        </p>
        <PhotoStrip
          photoFileIds={lot.photoFileIds}
          urls={photoUrls}
          className="mt-3"
        />
      </section>

      <section className="mt-7" data-ocid="lot.lineage_section">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Lineage
        </p>
        <div className="mt-3 space-y-3">
          <LineageRow
            label="Split from"
            ids={lot.parentIds}
            emptyLabel="Root lot — no parent"
            onOpenLot={onOpenLot}
            marker="lot.parent_link"
          />
          <LineageRow
            label="Split into"
            ids={childIds}
            emptyLabel="No child lots recorded"
            onOpenLot={onOpenLot}
            marker="lot.child_link"
          />
        </div>
      </section>

      <section className="mt-7" data-ocid="lot.events_section">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Provenance events
        </p>
        <div className="mt-3">
          <EventTimeline lot={lot} canAppend={canAppend} frozen={lot.frozen} />
        </div>
      </section>

      <section
        className="mt-7 border-t border-border pt-5"
        data-ocid="lot.files_section"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Sealed files
        </p>
        {lot.fileHashes.length === 0 ? (
          <p className="mt-3 text-base text-muted-foreground">
            No files are sealed against this lot.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {lot.fileHashes.map((file) => (
              <li
                key={file.fileId}
                className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
              >
                <span className="hash text-sm">{file.fileId}</span>
                <HashDisplay hash={file.contentHash} copyable={false} />
              </li>
            ))}
          </ul>
        )}
        <VerifyFilesButton
          lot={lot}
          fileHashes={lot.fileHashes}
          className="mt-4"
        />
      </section>

      {canDelete ? (
        <section
          className="mt-7 border-t border-border pt-5"
          data-ocid="lot.delete_section"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Remove this block
          </p>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Deleting removes this block, its events, its hash chain and its
            stored files from the register. This cannot be undone.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              data-ocid="lot.delete_button"
              className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-destructive px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive-foreground transition-quick hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete block
            </button>
          </div>
        </section>
      ) : null}

      <DeleteLotDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        lotId={lot.id}
        onDeleted={onDeleted}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  title,
  mono = false,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 break-words text-base text-foreground",
          mono && "hash text-sm",
        )}
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function LineageRow({
  label,
  ids,
  emptyLabel,
  onOpenLot,
  marker,
}: {
  label: string;
  ids: string[];
  emptyLabel: string;
  onOpenLot: (lotId: string) => void;
  marker: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] shrink-0 text-muted-foreground">
        {label}
      </span>
      {ids.length === 0 ? (
        <span className="hash text-sm">{emptyLabel}</span>
      ) : (
        <span className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpenLot(id)}
              data-ocid={marker}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-quick hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <span className="hash text-sm">{id}</span>
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
