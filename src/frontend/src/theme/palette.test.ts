import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The dark-first palette.
 *
 * The accepted requirement is a dark-first shell built from the attached
 * eight-colour scheme with no cream-white surface anywhere. jsdom computes no
 * styles, so this suite reads the stylesheet the app actually ships and asserts
 * the token contract directly: the base `:root` is dark, every surface token is
 * a dark value, and no surface token is a near-white cream.
 *
 * This is a static assertion over `index.css`, not a rendered-pixel check.
 */

// Vitest runs with the frontend package as its working directory.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/** The `:root { … }` block, which holds the dark-first base palette. */
function rootBlock(): string {
  const start = css.indexOf(":root {");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n  }", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

/** Read a bare OKLCH triple token from a CSS block. */
function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  expect(match, `--${name} must be declared`).not.toBeNull();
  return (match?.[1] ?? "").trim();
}

/** The lightness component of a bare `L C H` OKLCH triple. */
function lightness(triple: string): number {
  const value = Number.parseFloat(triple.split(/\s+/)[0] ?? "");
  expect(Number.isFinite(value), `unparseable triple: ${triple}`).toBe(true);
  return value;
}

/** The chroma component of a bare `L C H` OKLCH triple. */
function chroma(triple: string): number {
  const value = Number.parseFloat(triple.split(/\s+/)[1] ?? "");
  expect(Number.isFinite(value), `unparseable triple: ${triple}`).toBe(true);
  return value;
}

describe("Dark-first palette", () => {
  it("declares a dark base background and a light foreground on :root", () => {
    const root = rootBlock();

    // A dark ground: low lightness. The previous build's cream surface was a
    // near-white value here.
    expect(lightness(token(root, "background"))).toBeLessThan(0.35);
    // Light ink on the dark ground.
    expect(lightness(token(root, "foreground"))).toBeGreaterThan(0.8);
  });

  it("keeps every base surface token dark, with no cream-white surface", () => {
    const root = rootBlock();

    // The surfaces a reader actually sees: page, cards, popovers, secondary
    // and muted faces, and the sidebar rail.
    const surfaces = [
      "background",
      "card",
      "popover",
      "secondary",
      "muted",
      "sidebar",
      "sidebar-accent",
    ];

    for (const name of surfaces) {
      const triple = token(root, name);
      const l = lightness(triple);
      // Dark-first: no surface is a light face.
      expect(l, `--${name} (${triple}) must be dark`).toBeLessThan(0.4);
      // A cream surface is a near-white, low-chroma warm value. None may exist.
      const isCreamWhite = l > 0.9 && chroma(triple) < 0.06;
      expect(
        isCreamWhite,
        `--${name} (${triple}) must not be cream white`,
      ).toBe(false);
    }
  });

  it("does not alias the cream token to a light surface", () => {
    const root = rootBlock();

    // `--cream` is a legacy name kept for compatibility; in the dark-first
    // build it must resolve to a dark surface, not a cream white.
    const cream = token(root, "cream");
    expect(lightness(cream)).toBeLessThan(0.4);
  });

  it("exposes the eight-colour scheme tokens the lattice tints from", () => {
    const root = rootBlock();

    for (const name of [
      "scheme-lime",
      "scheme-light-green",
      "scheme-baby-blue",
      "scheme-baby-pink",
      "scheme-silk-black",
      "scheme-night-sky",
      "scheme-shine-navy",
      "scheme-deep-blue-green",
    ]) {
      expect(token(root, name)).toMatch(/^[\d.]+ [\d.]+ [\d.]+$/u);
    }
  });

  it("sets the document colour-scheme to dark by default", () => {
    // The base `html` rule opts into dark native controls; the light variant
    // overrides it. A cream-white default would set this to light.
    expect(css).toMatch(/html\s*\{\s*color-scheme:\s*dark;/u);
  });
});
