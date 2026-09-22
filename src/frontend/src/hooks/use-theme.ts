import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "explor8-theme";

/** The register opens dark; light is the opt-in daylight inversion. */
const DEFAULT_THEME: Theme = "dark";

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Apply the theme to the document root.
 *
 * Dark is the base palette on `:root`, so it needs no class; the light
 * variant is opt-in through `.light`. `color-scheme` follows so native
 * controls and scrollbars match.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

/**
 * Dark-first theme with an optional daylight variant.
 *
 * The choice is persisted in `localStorage`; the register itself is the
 * source of truth for data, so this is purely a presentation preference.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => readStoredTheme() ?? DEFAULT_THEME,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the in-memory choice still applies */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable — the in-memory choice still applies */
      }
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
