import { DiamondBackground } from "@/components/background/DiamondBackground";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The animated diamond-tile background.
 *
 * The acceptance criteria require a full-page lattice behind all content whose
 * tiles light up at random over time, and that stills under
 * `prefers-reduced-motion`. jsdom paints nothing, so these tests assert the
 * observable contract the component owns: the layer's placement and
 * non-interference, that exactly one tile is lit at a time and the lit tile
 * changes over time, and that the ignition loop never starts when the user
 * asks for reduced motion.
 *
 * The CSS animation itself (the `tile-ignite` keyframes) is not exercised here;
 * only the class the component applies to the active tile is asserted.
 */

/** Install a `matchMedia` that reports the given reduced-motion preference. */
function stubReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * Drive `crypto.getRandomValues` from a fixed, non-repeating sequence.
 *
 * jsdom's Web Crypto fills the buffer with zeros, which would make the
 * component's "never light the same tile twice in a row" guard alternate
 * between two tiles. A controlled sequence makes the randomness observable and
 * the assertions deterministic. `vi.stubGlobal` replaces the binding on both
 * `globalThis` and the jsdom `window`, which is what the component reads.
 */
function stubRandomSequence(values: number[]) {
  let cursor = 0;
  const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array && "length" in array) {
      const view = array as unknown as {
        length: number;
        [index: number]: number;
      };
      for (let i = 0; i < view.length; i += 1) {
        view[i] = values[cursor % values.length];
        cursor += 1;
      }
    }
    return array;
  };
  vi.stubGlobal("crypto", { getRandomValues });
}

/** The tiles the component renders, in document order. */
function tiles(): HTMLElement[] {
  const layer = screen.getByTestId("background.diamond_lattice");
  return Array.from(layer.querySelectorAll("span"));
}

/** The single tile currently carrying the ignition animation class. */
function litTiles(): HTMLElement[] {
  return tiles().filter((tile) =>
    tile.className.includes("animate-tile-ignite"),
  );
}

describe("Diamond background", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a full-page, non-interactive layer behind the content", () => {
    render(<DiamondBackground />);

    const layer = screen.getByTestId("background.diamond_lattice");
    // Decorative: hidden from assistive technology and never intercepting a tap.
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer.className).toContain("pointer-events-none");
    expect(layer.className).toContain("fixed");
    expect(layer.className).toContain("inset-0");
    // It sits behind every surface rather than over it.
    expect(layer.className).toContain("-z-10");

    // The lattice is populated, not an empty field.
    expect(tiles().length).toBeGreaterThan(0);
  });

  it("lights exactly one tile at a time and moves the light over time", () => {
    // Distinct, non-adjacent indices, longer than the number of picks made.
    stubRandomSequence([3, 40, 7, 90, 12, 150, 21, 180, 33, 200]);
    render(<DiamondBackground />);

    const first = litTiles();
    expect(first).toHaveLength(1);

    // Advance past several ignition intervals; the lit tile must change.
    // The interval's state update must be flushed inside `act`.
    act(() => {
      vi.advanceTimersByTime(420 * 5);
    });

    const later = litTiles();
    expect(later).toHaveLength(1);
    // The lit tile is a different node than the one lit at mount.
    expect(later[0]).not.toBe(first[0]);
  });

  it("never lights the same tile twice in a row", () => {
    // A sequence whose consecutive values never collide, longer than the run.
    stubRandomSequence([5, 60, 11, 120, 17, 180, 23, 200, 29, 210, 35, 220]);
    render(<DiamondBackground />);

    let previous = litTiles()[0];
    for (let step = 0; step < 8; step += 1) {
      act(() => {
        vi.advanceTimersByTime(420);
      });
      const current = litTiles();
      expect(current).toHaveLength(1);
      expect(current[0]).not.toBe(previous);
      previous = current[0];
    }
  });

  it("stills the lattice under prefers-reduced-motion", () => {
    stubReducedMotion(true);
    render(<DiamondBackground />);

    // The field still renders, but no tile is ever lit.
    expect(tiles().length).toBeGreaterThan(0);
    expect(litTiles()).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(420 * 10);
    });
    expect(litTiles()).toHaveLength(0);
  });
});
