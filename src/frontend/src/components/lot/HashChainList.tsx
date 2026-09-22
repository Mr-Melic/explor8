import { HashDisplay } from "@/components/lot/HashDisplay";
import type { HashChainEntry } from "@/lib/backend";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HashChainListProps {
  entries: HashChainEntry[];
  className?: string;
}

/**
 * The chain beneath a block: one row per appended event, each carrying the
 * content hash as it stood at that moment. Read top to bottom, the list is the
 * lot's history — the newest entry is the sealed value shown above.
 *
 * Each row stacks its sequence, hash and timestamp on a phone so the hash
 * never has to share a line with the timestamp.
 */
export function HashChainList({ entries, className }: HashChainListProps) {
  if (entries.length === 0) {
    return (
      <p
        className={cn("text-base text-muted-foreground", className)}
        data-ocid="lot.chain_empty_state"
      >
        The chain is empty. It grows as events are appended.
      </p>
    );
  }

  const ordered = [...entries].sort((a, b) =>
    a.eventSeq < b.eventSeq ? -1 : a.eventSeq > b.eventSeq ? 1 : 0,
  );

  return (
    <ol className={cn("space-y-2.5", className)} data-ocid="lot.hash_chain">
      {ordered.map((entry, index) => (
        <li
          key={`chain-${entry.eventSeq.toString()}`}
          className="flex flex-col gap-1 border-l-2 border-accent/50 pl-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3"
          data-ocid={`lot.chain_row.${index + 1}`}
        >
          <span className="hash shrink-0 text-sm">
            #{entry.eventSeq.toString()}
          </span>
          <HashDisplay hash={entry.contentHash} copyable={false} />
          <span className="hash text-sm">{formatTimestamp(entry.at)}</span>
        </li>
      ))}
    </ol>
  );
}
