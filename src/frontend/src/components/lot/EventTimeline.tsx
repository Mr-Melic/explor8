import { AppendEventPanel } from "@/components/lot/AppendEventPanel";
import type { CorrectionTarget } from "@/components/lot/AppendEventPanel";
import { HashDisplay } from "@/components/lot/HashDisplay";
import { StatusPill } from "@/components/lot/StatusPill";
import { useReferenceData } from "@/hooks/use-reference-data";
import type { EventView, LotView, StatusChange } from "@/lib/backend";
import { EventKind, RefKind } from "@/lib/backend";
import {
  eventLabel,
  formatTimestamp,
  humanizeToken,
  shortenPrincipal,
} from "@/lib/format";
import { Paperclip, Undo2 } from "lucide-react";
import { useState } from "react";

interface EventTimelineProps {
  lot: LotView;
  /** Whether the signed-in principal may append events to this lot. */
  canAppend: boolean;
  /** Whether the lot is sealed against further events. */
  frozen: boolean;
}

/**
 * The Precious Material Origin History timeline for a lot, oldest first, with
 * the append panel at
 * the foot. History reads downward and never rewrites: a correction event
 * points back at the sequence it supersedes instead of replacing it.
 *
 * Each row stacks its sequence, kind, timestamp and principal on a phone so
 * the metadata never runs off the edge of the block.
 */
export function EventTimeline({ lot, canAppend, frozen }: EventTimelineProps) {
  const [correctionTarget, setCorrectionTarget] =
    useState<CorrectionTarget | null>(null);
  const { labelFor } = useReferenceData();

  const ordered = [...lot.events].sort((a, b) =>
    a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0,
  );

  // A status-change event carries the resulting status in the lot's status
  // history, keyed by the same Precious Material Origin History sequence.
  // Resolve it here so the
  // timeline can show which status the event moved the block to.
  const statusBySeq = new Map<string, StatusChange>();
  for (const change of lot.statusHistory ?? []) {
    statusBySeq.set(change.seq.toString(), change);
  }

  const statusLabel = (status: string): string =>
    labelFor(RefKind.status, status) ?? humanizeToken(status);

  return (
    <div className="min-w-0">
      {ordered.length === 0 ? (
        <p
          className="text-base text-muted-foreground"
          data-ocid="lot.events_empty_state"
        >
          No events have been appended to this lot yet. The opening entry is the
          block itself.
        </p>
      ) : (
        <ol className="space-y-4" data-ocid="lot.event_timeline">
          {ordered.map((event, index) => (
            <EventRow
              key={`${lot.id}-event-${event.seq.toString()}`}
              event={event}
              index={index}
              statusChange={statusBySeq.get(event.seq.toString())}
              statusLabel={statusLabel}
              canCorrect={canAppend && !frozen}
              onCorrect={() =>
                setCorrectionTarget({
                  seq: event.seq,
                  field: "payload",
                  oldValue: event.payload,
                })
              }
            />
          ))}
        </ol>
      )}

      <AppendEventPanel
        lotId={lot.id}
        canAppend={canAppend}
        frozen={frozen}
        correctionTarget={correctionTarget}
        onCorrectionConsumed={() => setCorrectionTarget(null)}
      />
    </div>
  );
}

function EventRow({
  event,
  index,
  statusChange,
  statusLabel,
  canCorrect,
  onCorrect,
}: {
  event: EventView;
  index: number;
  statusChange?: StatusChange;
  statusLabel: (status: string) => string;
  canCorrect: boolean;
  onCorrect: () => void;
}) {
  const superseded = event.supersededBy;
  const isStatusChange = event.kind === EventKind.status_change;

  return (
    <li
      className="border-l-2 border-accent/50 pl-3"
      data-ocid={`lot.event_row.${index + 1}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="hash shrink-0 text-sm">#{event.seq.toString()}</span>
        <span className="text-base font-medium text-foreground">
          {isStatusChange ? "Status change" : eventLabel(event.kind)}
        </span>
      </div>

      {isStatusChange && statusChange ? (
        <div
          className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5"
          data-ocid={`lot.event_status_result.${index + 1}`}
        >
          <span className="text-sm text-muted-foreground">
            {statusLabel(statusChange.from)}
          </span>
          <span className="text-sm text-muted-foreground" aria-hidden="true">
            →
          </span>
          <StatusPill status={statusChange.to} />
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="hash text-sm">{formatTimestamp(event.at)}</span>
        <span className="hash text-sm" title={event.by.toString()}>
          {shortenPrincipal(event.by.toString())}
        </span>
      </div>

      {event.payload ? (
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {event.payload}
        </p>
      ) : null}

      {superseded !== undefined ? (
        <p
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-warning"
          data-ocid={`lot.event_supersedes.${index + 1}`}
        >
          <Undo2 className="size-4" aria-hidden="true" />
          Corrects event #{superseded.toString()}
        </p>
      ) : null}

      {event.fileIds.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {event.fileIds.map((fileId) => (
            <li
              key={`${event.seq.toString()}-${fileId}`}
              className="hash inline-flex items-center gap-1 text-sm"
            >
              <Paperclip className="size-3.5" aria-hidden="true" />
              {fileId}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <HashDisplay hash={event.payloadHash} label="payload" />
        {canCorrect ? (
          <button
            type="button"
            onClick={onCorrect}
            data-ocid={`lot.event_correct_button.${index + 1}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            Correct this event
          </button>
        ) : null}
      </div>
    </li>
  );
}
