import { HashDisplay } from "@/components/lot/HashDisplay";
import { StatusPill } from "@/components/lot/StatusPill";
import { TypePill } from "@/components/lot/TypePill";
import type { LotView } from "@/lib/backend";
import {
  eventLabel,
  formatDate,
  formatGrams,
  formatTimestamp,
  shortenPrincipal,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Scale, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface LotBlockProps {
  lot: LotView;
  /** Position in the feed, used for the deterministic test marker. */
  index: number;
}

/**
 * A lot rendered as a sealed block: night-sky face, hairline border, and a
 * lime left edge once opened. The hash line beneath the header is the
 * signature detail — Precious Material Origin History you can read like a
 * ledger entry.
 *
 * The block is single-column at every width; the metadata column that sits to
 * the right on a tablet folds under the header on a phone.
 */
export function LotBlock({ lot, index }: LotBlockProps) {
  const [open, setOpen] = useState(false);
  const eventCount = lot.events.length;

  return (
    <article
      className={cn(
        "block-face transition-quick",
        open && "block-face-open shadow-block-open",
      )}
      data-ocid={`lot.item.${index + 1}`}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
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
            <StatusPill status={lot.status} />
            <TypePill lotType={lot.lotType} />
            {lot.frozen ? (
              <span className="pill pill-frozen">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Sealed
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm text-muted-foreground">
              {lot.project || "Unassigned mining site"}
            </span>
            <span className="text-sm text-muted-foreground">
              Lot {lot.sealNo || "—"}
            </span>
            <span className="text-sm text-muted-foreground">
              Ref {lot.workingRef || "—"}
            </span>
          </div>

          <div className="mt-2.5">
            <HashDisplay hash={lot.contentHash} />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 sm:hidden">
            <span className="hash text-sm">{formatDate(lot.openedAt)}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {eventCount} {eventCount === 1 ? "event" : "events"}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <p className="hash text-sm">{formatDate(lot.openedAt)}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] mt-1.5 text-muted-foreground">
            {eventCount} {eventCount === 1 ? "event" : "events"}
          </p>
        </div>
      </button>

      {open ? (
        <div className="animate-block-seal border-t border-border px-4 py-5">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Gross weight">
              <span className="inline-flex items-center gap-1.5">
                <Scale
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {formatGrams(lot.grossG)}
              </span>
            </Field>
            <Field label="Coordinates">
              <span className="inline-flex items-center gap-1.5">
                <MapPin
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="hash text-sm">{lot.gps || "—"}</span>
              </span>
            </Field>
            <Field label="Mining Licence">
              <span className="hash text-sm">{lot.licence || "—"}</span>
            </Field>
            <Field label="Registered at">
              <span className="hash text-sm">
                {formatTimestamp(lot.openedAt)}
              </span>
            </Field>
            <Field label="Registered by">
              <span className="hash text-sm" title={lot.openedBy.toString()}>
                {shortenPrincipal(lot.openedBy.toString())}
              </span>
            </Field>
            <Field label="Parent lots">
              <span className="hash text-sm">
                {lot.parentIds.length
                  ? lot.parentIds.join(", ")
                  : "None — root lot"}
              </span>
            </Field>
          </dl>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Sealed content hash
            </p>
            <div className="mt-2">
              <HashDisplay hash={lot.contentHash} full />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Precious Material Origin History events
            </p>
            {eventCount === 0 ? (
              <p className="mt-3 text-base text-muted-foreground">
                No events recorded against this lot yet.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {lot.events.map((event) => (
                  <li
                    key={`${lot.id}-event-${event.seq.toString()}`}
                    className="border-l-2 border-accent/50 pl-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="hash text-sm">
                        #{event.seq.toString()}
                      </span>
                      <span className="text-base font-medium text-foreground">
                        {eventLabel(event.kind)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="hash text-sm">
                        {formatTimestamp(event.at)}
                      </span>
                      <span
                        className="hash text-sm"
                        title={event.by.toString()}
                      >
                        {shortenPrincipal(event.by.toString())}
                      </span>
                    </div>
                    {event.payload ? (
                      <p className="mt-2 text-base text-muted-foreground">
                        {event.payload}
                      </p>
                    ) : null}
                    <span className="mt-2 block">
                      <HashDisplay hash={event.payloadHash} label="payload" />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {lot.hashChain.length ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Hash chain
              </p>
              <ol className="mt-3 space-y-2.5">
                {lot.hashChain.map((entry) => (
                  <li
                    key={`${lot.id}-chain-${entry.eventSeq.toString()}`}
                    className="flex flex-col gap-1 border-l-2 border-accent/50 pl-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
                  >
                    <span className="hash text-sm">
                      #{entry.eventSeq.toString()}
                    </span>
                    <HashDisplay hash={entry.contentHash} copyable={false} />
                    <span className="hash text-sm">
                      {formatTimestamp(entry.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {lot.fileHashes.length ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Stored files
              </p>
              <ul className="mt-3 space-y-2.5">
                {lot.fileHashes.map((file) => (
                  <li
                    key={`${lot.id}-file-${file.fileId}`}
                    className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
                  >
                    <span className="hash text-sm">{file.fileId}</span>
                    <HashDisplay hash={file.contentHash} copyable={false} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-base text-foreground">
        {children}
      </dd>
    </div>
  );
}
