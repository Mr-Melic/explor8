import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun } from "lucide-react";

/**
 * Dark is the register's default; light is a tuned daylight inversion.
 * The choice persists across visits.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      data-ocid="theme.toggle"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
