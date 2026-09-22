import { StatusPill } from "@/components/lot/StatusPill";
import { useFreezeLot, useLots } from "@/hooks/use-register";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { useState } from "react";

interface FreezeLotControlProps {
  className?: string;
}

/**
 * Freezing is the register's only terminal act: once a lot is frozen no further
 * events are accepted except a note by an administrator. It is never undone.
 */
export function FreezeLotControl({ className }: FreezeLotControlProps) {
  const { data: lots, isLoading } = useLots();
  const freezeLot = useFreezeLot();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const openLots = (lots ?? []).filter((lot) => !lot.frozen);

  function handleFreeze(lotId: string) {
    setPendingId(lotId);
    freezeLot.mutate(lotId, {
      onSettled: () => setPendingId(null),
    });
  }

  return (
    <div
      className={cn("block-face px-4 py-5", className)}
      data-ocid="admin.freeze_panel"
    >
      <div className="flex items-start gap-3">
        <Lock
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-base font-medium text-foreground">Freeze a lot</p>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            Freezing seals a lot against further events. Only an administrator
            may freeze, and a frozen lot accepts nothing but an administrative
            note. This cannot be undone.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p
          className="mt-4 text-base text-muted-foreground"
          data-ocid="admin.freeze_loading_state"
        >
          Loading lots…
        </p>
      ) : openLots.length === 0 ? (
        <p
          className="mt-4 text-base text-muted-foreground"
          data-ocid="admin.freeze_empty_state"
        >
          Every lot in the register is already frozen.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {openLots.map((lot, index) => (
            <li
              key={lot.id}
              className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4"
              data-ocid={`admin.freeze_lot.${index + 1}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-base tracking-tight text-foreground">
                    {lot.id}
                  </span>
                  <StatusPill status={lot.status} />
                </div>
                <p className="hash mt-1.5">
                  Opened {formatDate(lot.openedAt)} · {lot.events.length}{" "}
                  {lot.events.length === 1 ? "event" : "events"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleFreeze(lot.id)}
                disabled={freezeLot.isPending && pendingId === lot.id}
                data-ocid={`admin.freeze_button.${index + 1}`}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
              >
                <Lock className="size-3.5" aria-hidden="true" />
                {freezeLot.isPending && pendingId === lot.id
                  ? "Freezing…"
                  : "Freeze lot"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {freezeLot.isError ? (
        <p
          className="mt-3 text-base text-destructive"
          data-ocid="admin.freeze_error_state"
        >
          The lot could not be frozen. Only an administrator may freeze a lot.
        </p>
      ) : null}
    </div>
  );
}
