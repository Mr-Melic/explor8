import { cn } from "@/lib/utils";

interface ChainMarkProps {
  className?: string;
}

/**
 * The Explor8 header mark: two interlocking links drawn as thin gold strokes,
 * with a slow draw-on loop. Under `prefers-reduced-motion` the CSS utilities
 * stop the animation and the mark renders as a static gold infinity.
 */
export function ChainMark({ className }: ChainMarkProps) {
  return (
    <svg
      viewBox="0 0 48 28"
      className={cn("h-7 w-12 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g className="chain-pulse">
        <path className="chain-link chain-draw" d="M17 6h-4a8 8 0 0 0 0 16h4" />
        <path className="chain-link chain-draw" d="M31 6h4a8 8 0 0 1 0 16h-4" />
        <path className="chain-link" d="M17 14h14" />
        <circle className="chain-link" cx="24" cy="14" r="1.6" />
      </g>
    </svg>
  );
}
