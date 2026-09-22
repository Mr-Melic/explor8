import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddAnalysisDocument,
  useAnalysisDocuments,
  useRemoveAnalysisDocument,
} from "@/hooks/use-admin-data";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { AnalysisDocumentView } from "@/lib/backend";
import { formatTimestamp, shortenHash, shortenPrincipal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

interface AdminDocumentsSectionProps {
  /** Whether the signed-in principal may read and store documents. */
  enabled: boolean;
}

const SKELETON_IDS = Array.from(
  { length: 3 },
  (_, index) => `document-skeleton-${index}`,
);

/**
 * Assay reports, spreadsheets and other analysis files kept beside the
 * register. Files are hashed in the browser and pushed to platform storage;
 * the register stores the file id and the content hash, never the bytes.
 */
export function AdminDocumentsSection({ enabled }: AdminDocumentsSectionProps) {
  const { data: documents, isLoading, isError } = useAnalysisDocuments(enabled);
  const removeDocument = useRemoveAnalysisDocument();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleRemove(id: string) {
    setPendingId(id);
    removeDocument.mutate(id, { onSettled: () => setPendingId(null) });
  }

  if (!enabled) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.documents_locked_state"
      >
        <p className="text-base text-muted-foreground">
          Only an administrator can review the stored analysis documents.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-5" data-ocid="admin.documents_panel">
      <DocumentUploadForm />

      {isLoading ? (
        <div className="space-y-2" data-ocid="admin.documents_loading_state">
          {SKELETON_IDS.map((id) => (
            <Skeleton key={id} className="h-16 w-full rounded-sm" />
          ))}
        </div>
      ) : isError ? (
        <div
          className="block-face px-4 py-6"
          data-ocid="admin.documents_error_state"
        >
          <p className="text-base text-destructive">
            The stored documents could not be read. Reload the page to try
            again.
          </p>
        </div>
      ) : (documents ?? []).length === 0 ? (
        <div
          className="block-face px-4 py-6"
          data-ocid="admin.documents_empty_state"
        >
          <p className="text-base text-muted-foreground">
            No analysis documents are stored yet. Attach an assay report or a
            spreadsheet above to keep it beside the register.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" data-ocid="admin.documents_list">
          {(documents ?? []).map((document, index) => (
            <DocumentRow
              key={document.id}
              document={document}
              index={index}
              pending={removeDocument.isPending && pendingId === document.id}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}

      {removeDocument.isError ? (
        <p
          className="text-base text-destructive"
          data-ocid="admin.documents_remove_error_state"
        >
          The document could not be removed. Only an administrator may remove
          one.
        </p>
      ) : null}
    </div>
  );
}

function DocumentRow({
  document,
  index,
  pending,
  onRemove,
}: {
  document: AnalysisDocumentView;
  index: number;
  pending: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <li
      className="block-face flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4"
      data-ocid={`admin.document_row.${index + 1}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <FileText
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-foreground">
            {document.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {document.docKind} · uploaded {formatTimestamp(document.uploadedAt)}{" "}
            by {shortenPrincipal(document.uploadedBy.toString())}
          </p>
          {document.note ? (
            <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
              {document.note}
            </p>
          ) : null}
          <p
            className="hash mt-1.5 break-all"
            title={document.contentHash}
            data-ocid={`admin.document_hash.${index + 1}`}
          >
            {shortenHash(document.contentHash)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(document.id)}
        disabled={pending}
        data-ocid={`admin.document_remove_button.${index + 1}`}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {pending ? "Removing…" : "Remove"}
      </button>
    </li>
  );
}

/**
 * Attach one document. The file is hashed and uploaded first, then the register
 * records the file id and content hash. A failed upload keeps the draft so the
 * operator can retry without retyping.
 */
function DocumentUploadForm() {
  const addDocument = useAddAnalysisDocument();
  const upload = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [docKind, setDocKind] = useState("Assay report");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const staged = upload.files[0] ?? null;
  const busy = upload.hashing || upload.uploading || addDocument.isPending;
  const canSubmit = title.trim().length > 0 && staged !== null && !busy;

  async function handleSubmit() {
    if (!canSubmit || !staged) return;
    setError(null);

    const capturedTitle = title.trim();
    const capturedKind = docKind.trim() || "Document";
    const capturedNote = note.trim();

    try {
      const uploaded = await upload.uploadAll();
      const file = uploaded[0];
      if (!file) throw new Error("The file could not be uploaded.");

      await addDocument.mutateAsync({
        title: capturedTitle,
        docKind: capturedKind,
        note: capturedNote,
        fileId: file.fileId,
        contentHash: file.contentHash,
      });

      setTitle("");
      setNote("");
      upload.clear();
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The document could not be stored.",
      );
    }
  }

  return (
    <div
      className="block-face px-4 py-4"
      data-ocid="admin.document_upload_form"
    >
      <p className="micro-label">Store an analysis document</p>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="document-title" className="micro-label">
            Title
          </label>
          <input
            id="document-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fire-assay certificate AF-9921"
            data-ocid="admin.document_title_input"
            className="mt-1.5 h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="document-kind" className="micro-label">
            Document kind
          </label>
          <input
            id="document-kind"
            type="text"
            value={docKind}
            onChange={(event) => setDocKind(event.target.value)}
            placeholder="Assay report"
            data-ocid="admin.document_kind_input"
            className="mt-1.5 h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
          />
        </div>

        <div className="min-w-0 md:col-span-2">
          <label htmlFor="document-note" className="micro-label">
            Note
          </label>
          <textarea
            id="document-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="What this document shows and which lots it covers."
            data-ocid="admin.document_note_input"
            className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label
          htmlFor="document-file"
          className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-within:ring-2 focus-within:ring-ring md:h-10"
        >
          <Paperclip className="size-3.5" aria-hidden="true" />
          Choose file
          <input
            ref={inputRef}
            id="document-file"
            type="file"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) void upload.addFiles(files.slice(0, 1));
            }}
            data-ocid="admin.document_file_input"
            className="sr-only"
          />
        </label>

        {staged ? (
          <span
            className="min-w-0 max-w-full truncate text-sm text-muted-foreground"
            data-ocid="admin.document_file_name"
          >
            {staged.file.name}
            {upload.hashing
              ? " · hashing…"
              : upload.uploading
                ? " · uploading…"
                : staged.error
                  ? ` · ${staged.error}`
                  : " · ready"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            No file chosen yet.
          </span>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-ocid="admin.document_submit_button"
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10",
          )}
        >
          <Upload className="size-3.5" aria-hidden="true" />
          {addDocument.isPending ? "Storing…" : "Store document"}
        </button>
      </div>

      {error ? (
        <p
          className="mt-3 text-base text-destructive"
          data-ocid="admin.document_upload_error_state"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
