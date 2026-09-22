import { useClaimAdmin } from "@/hooks/use-register";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

interface ClaimAdminCardProps {
  className?: string;
}

/**
 * The bootstrap path: while the register has no administrator, the first
 * identity to claim the role becomes one. After that the call fails and the
 * card explains why.
 */
export function ClaimAdminCard({ className }: ClaimAdminCardProps) {
  const claimAdmin = useClaimAdmin();

  return (
    <div
      className={cn("block-face block-face-open px-4 py-5", className)}
      data-ocid="admin.claim_card"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-base font-medium text-foreground">
            No administrator yet
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            The register has no administrator. The first identity to claim the
            role becomes the administrator and can then assign roles to every
            other actor.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => claimAdmin.mutate()}
        disabled={claimAdmin.isPending}
        data-ocid="admin.claim_admin_button"
        className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-sm bg-primary px-4 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-10"
      >
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        {claimAdmin.isPending ? "Claiming…" : "Claim administrator"}
      </button>

      {claimAdmin.isError ? (
        <p
          className="mt-3 text-base text-destructive"
          data-ocid="admin.claim_error_state"
        >
          The administrator role is already held by another principal. Ask that
          administrator to assign you a role.
        </p>
      ) : null}
    </div>
  );
}
