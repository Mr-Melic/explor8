import { useVerifyLotSnapshot } from "@/hooks/use-register";
import type { FileHash, LotView } from "@/lib/backend";
import { sha256HexOfFile } from "@/lib/hashing";
import { cn } from "@/lib/utils";
import { Check, FileCheck2, Loader2, ShieldCheck, X } from "lucide-react";
import { useRef, useState } from "react";

interface VerifyFilesButtonProps {
  /** The lot whose sealed content hash should be recomputed. */
  lot: LotView;
  /** The sealed per-file hashes recorded against the lot. */
  fileHashes: FileHash[];
  className?: string;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; matched: number; total: number; mismatched: string[] }
  | { kind: "error"; message: string };

/**
 * Recompute a file's SHA-256 in the browser and compare it with the sealed
 * value. This is the register's honesty check: a reader can prove a file is
 * the one that was sealed without trusting the server that served it.
 *
 * The same panel also recomputes the lot's own content hash from the
 * register's canonical snapshot, so a reader can confirm the lot record
 * itself is unaltered.
 */
export function VerifyFilesButton({
  lot,
  fileHashes,
  className,
}: VerifyFilesButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const lotVerification = useVerifyLotSnapshot();

  const sealed = new Map(fileHashes.map((file) => [file.contentHash, file]));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setState({ kind: "running" });

    try {
      let matched = 0;
      const mismatched: string[] = [];

      for (const file of Array.from(files)) {
        const digest = await sha256HexOfFile(file);
        if (sealed.has(digest)) {
          matched += 1;
        } else {
          mismatched.push(file.name);
        }
      }

      setState({
        kind: "done",
        matched,
        total: files.length,
        mismatched,
      });
    } catch {
      setState({
        kind: "error",
        message: "The file could not be read in this browser.",
      });
    }
  };

  const lotResult = lotVerification.data;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => lotVerification.mutate(lot)}
          disabled={lotVerification.isPending}
          data-ocid="lot.verify_snapshot_button"
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {lotVerification.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-3.5" aria-hidden="true" />
          )}
          {lotVerification.isPending ? "Recomputing…" : "Verify content hash"}
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Choose files to verify against the sealed hashes"
          data-ocid="lot.verify_files_input"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state.kind === "running" || fileHashes.length === 0}
          data-ocid="lot.verify_files_button"
          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {state.kind === "running" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileCheck2 className="size-3.5" aria-hidden="true" />
          )}
          {state.kind === "running" ? "Hashing…" : "Verify a file"}
        </button>
      </div>

      {lotResult ? (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 text-xs",
            lotResult.kind === "match"
              ? "text-success"
              : lotResult.kind === "mismatch"
                ? "text-destructive"
                : "text-muted-foreground",
          )}
          data-ocid="lot.verify_snapshot_state"
        >
          {lotResult.kind === "match" ? (
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ) : lotResult.kind === "mismatch" ? (
            <X className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldCheck
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>
            {lotResult.kind === "match"
              ? "Content hash matches the register's canonical snapshot."
              : lotResult.kind === "mismatch"
                ? `Content hash does not match the register's canonical snapshot. Recomputing the snapshot gives ${lotResult.recomputed}, but the lot is sealed as ${lotResult.sealed}.`
                : lotResult.message}
          </span>
        </p>
      ) : null}

      {fileHashes.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No file hashes are sealed against this lot.
        </p>
      ) : null}

      {state.kind === "done" ? (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 text-xs",
            state.mismatched.length === 0 ? "text-success" : "text-destructive",
          )}
          data-ocid="lot.verify_result_state"
        >
          {state.mismatched.length === 0 ? (
            <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {state.matched} of {state.total} file
            {state.total === 1 ? "" : "s"} match the sealed hashes.
            {state.mismatched.length > 0
              ? ` Not sealed: ${state.mismatched.join(", ")}.`
              : ""}
          </span>
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p
          className="mt-2 text-xs text-destructive"
          data-ocid="lot.verify_error_state"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
