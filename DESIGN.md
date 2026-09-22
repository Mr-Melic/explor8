# Design Brief

## Direction

Explor8 / JOA Gold Book — an archival assay ledger rendered as a launch console: a deep night-sky ground, high-contrast white type, thin accent rules, and a full-page lattice of diamond tiles that ignite at random behind the register.

## Tone

Modern American product confidence with an aerospace edge — SpaceX mission control, not a fintech dashboard. Restraint is the flex: near-black surfaces, one living accent, and a single soft ambient glow carry the hierarchy instead of colour or shadow.

## Differentiation

The **diamond lattice** — a full-page field of diamond-shaped tiles that light up one at a time at true random, each tinted from the eight-colour scheme, over a soft ambient glow — now paired with a **rotating block colour schedule** so the register itself reads as a colour-coded ledger, never two neighbours alike.

## Color Palette

Dark-first. Every value derives from the eight-colour scheme (lime `#6dba4f`, light green `#cddf80`, baby blue `#bbe2f1`, baby pink `#fce9de`, silk black `#374248`, night sky `#637687`, shine navy `#004b8b`, deep blue-green `#00748f`). No cream white is used as a surface.

| Token      | OKLCH           | Role                                   |
| ---------- | --------------- | -------------------------------------- |
| background | 0.208 0.014 232 | Silk-black night ground                |
| foreground | 0.955 0.008 220 | Near-white ink — primary text          |
| card       | 0.262 0.018 232 | Raised night-sky block face            |
| primary    | 0.585 0.132 252 | Shine navy — authority, assayed, links |
| accent     | 0.715 0.162 138 | Peter Pan lime — rules, live state     |
| muted      | 0.300 0.020 233 | Night sky — secondary surfaces         |
| border     | 0.352 0.024 233 | Hairline rules and block outlines      |
| chart-1..5 | lime → navy     | Register graphs, no neon               |

The eight scheme colours are also exposed as `--scheme-*` tokens so the diamond lattice can tint each tile from the palette itself.

## Typography

- **Single typeface: Work Sans** — headings, body text, labels, the wordmark, and the header subtitle all render in Work Sans. One face, upright, weights 300–700.
- **No italics anywhere.** No italic or oblique face is declared, and a defensive base rule (`* { font-style: normal !important; font-synthesis-style: none; }`) makes it impossible for any element, utility class, or future `<em>`/`<i>` to render italic. The wordmark and every heading are upright.
- Body: Work Sans — UI labels, tables, body copy
- Mono: Geist Mono — content hashes, block heights, timestamps, coordinates
- Scale: hero `text-4xl md:text-6xl font-display font-normal tracking-tight`, h2 `text-2xl md:text-3xl font-display`, label `text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground`, body `text-sm md:text-base`, hash `text-xs font-mono tabular-nums`
- The wordmark is set large and modern and upright: `text-2xl md:text-3xl font-display font-semibold tracking-tight`
- `--font-display`, `--font-body` and `--font-mono` all resolve through Work Sans; the stacks fall through to the bundled upright grotesque (Space Grotesk / General Sans) if `WorkSans.woff2` is absent.
- **Font file note:** Work Sans is not in the bundled font set and could not be fetched in this environment, so `WorkSans.woff2` is declared but not yet present; the stack currently resolves to Space Grotesk. Drop `WorkSans.woff2` into `src/frontend/public/assets/fonts/` and the whole app switches to Work Sans with no code change.

## Block Colour Schedule

Eight block-surface tints, applied in schedule order. Each tint is the matching scheme colour mixed into the block face at a low, dark-first intensity so text contrast stays AA+ in both themes.

| Index | Colour         | Hex       | Variant class    |
| ----- | -------------- | --------- | ---------------- |
| 1     | lime           | `#6dba4f` | `.block-face-1`  |
| 2     | light green    | `#cddf80` | `.block-face-2`  |
| 3     | baby blue      | `#bbe2f1` | `.block-face-3`  |
| 4     | baby pink      | `#fce9de` | `.block-face-4`  |
| 5     | silk black     | `#374248` | `.block-face-5`  |
| 6     | night sky      | `#637687` | `.block-face-6`  |
| 7     | shine navy     | `#004b8b` | `.block-face-7`  |
| 8     | deep blue-green| `#00748f` | `.block-face-8`  |

**How a consumer picks a variant by index.** Apply `.block-face` plus exactly one variant class. The variant only overrides `background-color` and `border-color`, so `.block-face` (radius, hairline) and `.block-face-open` (lime left edge) keep working unchanged.

- Explicit index: `<article class="block-face block-face-4 block-face-open">` — index 4 = baby pink.
- Data attribute: `<article class="block-face" data-block-face="4">` — same eight tints, same order.
- Derived from position: `const face = (i % 8) + 1` then `block-face-${face}`.
- CSS-only: `.block-face:nth-child(8n+1) … :nth-child(8n+8)` maps to variants 1–8.

**No two neighbours alike.** In a 3-column grid, advance the index by 1 per block and the modulus-8 cycle guarantees a block never matches its horizontal neighbour; because 3 is coprime with 8, it also never matches the block directly above or below. Documented rule: horizontal step +1, vertical step +3 (mod 8).

## Elevation & Depth

Near-flat: depth comes from layered night tones (`background` → `muted` → tinted block face), 1px hairlines, and a single soft `shadow-block` on expanded blocks — never glow on content, never neon.

## Structural Zones

| Zone    | Background                     | Border                   | Notes                                                                 |
| ------- | ------------------------------ | ------------------------ | --------------------------------------------------------------------- |
| Header  | `bg-card` night sky            | `border-b border-border` | Wordmark, single-line subtitle, licence reminder, mode switch, theme toggle |
| Content | `bg-background`                | —                        | Diamond lattice sits behind, fixed and non-interactive; blocks rotate through the 8-colour schedule |
| Footer  | `bg-muted/40`                  | `border-t border-border` | Append-only disclaimer verbatim, mono register stats                  |

## Spacing & Rhythm

Generous ledger rhythm: sections `py-12 md:py-20`, content max `max-w-6xl`, block gaps `space-y-3`, table rows `py-2.5`, micro-spacing in 4px steps; hash rows use tight `gap-1.5` to read as a column.

## Component Patterns

- Buttons: 2px radius, navy fill for primary, hairline ghost for secondary, hover = `bg-primary/90` + `transition-quick`, focus ring lime
- Cards (blocks): 2px radius, tinted night-sky face via one `.block-face-N` variant, hairline border, `shadow-block`; expanded adds 3px lime left edge + `shadow-block-open` + `animate-block-seal`
- Header subtitle: `.header-subtitle` is a single `flex-nowrap` line with `white-space: nowrap`; font scales with `clamp(0.5rem, 2.6vw, 0.8125rem)` so it shrinks on mobile instead of wrapping. 'A product of' stays muted; `.subtitle-brand` renders 'JEWEL OF AFRICA' in `--accent`.
- Badges: uppercase 11px, 2px radius, 0.08em tracking — `pill-open` night sky, `pill-in-transit` lime outline, `pill-assayed` navy fill, `pill-retailed` lime fill, `pill-frozen` muted

## Motion

- Entrance: `animate-block-seal` 280ms cubic-bezier(0.16,1,0.3,1) on expanded block content only
- Hover: `transition-quick` 160ms on borders, background, and accent edge — no lift, no scale
- Decorative: header chain mark draws its stroke via `chain-draw` 2.6s loop + `chain-pulse`; the diamond lattice ignites one tile at a time via `tile-ignite` 1.05s, over an `ambient-drift` 26s glow
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables all animations and transitions; the diamond lattice renders as a static dim field and the chain mark as a static accent infinity

## Constraints

- Never a trading dashboard: no neon, no gradients as background washes, no coin/token/wallet iconography, no stock node illustrations
- **No italic text, ever** — the wordmark, headings, labels and body all render upright; the base stylesheet forces `font-style: normal`
- **Work Sans everywhere** — one typeface across display, body and labels; mono is reserved for hashes, block heights, timestamps, and coordinates
- **Adjacent blocks never share a colour** — the 8-colour schedule cycles with horizontal step +1 and vertical step +3 (mod 8)
- Append-only: no edit, delete, undo, or save-over affordance anywhere — history reads downward forever
- Dark theme is the default; the light variant is a cool daylight inversion, never a cream surface
- All colour via semantic OKLCH tokens; no hex, `rgb()`, or arbitrary Tailwind colour classes in components
- The header subtitle `A product of Jewel of Africa` renders on a single horizontal line at every viewport width — the font shrinks on mobile, it never wraps, truncates, clips, or ellipsises

## Signature Detail

The **igniting lattice** — a diamond tile lights at random, blooms from the palette, and fades, while the register blocks below rotate through the same eight colours, so the whole page looks like it is measuring something live.
