import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The eight-colour scheme, referenced through the CSS custom properties
 * declared in index.css (`--scheme-*`). Each token holds a bare OKLCH triple,
 * so the lattice tints stay in sync with the live palette instead of
 * duplicating the triples here. Entries store the bare custom-property name
 * and are consumed as `oklch(var(--scheme-*))`.
 */
const SCHEME_TINTS = [
  "--scheme-lime",
  "--scheme-light-green",
  "--scheme-baby-blue",
  "--scheme-baby-pink",
  "--scheme-night-sky",
  "--scheme-shine-navy",
  "--scheme-deep-blue-green",
] as const;

/** Tile pitch in CSS pixels. Smaller pitch = denser lattice. */
const TILE_PITCH = 64;

/** How long a single tile stays lit before the next one ignites. */
const IGNITE_INTERVAL_MS = 420;

interface Tile {
  id: string;
  /** Percentage position within the lattice field. */
  left: number;
  top: number;
  /** Index into SCHEME_TINTS. */
  tint: number;
}

/**
 * A full-page lattice of diamond tiles that ignite one at a time at true
 * random, tinted from the eight-colour scheme, over a soft ambient glow.
 *
 * The layer is `fixed`, `aria-hidden`, and `pointer-events-none`, so it sits
 * behind every surface without ever intercepting a tap or a click. Under
 * `prefers-reduced-motion` the ignition loop never starts and the lattice
 * renders as a static, dim field.
 */
export function DiamondBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastIndexRef = useRef<number | null>(null);

  // Track the reduced-motion preference live, so toggling it in the OS stops
  // or resumes the lattice without a reload.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Build the lattice once. The tile count is derived from the viewport so the
  // field always covers the screen without an unbounded number of nodes.
  const tiles = useMemo<Tile[]>(() => {
    const columns = Math.max(6, Math.ceil(window.innerWidth / TILE_PITCH) + 1);
    const rows = Math.max(6, Math.ceil(window.innerHeight / TILE_PITCH) + 1);
    const built: Tile[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        built.push({
          id: `diamond-${row}-${column}`,
          left: (column / columns) * 100,
          top: (row / rows) * 100,
          tint: (row * 7 + column * 3) % SCHEME_TINTS.length,
        });
      }
    }
    return built;
  }, []);

  // Ignite one tile at a time. `crypto.getRandomValues` gives true randomness
  // rather than the deterministic sequence `Math.random` can be seeded into.
  useEffect(() => {
    if (reducedMotion || tiles.length === 0) {
      setActiveIndex(null);
      return;
    }

    const pickRandomIndex = () => {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      let next = buffer[0] % tiles.length;
      // Never ignite the same tile twice in a row — the eye reads that as a
      // stall rather than a random field.
      if (next === lastIndexRef.current) {
        next = (next + 1) % tiles.length;
      }
      lastIndexRef.current = next;
      return next;
    };

    setActiveIndex(pickRandomIndex());
    const timer = window.setInterval(() => {
      setActiveIndex(pickRandomIndex());
    }, IGNITE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [reducedMotion, tiles.length]);

  return (
    <div
      aria-hidden="true"
      data-ocid="background.diamond_lattice"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* Soft ambient glow layer, matching the reference's diffuse bloom. */}
      <div className="absolute inset-0">
        <div
          className="absolute left-1/2 top-[-10%] h-[70vh] w-[70vw] -translate-x-1/2 rounded-full opacity-60 blur-[120px] animate-ambient-drift"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.518 0.095 222 / 0.28), transparent 72%)",
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-10%] h-[60vh] w-[60vw] rounded-full opacity-50 blur-[130px] animate-ambient-drift"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.715 0.162 138 / 0.16), transparent 70%)",
          }}
        />
      </div>

      {/* The diamond lattice. */}
      <div className="absolute inset-0">
        {tiles.map((tile, index) => {
          const isActive = index === activeIndex;
          const tint = SCHEME_TINTS[tile.tint];
          return (
            <span
              key={tile.id}
              className={
                isActive
                  ? "absolute block size-4 rotate-45 animate-tile-ignite"
                  : "absolute block size-4 rotate-45 opacity-0"
              }
              style={{
                left: `${tile.left}%`,
                top: `${tile.top}%`,
                backgroundColor: `oklch(var(${tint}))`,
                boxShadow: isActive
                  ? `0 0 22px 3px color-mix(in oklch, oklch(var(${tint})) 60%, transparent)`
                  : undefined,
              }}
            />
          );
        })}
      </div>

      {/* A faint static diamond grid keeps the field legible when still. */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, oklch(var(--foreground)) 1px, transparent 1px), linear-gradient(-45deg, oklch(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: `${TILE_PITCH}px ${TILE_PITCH}px`,
        }}
      />
    </div>
  );
}
