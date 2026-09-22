import { ChainMark } from "@/components/layout/ChainMark";
import { RegisterLotPanel } from "@/components/lot/RegisterLotPanel";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useDataMode } from "@/hooks/use-data-mode";
import { useMyRole } from "@/hooks/use-role";
import { shortenPrincipal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { LogIn, LogOut, Plus } from "lucide-react";
import { useState } from "react";

/**
 * The register masthead: the Explor8 wordmark, its Jewel of Africa parentage,
 * the animated chain mark, the licence reminder, the live/demo switch and the
 * sign-in state.
 *
 * The subtitle is never truncated and never wraps: it stays on ONE horizontal
 * line at every viewport width, shrinking its font on a phone and lighting
 * "JEWEL OF AFRICA" in the accent while "A product of" stays muted.
 *
 * A writing role also gets the fixed "Register lot" action, which opens the
 * register drawer over the library rather than navigating away.
 */
export function AppHeader() {
  const { login, clear, isAuthenticated, isLoggingIn, isInitializing } =
    useInternetIdentity();
  const { capabilities, principal } = useMyRole();
  const { mode } = useDataMode();
  const [registerOpen, setRegisterOpen] = useState(false);

  // Demo data is browser-only, so no write affordance is offered while it is
  // on — the register drawer would have nothing real to seal against.
  const canRegister = capabilities.canWrite && mode === "live";

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6 md:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <ChainMark className="h-8 w-14 md:h-9 md:w-16" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none tracking-tight text-foreground md:text-3xl">
              Explor8
            </p>
            <p className="header-subtitle mt-1">
              <span>A product of</span>
              <span className="subtitle-brand">Jewel of Africa</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:justify-end">
          <p className="order-last w-full text-[10px] leading-snug text-muted-foreground sm:text-[11px] md:order-none md:w-auto md:max-w-[20rem] md:text-right">
            Licensed mineral dealer · Licence reminder: every lot must carry a
            valid JOA licence reference.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <DataModeToggle />

            {canRegister ? (
              <button
                type="button"
                onClick={() => setRegisterOpen(true)}
                data-ocid="header.register_lot_button"
                className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Register lot
              </button>
            ) : null}

            {isAuthenticated ? (
              <>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {capabilities.awaitingRole
                      ? "Awaiting role"
                      : capabilities.label}
                  </p>
                  <p
                    className="hash truncate"
                    title={principal ?? undefined}
                    data-ocid="header.principal"
                  >
                    {principal ? shortenPrincipal(principal) : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clear}
                  data-ocid="header.sign_out_button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => login()}
                disabled={isLoggingIn || isInitializing}
                data-ocid="header.sign_in_button"
                className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
              >
                <LogIn className="size-3.5" aria-hidden="true" />
                {isLoggingIn ? "Signing in…" : "Sign in"}
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="rule-gold" />

      <RegisterLotPanel
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={openRegisteredLot}
      />
    </header>
  );
}

/**
 * The live/demo switch.
 *
 * Real-time reads the canister's own register. Demo data generates a fresh
 * random dataset in the browser on every switch — nothing is stored and the
 * live register is never touched.
 */
function DataModeToggle() {
  const { mode, setMode } = useDataMode();

  return (
    <fieldset
      className="inline-flex items-center rounded-sm border border-border bg-background p-0.5"
      aria-label="Register data source"
      data-ocid="header.data_mode_toggle"
    >
      <ModeButton
        active={mode === "live"}
        onClick={() => setMode("live")}
        marker="header.realtime_button"
      >
        Real-time
      </ModeButton>
      <ModeButton
        active={mode === "demo"}
        onClick={() => setMode("demo")}
        marker="header.demo_button"
      >
        Demo data
      </ModeButton>
    </fieldset>
  );
}

function ModeButton({
  active,
  onClick,
  marker,
  children,
}: {
  active: boolean;
  onClick: () => void;
  marker: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-ocid={marker}
      className={cn(
        "inline-flex h-9 items-center rounded-sm px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Place the freshly sealed block at the top of the library and expand it.
 *
 * The library reads its expansion from the `?lot=` deep link, so the header
 * only has to publish that link — the register itself owns the ordering.
 */
function openRegisteredLot(lotId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("lot", lotId);
  window.history.replaceState(null, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}
