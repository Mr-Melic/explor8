import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/hooks/use-theme";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * The dark-first theme.
 *
 * The accepted requirement is a dark-first shell built from the eight-colour
 * scheme. Dark is the base palette on `:root`, so the default applies no class;
 * the opt-in light variant is the `.light` class on the document root. The
 * choice persists in `localStorage` under `explor8-theme`.
 */

function ThemeProbe() {
  const { theme } = useTheme();
  // The suite configures `data-ocid` as the test-id attribute, so the probe
  // uses the app's own convention.
  return <span data-ocid="theme.probe">{theme}</span>;
}

describe("useTheme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "";
  });

  it("defaults to dark with no light class on the document root", () => {
    render(<ThemeProbe />);

    expect(screen.getByTestId("theme.probe")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("restores a persisted light choice on mount", () => {
    window.localStorage.setItem("explor8-theme", "light");
    render(<ThemeProbe />);

    expect(screen.getByTestId("theme.probe")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("ignores an unrecognised stored value and stays dark", () => {
    window.localStorage.setItem("explor8-theme", "sepia");
    render(<ThemeProbe />);

    expect(screen.getByTestId("theme.probe")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "";
  });

  it("starts dark, toggles to light and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = screen.getByTestId("theme.toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName("Switch to light theme");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Switch to dark theme");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(window.localStorage.getItem("explor8-theme")).toBe("light");
  });

  it("toggles back to dark and clears the light class", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("explor8-theme", "light");
    render(<ThemeToggle />);

    const toggle = screen.getByTestId("theme.toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(window.localStorage.getItem("explor8-theme")).toBe("dark");
  });
});
