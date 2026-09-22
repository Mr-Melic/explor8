import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The single-typeface, no-italic contract.
 *
 * The accepted requirement is that Work Sans is the typeface for headings,
 * body, labels and the wordmark, and that nothing renders italic. jsdom
 * computes no styles, so this suite reads the stylesheet the app actually
 * ships and asserts the contract directly: Work Sans leads every text font
 * stack, no italic face is declared, and the base layer forces upright text.
 *
 * This is a static assertion over `index.css`, not a rendered-pixel check.
 */

// Vitest runs with the frontend package as its working directory.
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/** The `:root { … }` block, which holds the font-stack variables. */
function rootBlock(): string {
  const start = css.indexOf(":root {");
  expect(start).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n  }", start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

/** Read a custom-property value from a CSS block. */
function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  expect(match, `--${name} must be declared`).not.toBeNull();
  return (match?.[1] ?? "").trim();
}

describe("Single typeface and no italic", () => {
  it("leads every text font stack with Work Sans", () => {
    const root = rootBlock();

    for (const name of ["font-display", "font-body"]) {
      const stack = token(root, name);
      // Work Sans must be the first family, so it wins when the face is
      // present and the fallbacks only cover a missing font file.
      expect(stack, `--${name} must lead with Work Sans`).toMatch(
        /^"Work Sans"/,
      );
    }
  });

  it("declares no italic or oblique font face", () => {
    // Every @font-face block must be upright; an italic face would let text
    // render slanted even with the base rule in place.
    const faces = css.match(/@font-face\s*\{[^}]*\}/gu) ?? [];
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(face).toMatch(/font-style:\s*normal;/u);
      expect(face).not.toMatch(/font-style:\s*(italic|oblique)/u);
    }
  });

  it("forces upright text on every element in the base layer", () => {
    // The defensive base rule keeps any future <em>, <i> or utility class
    // upright, and stops the browser synthesising a slanted face.
    expect(css).toMatch(/font-style:\s*normal\s*!important;/u);
    expect(css).toMatch(/font-synthesis-style:\s*none;/u);
  });

  it("keeps the header subtitle on one line with a shrinking font", () => {
    // The subtitle never wraps; the font shrinks instead, and the brand half
    // is lit in the accent colour.
    const subtitle = css.match(/\.header-subtitle\s*\{[^}]*\}/u)?.[0] ?? "";
    expect(subtitle).not.toBe("");
    expect(subtitle).toMatch(/white-space:\s*nowrap;/u);
    expect(subtitle).toMatch(/flex-wrap:\s*nowrap;/u);
    expect(subtitle).toMatch(/font-size:\s*clamp\(/u);

    const brand =
      css.match(/\.header-subtitle\s+\.subtitle-brand\s*\{[^}]*\}/u)?.[0] ?? "";
    expect(brand).not.toBe("");
    expect(brand).toMatch(/color:\s*oklch\(var\(--accent\)\)/u);
  });
});
