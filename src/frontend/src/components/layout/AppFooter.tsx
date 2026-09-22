import { useDataMode } from "@/hooks/use-data-mode";
import { useHasAdmin, useRegisterSummary } from "@/hooks/use-register";
import { useMyRole } from "@/hooks/use-role";
import { formatCount } from "@/lib/format";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

const DISCLAIMER =
  "Public register of sealed lots. Records are append-only. A content hash seals the fields and stored files. This is not a mineral resource, not an offer of securities, and not a gold-backed token.";

/**
 * The attribution line. The range always opens at 2026 and closes on the
 * current year plus one, so it advances on its own every January without a
 * code change: 2026 – 2027 now, 2026 – 2028 next year, and so on.
 */
function attributionYears(): string {
  const endYear = new Date().getFullYear() + 1;
  return `2026 – ${endYear}`;
}

/**
 * The register's closing note: the append-only disclaimer, the live totals and
 * the administrator's way into the admin panel.
 *
 * The Admin button is shown to a signed-in administrator, and also to a
 * signed-in principal with no role while the register still has no
 * administrator — that is the only route to the bootstrap claim screen, so it
 * must not be hidden behind the role it is there to create. Once an
 * administrator exists the claim path is withdrawn. Everyone else sees the
 * register's public footer unchanged. Every row wraps cleanly at phone and
 * tablet widths.
 */
export function AppFooter() {
  const { data: summary } = useRegisterSummary();
  const { capabilities } = useMyRole();
  const { isAuthenticated } = useInternetIdentity();
  const { mode, demoSummary } = useDataMode();
  const { data: hasAdmin } = useHasAdmin(isAuthenticated);

  const activeSummary = mode === "demo" ? demoSummary : summary;

  // A signed-in principal who is not already an administrator may be the
  // register's first one, so the claim path stays reachable until an
  // administrator exists. `getMyRole` answers `guest` for a roleless principal,
  // so the gate must not depend on `awaitingRole`.
  const showAdminLink =
    capabilities.canAdminister ||
    (isAuthenticated && !capabilities.canAdminister && hasAdmin === false);

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {DISCLAIMER}
        </p>

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
          <p className="hash" data-ocid="footer.lot_count">
            {activeSummary
              ? `${formatCount(activeSummary.totalLots)} lots sealed`
              : "— lots sealed"}
          </p>
          <p className="hash" data-ocid="footer.event_count">
            {activeSummary
              ? `${formatCount(activeSummary.totalEvents)} events recorded`
              : "— events recorded"}
          </p>
          <p className="hash">Jewel of Africa Limited · Lusaka, Zambia</p>

          {showAdminLink ? (
            <Link
              to="/admin"
              data-ocid="footer.admin_button"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:ml-auto sm:h-9"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {capabilities.canAdminister ? "Admin" : "Claim administrator"}
            </Link>
          ) : null}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          © {attributionYears()}. Built with love by Le Royalties Sergio Melicio
          for Jewel of Africa
        </p>
      </div>
    </footer>
  );
}
