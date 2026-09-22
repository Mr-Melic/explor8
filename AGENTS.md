# Project Guidance

## User Preferences

- Header title is 'Explor8' with the subtitle 'A product of Jewel of Africa'; never show 'Gold Book' in the header
- The header subtitle 'A product of Jewel of Africa' must always render on a single line at every width, shrinking the font on mobile rather than wrapping; 'JEWEL OF AFRICA' is highlighted in the accent colour
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

- chmod u+w is required before editing a read-only migration file under src/backend/migrations/; the edit tool then applies the change normally.
- mops.toml lives at the project root (not src/backend); [canisters.backend.migrations] chain = 'src/backend/migrations' with check-limit = 1 permits exactly one pending migration per deploy.
- The localQa contract requires every accepted requirement feature index to appear in a flow's requirementIndexes or in sourceOnlyRequirementIndexes; a contract-validation error deploys nothing and spends no QA pass, so correct only the contract and call pre_commit_checks again.
- A tester cover that adds or edits test files changes the app tree and invalidates a recorded pre_commit_checks pass; run the tester cover BEFORE the final source QA review and preflight, not after.
- The frontend TRANSITIONS_BY_ROLE map must mirror backend lib/register.mo canTransition exactly; the backend remains the final authority and rejects unpermitted transitions with #notAuthorized.
- Gating a role-gated control on a capability alone is wrong when the backend grants that capability only to admin but authorizes other roles via a separate transition matrix; gate on signed-in AND (capability OR role has an allowed transition from the current status).
- The regenerated bindings added statusHistory: StatusChange[] to LotView and status_change to EventKind; any Record<EventKind, T> map and every LotView literal must be updated, including demo-data.ts and test fixtures.
- getMyCapabilities is the authority for effective permissions (role defaults plus per-principal override), so permission gates should read it rather than re-deriving from the role alone.
- roleDisplayName/listRoles are the backend authority for role labels; local ROLE_LABELS are only a pre-resolve fallback.
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
