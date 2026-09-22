import { shortenHash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface HashDisplayProps {
  hash: string;
  /** Show the full 64-character hash instead of the shortened form. */
  full?: boolean;
  /** Offer a copy control beside the hash. */
  copyable?: boolean;
  label?: string;
  className?: string;
}

/**
 * A content hash set in monospace at ledger scale. The shortened form keeps
 * the block feed readable; the full form is one click away.
 *
 * The hash is the register's signature detail, so it is set a step larger than
 * body micro-copy and always breaks rather than overflowing its column on a
 * phone.
 */
export function HashDisplay({
  hash,
  full = false,
  copyable = true,
  label,
  className,
}: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2",
        className,
      )}
    >
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-[0.14em] shrink-0 text-muted-foreground">
          {label}
        </span>
      ) : null}
      <span
        className={cn("hash break-all text-sm", full && "text-xs sm:text-sm")}
        title={hash}
        data-ocid="lot.hash"
      >
        {full ? hash : shortenHash(hash)}
      </span>
      {copyable ? (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Hash copied" : "Copy content hash"}
          data-ocid="lot.copy_hash_button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-quick hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
      ) : null}
    </span>
  );
}
