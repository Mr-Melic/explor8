import { SignInButton } from "@/components/auth/SignInButton";
import { cn } from "@/lib/utils";
import { Clock3 } from "lucide-react";

interface AwaitingRoleNoticeProps {
  /** Signed in with Internet Identity. */
  isAuthenticated: boolean;
  className?: string;
}

/**
 * The honest in-between state: signed in, but the register has not assigned a
 * role yet. Reading stays open; writing stays closed until an admin acts.
 */
export function AwaitingRoleNotice({
  isAuthenticated,
  className,
}: AwaitingRoleNoticeProps) {
  if (!isAuthenticated) {
    return (
      <div
        className={cn("block-face px-4 py-5", className)}
        data-ocid="auth.signed_out_notice"
      >
        <p className="text-base leading-relaxed text-muted-foreground">
          Reading the Explor8 register is open to everyone. Sign in with
          Internet Identity to register lots and append provenance events.
        </p>
        <div className="mt-4">
          <SignInButton />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("block-face block-face-open px-4 py-5", className)}
      data-ocid="auth.awaiting_role_notice"
    >
      <div className="flex items-start gap-3">
        <Clock3
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-base font-medium text-foreground">
            Waiting for an administrator to assign a role
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            Your principal is recorded, but it holds no role yet. Until an
            administrator assigns one you have read-only access to the register.
          </p>
        </div>
      </div>
    </div>
  );
}
