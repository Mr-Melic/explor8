import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { LogIn } from "lucide-react";

interface SignInButtonProps {
  className?: string;
  /** Compact variant for dense header rows. */
  size?: "sm" | "default";
}

/**
 * Internet Identity is the only way into the register. No email, no password,
 * no social provider — the principal is the identity.
 */
export function SignInButton({
  className,
  size = "default",
}: SignInButtonProps) {
  const { login, isLoggingIn, isInitializing } = useInternetIdentity();
  const busy = isLoggingIn || isInitializing;

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={busy}
      data-ocid="auth.sign_in_button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm bg-primary font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        size === "sm" ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs",
        className,
      )}
    >
      <LogIn className="size-3.5" aria-hidden="true" />
      {isLoggingIn ? "Signing in…" : "Sign in"}
    </button>
  );
}
