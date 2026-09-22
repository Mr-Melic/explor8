import { AdminAnalyticsSection } from "@/components/admin/AdminAnalyticsSection";
import { AdminDocumentsSection } from "@/components/admin/AdminDocumentsSection";
import { AdminEnquirySection } from "@/components/admin/AdminEnquirySection";
import { AdminPermissionsSection } from "@/components/admin/AdminPermissionsSection";
import { AdminPurgeSection } from "@/components/admin/AdminPurgeSection";
import { AdminReferenceDataSection } from "@/components/admin/AdminReferenceDataSection";
import { AdminRolesSection } from "@/components/admin/AdminRolesSection";
import { ClaimAdminCard } from "@/components/admin/ClaimAdminCard";
import { AwaitingRoleNotice } from "@/components/auth/AwaitingRoleNotice";
import { RoleBadge } from "@/components/auth/RoleBadge";
import { SignInButton } from "@/components/auth/SignInButton";
import { useHasAdmin } from "@/hooks/use-register";
import { useMyRole } from "@/hooks/use-role";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * The admin panel: one page, six clearly separated sections.
 *
 * Reading the register is open to everyone; everything on this page is gated on
 * the administrator role. The register is append-only, so nothing here edits or
 * deletes a sealed lot or event — the panel manages roles, permissions,
 * reference data and analysis documents, reads the register's own analytics,
 * and offers the admin-only purge of all register data.
 *
 * The bootstrap path is deliberately reachable before any role exists: a
 * signed-in principal with no role sees the "Claim administrator" card while
 * the register has no administrator. `hasAdmin` is a public query, so the
 * panel can ask the canister directly whether the role is already taken and
 * withdraw the claim card the moment it is.
 */
export function AdminPage() {
  const { isAuthenticated } = useInternetIdentity();
  const { capabilities, principal } = useMyRole();
  const { data: hasAdmin } = useHasAdmin(isAuthenticated);

  // The claim path is open to any signed-in principal who is not already an
  // administrator, and only while the register still has no administrator.
  //
  // `getMyRole` answers `guest` — not `null` — for a principal the register has
  // never assigned a role, so `awaitingRole` is false for exactly the identity
  // the bootstrap exists for. Gate on the two facts that actually matter: the
  // caller is signed in, and the register has no administrator yet.
  const canClaimAdmin =
    isAuthenticated && !capabilities.canAdminister && hasAdmin === false;

  return (
    <div className="above-field mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <Link
        to="/"
        data-ocid="admin.back_link"
        className="micro-label inline-flex items-center gap-1.5 transition-quick hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the register
      </Link>

      <h1 className="mt-5 font-display text-3xl leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
        Admin panel
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
        Roles and access, the register's own analytics, stored analysis
        documents, and the reference data that drives every form and display.
        Sealed lots and their events are never edited or removed here.
      </p>

      <div className="rule-gold mt-6" />

      <section className="py-8" data-ocid="admin.identity_section">
        <h2 className="micro-label">Your identity</h2>

        {!isAuthenticated ? (
          <div
            className="mt-3 block-face px-4 py-6"
            data-ocid="admin.signed_out_state"
          >
            <p className="text-base text-muted-foreground">
              Sign in with Internet Identity to see the role assigned to you.
            </p>
            <div className="mt-4">
              <SignInButton />
            </div>
          </div>
        ) : (
          <div className="mt-3 block-face px-4 py-5">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="micro-label">Principal</dt>
                <dd
                  className="hash mt-1.5 break-all"
                  title={principal ?? undefined}
                  data-ocid="admin.principal"
                >
                  {principal ?? "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="micro-label">Role</dt>
                <dd className="mt-1.5">
                  <RoleBadge
                    userRole={capabilities.role}
                    awaitingRole={capabilities.awaitingRole}
                  />
                </dd>
              </div>
            </dl>

            {capabilities.awaitingRole ? (
              <div className="mt-5">
                <AwaitingRoleNotice isAuthenticated />
              </div>
            ) : null}
          </div>
        )}
      </section>

      {canClaimAdmin ? (
        <section className="pb-8" data-ocid="admin.bootstrap_section">
          <ClaimAdminCard />
        </section>
      ) : null}

      <div className="rule-gold" />

      <section className="py-8" data-ocid="admin.analytics_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Data analysis
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          The register's own analytics in full — lots and events over time, and
          every breakdown the register keeps.
        </p>
        <AdminAnalyticsSection enabled={capabilities.canAdminister} />
      </section>

      <div className="rule-gold" />

      <AdminEnquirySection />

      <div className="rule-gold" />

      <section className="py-8" data-ocid="admin.documents_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Analysis documents
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Assay reports, spreadsheets and other analysis files kept beside the
          register. Each file is hashed in the browser before it is stored.
        </p>
        <AdminDocumentsSection enabled={capabilities.canAdminister} />
      </section>

      <div className="rule-gold" />

      <section className="py-8" data-ocid="admin.roles_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Roles &amp; access
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Assign a role to a principal, change an existing assignment, or return
          a principal to guest. The first identity to claim admin becomes one.
        </p>
        <AdminRolesSection
          canAdminister={capabilities.canAdminister}
          selfPrincipal={principal}
        />
      </section>

      <div className="rule-gold" />

      <section className="py-8" data-ocid="admin.permissions_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Permissions
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Every capability the app offers, and who may perform it.
          Administrators hold all permissions by default; the Custom Role starts
          with none. Edit a role's defaults, or set an override for one
          principal.
        </p>
        <AdminPermissionsSection canAdminister={capabilities.canAdminister} />
      </section>

      <div className="rule-gold" />

      <section className="py-8" data-ocid="admin.reference_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Reference data
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          The input and display data behind every block — lot kinds, mining site
          names, statuses, event kinds, labels and form defaults. Each entry is
          addable, editable and removable.
        </p>
        <AdminReferenceDataSection enabled={capabilities.canAdminister} />
      </section>

      <div className="rule-gold" />

      <section className="py-8 pb-12" data-ocid="admin.purge_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Purge register data
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Remove every lot, event and stored file from the register. This is
          offered only to signed-in administrators and requires confirmation
          from more than half of the register's administrators.
        </p>
        <AdminPurgeSection canAdminister={capabilities.canAdminister} />
      </section>
    </div>
  );
}
