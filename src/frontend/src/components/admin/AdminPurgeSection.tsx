import { PurgeConfirmDialog } from "@/components/admin/PurgeConfirmDialog";
import { useConfirmPurge, usePurgeRequest } from "@/hooks/use-admin-data";
import type {
  PurgeOutcome,
  PurgeRequestView,
  PurgeResult,
} from "@/lib/backend";
import { formatCount, formatTimestamp, shortenPrincipal } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

interface AdminPurgeSectionProps {
  /** Whether the signed-in principal may purge the register. */
  canAdminister: boolean;
}

/**
 * Purge register data: the admin-only destructive action.
 *
 * The register is append-only, so this is the one irreversible operation. It is
 * offered only to a signed-in administrator who also holds the
 * `purge_register` capability, and it never runs on one administrator's word:
 * the request opens a confirmation round and the backend executes the purge
 * automatically once more than half of the currently-assigned administrators
 * have confirmed the same request.
 *
 * The panel polls the open request so the requesting administrator watches the
 * confirmation count climb, and reports the result — lots, events and files
 * removed — once the threshold is met.
 */
export function AdminPurgeSection({ canAdminister }: AdminPurgeSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<PurgeResult | null>(null);

  const { data: request, isLoading } = usePurgeRequest(canAdminister);
  const confirmPurge = useConfirmPurge();

  if (!canAdminister) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.purge_locked_state"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-base leading-relaxed text-muted-foreground">
            Only a signed-in administrator may purge register data. Ask an
            administrator to grant you access.
          </p>
        </div>
      </div>
    );
  }

  function handleOutcome(outcome: PurgeOutcome) {
    if (outcome.__kind__ === "executed") {
      setResult(outcome.executed);
      void queryClient.invalidateQueries({ queryKey: ["lots"] });
      void queryClient.invalidateQueries({ queryKey: ["lot"] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
      void queryClient.invalidateQueries({ queryKey: ["register-summary"] });
    }
  }

  function handleConfirmRequest() {
    confirmPurge.mutate(undefined, {
      onSuccess: (outcome) => handleOutcome(outcome),
    });
  }

  return (
    <div className="mt-3 space-y-4" data-ocid="admin.purge_panel">
      {result ? (
        <PurgeResultPanel result={result} />
      ) : request ? (
        <PendingPurgePanel
          request={request}
          isConfirming={confirmPurge.isPending}
          confirmError={
            confirmPurge.isError
              ? confirmPurge.error instanceof Error
                ? confirmPurge.error.message
                : "The confirmation could not be recorded."
              : null
          }
          onConfirm={handleConfirmRequest}
        />
      ) : (
        <div
          className="block-face px-4 py-6"
          data-ocid="admin.purge_idle_state"
        >
          <div className="flex items-start gap-3">
            <Trash2
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-base leading-relaxed text-muted-foreground">
                {isLoading
                  ? "Checking for an open purge request…"
                  : "No purge request is open. Starting one asks the register's other administrators to confirm before anything is removed."}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              data-ocid="admin.purge_open_modal_button"
              className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-destructive px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive-foreground transition-quick hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Purge all register data
            </button>
          </div>
        </div>
      )}

      <PurgeConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRequested={handleOutcome}
      />
    </div>
  );
}

interface PendingPurgePanelProps {
  request: PurgeRequestView;
  isConfirming: boolean;
  confirmError: string | null;
  onConfirm: () => void;
}

/** The open request, with how many administrators have confirmed so far. */
function PendingPurgePanel({
  request,
  isConfirming,
  confirmError,
  onConfirm,
}: PendingPurgePanelProps) {
  const confirmed = Number(request.confirmedCount);
  const required = Number(request.requiredConfirmations);
  const remaining = Math.max(required - confirmed, 0);

  return (
    <div className="block-face px-4 py-5" data-ocid="admin.purge_pending_state">
      <div className="flex items-start gap-3">
        <Clock
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h3 className="font-display text-lg tracking-tight text-foreground">
            Awaiting administrator confirmations
          </h3>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            The purge runs automatically once more than half of the register's
            administrators have confirmed. No data has been removed yet.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="micro-label">Confirmed</dt>
          <dd
            className="mt-1.5 font-display text-2xl tracking-tight text-foreground"
            data-ocid="admin.purge_confirmed_count"
          >
            {formatCount(request.confirmedCount)}
            <span className="text-base text-muted-foreground">
              {" "}
              of {formatCount(request.requiredConfirmations)} required
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="micro-label">Administrators</dt>
          <dd
            className="mt-1.5 font-display text-2xl tracking-tight text-foreground"
            data-ocid="admin.purge_total_admins"
          >
            {formatCount(request.totalAdmins)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="micro-label">Requested</dt>
          <dd className="mt-1.5 text-base text-foreground">
            {formatTimestamp(request.requestedAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <progress
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-accent"
          value={confirmed}
          max={required > 0 ? required : 1}
          aria-label="Purge confirmations received"
          data-ocid="admin.purge_progress"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {remaining === 0
            ? "The threshold is met. The purge will run on the next confirmation."
            : `${remaining} more ${remaining === 1 ? "confirmation" : "confirmations"} needed.`}
        </p>
      </div>

      <div className="mt-4 min-w-0">
        <p className="micro-label">Requested by</p>
        <p
          className="hash mt-1.5 break-all"
          title={request.requestedBy.toString()}
        >
          {shortenPrincipal(request.requestedBy.toString(), 10, 10)}
        </p>
      </div>

      {confirmError ? (
        <p
          className="mt-4 text-base text-destructive"
          data-ocid="admin.purge_confirm_error_state"
        >
          {confirmError}
        </p>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          data-ocid="admin.purge_confirm_request_button"
          className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {isConfirming ? "Confirming…" : "Confirm this purge"}
        </button>
      </div>
    </div>
  );
}

/** The completed purge, with what was removed. */
function PurgeResultPanel({ result }: { result: PurgeResult }) {
  return (
    <div className="block-face px-4 py-5" data-ocid="admin.purge_success_state">
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h3 className="font-display text-lg tracking-tight text-foreground">
            The register has been purged
          </h3>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            Every block, event, hash chain and stored file was removed. Roles,
            actors and reference data were kept, and the register now shows its
            clean empty state.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="micro-label">Blocks removed</dt>
          <dd
            className="mt-1.5 font-display text-2xl tracking-tight text-foreground"
            data-ocid="admin.purge_lots_removed"
          >
            {formatCount(result.lotsRemoved)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="micro-label">Events removed</dt>
          <dd
            className="mt-1.5 font-display text-2xl tracking-tight text-foreground"
            data-ocid="admin.purge_events_removed"
          >
            {formatCount(result.eventsRemoved)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="micro-label">Files removed</dt>
          <dd
            className="mt-1.5 font-display text-2xl tracking-tight text-foreground"
            data-ocid="admin.purge_files_removed"
          >
            {formatCount(result.filesRemoved)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 min-w-0">
        <p className="micro-label">Purged</p>
        <p className="mt-1.5 text-base text-foreground">
          {formatTimestamp(result.purgedAt)}
        </p>
      </div>
    </div>
  );
}
