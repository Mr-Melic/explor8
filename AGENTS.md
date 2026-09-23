# Project Guidance

## User Preferences

- Header title is 'Explor8' with the subtitle 'A product of Jewel of Africa'; never show 'Gold Book' in the header
- The header subtitle 'A product of Jewel of Africa' must always render on a single line at every width, shrinking the font on mobile rather than wrapping; 'JEWEL OF AFRICA' is highlighted in the accent colour
- The header identity region (wordmark + subtitle) and the control cluster must each own their own full-width row so no control can ever cover the title or subtitle
- Work Sans is the typeface for headings, body text, labels and the wordmark; never use italic styling anywhere
- Footer attribution reads '© 2026. Built with love by Le Royalties Sergio Melicio for Jewel of Africa' with the end year auto-advancing with the current year
- Adjacent register blocks never share the same colour; block colours cycle through the 8-colour schedule
- Status display terms: Open is 'Recently Mined', Assayed is 'Testing Quality', Closed is 'Applied for crafting', Frozen is 'Confiscated by Authorities'
- The register section heading is 'Asset Registry Explorer'
- Site labels read 'Mining Site' / 'Mining Sites'
- Real-time mode must be clean with no sample or placeholder lots
- Demo data is randomly generated in the browser and never persisted to storage
- The admin panel is reached from a footer Admin button shown only to signed-in admins
- Lot kinds offered by the register are Emerald and Gold only for now
- All reference data (lot kinds, site names, statuses, event kinds, labels, defaults, status explanations, enquiry destination email) is addable, editable and removable from the admin panel
- Sealed lot records stay immutable and the register stays append-only
- Dark-first theme built from the 8-colour palette: lime #6dba4f, light green #cddf80, baby blue #bbe2f1, baby pink #fce9de, silk black #374248, night sky #637687, shine navy #004b8b, deep blue-green #00748f
- Never use cream white as a surface colour
- Every screen must work at phone and tablet widths with no horizontal overflow or clipped controls
- The animated diamond-tile background sits behind all content and stills under prefers-reduced-motion
- Role display terms: 'Assayer' reads 'Quality Tester' and 'Workshop' reads 'Custom Role'
- Admin holds all permissions by default; Custom Role starts with no permissions and is adjusted by the admin after assignment
- Permissions are edited through a simple checkbox UI
- Block deletion is one block at a time and requires typing a confirmation phrase
- The header is sticky and carries an 'A-a' stepped text-size control (plus, minus, zero reset) that scales all text site-wide and remembers the choice
- The header licence reminder line reads 'Licensed miner & dealer'
- The term 'provenance' is replaced by 'Precious Material Origin History' everywhere in the UI
- Lot field labels are 'Registered at', 'Mining Site', 'Mining Licence', 'Registered by' and 'Lot number'
- Event names shown in each lot block align with the current status names
- The home page has a per-status information section, hidden by default, folded open one status at a time via 'CLICK HERE TO UNDERSTAND THIS STATUS'
- A 'Contact us to make a purchase' fold-out form sits under the intro text; sign-in is required to submit, with a consent checkbox to share information until withdrawn
- Submitters can view their own enquiries and withdraw permission per submission; withdrawn enquiries are removed from the admin dashboard
- The admin panel has an enquiry inbox with an optional destination email; when no address is set no email is sent and the admin responses section notes this

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- caffeineai-oql 0.6.2: Entity.new's 5th parameter is an implicit _toRow, not a positional argument; use Entity.manual<T>(...) + .payload(name, extract) for any T that is not a flat record of _toRow-derivable primitives (variants, Principal, computed columns), and import the concrete value modules (TextValue/NatValue/IntValue/BoolValue) in the same file.
- The caffeineai-oql Table has no clear(); reset it by rebuilding with Table.new over the same column and index declarations, which requires the state field holding it to be var.
- A Motoko variant type gets no derived equal, so use .any(func c = c == cap) for variant membership.
- A pending Enhanced Migration entry's OldActor must reproduce the preceding frozen migration's NewActor exactly, including its variant tag sets; when current types added a new variant tag, the old side needs its own Old* type plus a total widening function.
- A helper that needs the roles state to compute a view must take it as a parameter; constructing a throwaway state inside the helper yields wrong admin counts.
- Adding a variant tag to a Capability type used inside stable state (roleDefaults and per-principal overrides) is NOT stable-compatible: mops check --fix reports M0170 because the old stored value lacks the new case. A new Enhanced Migration entry is required, with an Old* variant type reproducing the preceding migration's NewActor exactly plus a total widening function.
- The caffeineai-oql Table has no per-row delete; deleting one lot requires rebuilding lotIndex with Table.new over the same column and index declarations and re-appending the remaining rows, which requires the state field holding it to be var.
- RegisterLib.deleteLot takes the permissions state as a parameter so the capability gate stays in the domain layer; the mixin passes permissionsState through, so RegisterApi now takes three state parameters.
- Making a newly added boolean prop optional with a `= false` default keeps existing call sites and tester-owned test files compiling without editing them.
- pnpm fix (biome check --write) reformats tester-owned test files on every run; revert them with git checkout after the sequence since the tester owns those files.
- The delete control is gated on useMyRole().effectiveCapabilities (getMyCapabilities), not the role, matching the backend authority; demo mode withholds it like other writes.
- After a successful delete, clear the expanded id directly (filters.lot = null) rather than routing the delete callback through the expand callback, which would point the deep link at the removed block and depend on a later effect to clear it.
- A newly added callback prop can be made optional with a fallback default (onDeleted = onOpenLot) so tester-owned test files that omit it keep compiling without editing them.
- The admin panel's reference-kind labels live in use-admin-data.ts REFERENCE_KINDS, not lib/reference.ts REF_KIND_LABEL; the two differ ('Lot kinds' vs 'Item kinds') but only the former renders.
- Demo registration and event appending are held in DataModeProvider memory only; nothing touches localStorage beyond the mode flag, satisfying the never-persisted rule.
- The 'provenance' term survives only in generated bindings (backend.ts/backend.d.ts/declarations) and test files, which are not user-facing UI.
- A custom utility that declares `position` competes with Tailwind's own position utilities in the same layer; the emitted order decides the winner, so a sticky element can be silently unpinned. Keep the custom utility to `z-index` only and let the consumer's `sticky`/`relative` utility own the position.
- A flex child defaults to min-width:auto and refuses to shrink below its content's intrinsic width; a container-relative clamp() on a nowrap line only takes effect once min-width:0 is set on the container AND every intermediate wrapper down to the line.
- A long informational paragraph placed inside a header's horizontal control cluster competes with the identity region for width and clips the wordmark; give it md:basis-full on a wrapping flex row to move it to its own line.
- Sizing a nowrap header subtitle with container-query units (cqw) against a container whose width is not content-derived can over-shrink the line into an illegible smear at desktop widths; verify the rendered result in a browser, not just the structural markup contract.
- The local-deploy autonomous tester is the only check that catches real rendered-geometry defects; jsdom component tests assert structural markup contracts and cannot detect overlap, clipping, or over-shrink.
- Two sibling flex items both carrying basis-full each claim their own wrapped row, so neither can ever share a row and overlap the other — a structural guarantee stronger than min-w-0 alone.
- Container-query units (cqw) resolve against the container's own inline size; when that container is a full-width flex item its size is not content-derived, so a cqw clamp can over-shrink a nowrap line at desktop widths. Viewport-relative vw sizing is stable for a full-width row.
- A clamp() mixing rem and vw floors at the rem term once the root font-size is scaled up, so a minimum size expressed in rem grows with the text-size step while the vw term stays fixed.
- pnpm fix (biome check --write) fails the whole command sequence on a lint error in a tester-owned test file even when typecheck and build pass; report the file rather than editing it.
