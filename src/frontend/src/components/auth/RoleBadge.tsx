import { Role } from "@/lib/backend";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

interface RoleBadgeProps {
  /** The role held by the principal, or `null` when none is assigned yet. */
  userRole: Role | null;
  /** Signed in but the register has not assigned a role yet. */
  awaitingRole?: boolean;
  className?: string;
}

/**
 * The role stamp shown beside a principal. Administrators get the gold-edged
 * treatment; everyone else reads as a plain ledger stamp.
 */
export function RoleBadge({
  userRole,
  awaitingRole = false,
  className,
}: RoleBadgeProps) {
  if (awaitingRole || userRole === null) {
    return (
      <span
        className={cn(
          "pill border-border bg-transparent text-muted-foreground",
          className,
        )}
        data-ocid="auth.role_badge"
      >
        Awaiting role
      </span>
    );
  }

  const isAdmin = userRole === Role.admin;

  return (
    <span
      className={cn(
        "pill",
        isAdmin
          ? "border-accent bg-transparent text-accent"
          : "border-border bg-transparent text-muted-foreground",
        className,
      )}
      data-ocid="auth.role_badge"
    >
      {isAdmin ? <ShieldCheck className="size-3" aria-hidden="true" /> : null}
      {roleLabel(userRole)}
    </span>
  );
}
