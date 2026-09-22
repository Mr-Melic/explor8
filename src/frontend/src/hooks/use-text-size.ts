import { useCallback, useEffect, useState } from "react";

/**
 * The site-wide text-size control.
 *
 * The register's whole type scale is expressed in `rem`, so scaling the root
 * font size scales every heading, label, table cell and paragraph at once —
 * not just the header. The chosen step is remembered across reloads and
 * sessions in `localStorage`, and restored before the first paint so the page
 * never flashes at the default size.
 *
 * The scale is deliberately bounded: the smallest step stays legible and the
 * largest never overflows a phone-width column.
 */

const STORAGE_KEY = "explor8-text-size";

/** The root font size, in percent, for each step. 100 is the design default. */
export const TEXT_SIZE_STEPS = [87.5, 100, 112.5, 125, 137.5] as const;

/** The index of the default (100%) step. */
export const DEFAULT_TEXT_SIZE_INDEX = 1;

export type TextSizeStep = (typeof TEXT_SIZE_STEPS)[number];

function clampIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_TEXT_SIZE_INDEX;
  return Math.min(Math.max(Math.round(index), 0), TEXT_SIZE_STEPS.length - 1);
}

function readStoredIndex(): number {
  if (typeof window === "undefined") return DEFAULT_TEXT_SIZE_INDEX;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_TEXT_SIZE_INDEX;
    return clampIndex(Number.parseInt(raw, 10));
  } catch {
    return DEFAULT_TEXT_SIZE_INDEX;
  }
}

/** Apply a step to the document root as a percentage font size. */
export function applyTextSize(index: number): void {
  if (typeof document === "undefined") return;
  const step = TEXT_SIZE_STEPS[clampIndex(index)];
  document.documentElement.style.fontSize = `${step}%`;
}

/**
 * Owns the text-size step for the whole app.
 *
 * The step is applied to `document.documentElement` and persisted on every
 * change, so a reload restores the reader's choice. `increase`, `decrease` and
 * `reset` are the three actions the header exposes; each is a no-op at its
 * bound rather than wrapping, so the control never surprises the reader.
 */
export function useTextSize() {
  const [index, setIndex] = useState<number>(readStoredIndex);

  // Apply on mount and whenever the step changes. This runs before the first
  // paint for the initial value, so there is no layout shift on load.
  useEffect(() => {
    applyTextSize(index);
  }, [index]);

  const persist = useCallback((next: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // A blocked storage write must not break the control itself.
    }
  }, []);

  const setStep = useCallback(
    (next: number) => {
      const clamped = clampIndex(next);
      setIndex(clamped);
      persist(clamped);
    },
    [persist],
  );

  const increase = useCallback(() => {
    setIndex((current) => {
      const next = clampIndex(current + 1);
      persist(next);
      return next;
    });
  }, [persist]);

  const decrease = useCallback(() => {
    setIndex((current) => {
      const next = clampIndex(current - 1);
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setIndex(DEFAULT_TEXT_SIZE_INDEX);
    persist(DEFAULT_TEXT_SIZE_INDEX);
  }, [persist]);

  return {
    index,
    step: TEXT_SIZE_STEPS[index],
    isDefault: index === DEFAULT_TEXT_SIZE_INDEX,
    canIncrease: index < TEXT_SIZE_STEPS.length - 1,
    canDecrease: index > 0,
    increase,
    decrease,
    reset,
    setStep,
  };
}
