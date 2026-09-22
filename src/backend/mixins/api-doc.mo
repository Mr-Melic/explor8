/// Static API documentation for the Explor8 provenance register.
/// Returns Markdown authored from the current backend source; it reads no
/// runtime state, so it is a pure query.
mixin () {
  /// The backend's public API documentation as Markdown.
  public query func getApiDoc() : async Text {
    "# Explor8 — Provenance Register API\n" #
    "\n" #
    "Explor8 is the append-only provenance register for Jewel of Africa\n" #
    "Limited (Lusaka). It records physical gold and emerald lots and the\n" #
    "events that happen to them. It is a transparency register only: there is no\n" #
    "trading, no tokens, no wallets, no marketplace and no payments.\n" #
    "\n" #
    "## Append-only model\n" #
    "\n" #
    "History is append-only. There is no edit, undo or export method anywhere in\n" #
    "this API. A mistake is corrected by appending a `correction` event, never by\n" #
    "changing or removing an earlier event. Every lot carries a `hashChain` of\n" #
    "`{ at, eventSeq, contentHash }` links, and each event carries a `payloadHash`;\n" #
    "both are SHA-256 digests of canonical JSON.\n" #
    "\n" #
    "The one exception is `deleteLot(lotId)`, an explicit admin-only destructive\n" #
    "action that removes a single block. It is intended for removing dummy or\n" #
    "mistaken data, not for editing history: it deletes the whole block, so it\n" #
    "cannot be used to alter a sealed record in place. See \"Deleting a single\n" #
    "block\" below.\n" #
    "\n" #
    "## Authentication and identity\n" #
    "\n" #
    "Authentication is Internet Identity only. There is no email/password or\n" #
    "Google login. The app's frontend pins an Internet Identity derivation\n" #
    "origin, published at `/.well-known/ii-derivation-origin` when available. An\n" #
    "agent already holding the user's Internet Identity authorization derives the\n" #
    "correct per-app principal against that origin (for example\n" #
    "`icp identity link web <name> --app <host>`). Such a delegation acts with\n" #
    "the user's full authority in this app until it expires.\n" #
    "\n" #
    "Reads are public: `listLots`, `getLot`, `searchLots`, `registerSummary`,\n" #
    "`suggestLotId`, `statusHistory`, `listReferenceEntries`,\n" #
    "`canonicalSnapshotJson`, `canonicalEventJson`, `sha256Hex`,\n" #
    "`sha256HexOfBlob`, `roleDisplayName`, `listRoles`, `getMyCapabilities`,\n" #
    "`schema`, `execute` and `getApiDoc` may be called by anyone, including an\n" #
    "anonymous caller. `hasAdmin` is also public and non-sensitive.\n" #
    "\n" #
    "Writes require a signed (non-anonymous) caller. The anonymous principal is\n" #
    "rejected on every write with the `#notAuthenticated` error variant.\n" #
    "\n" #
    "### Registration prerequisite\n" #
    "\n" #
    "A signed-in caller is not automatically known to the app. Registration\n" #
    "happens only when a caller signs in through the app's own frontend, so a\n" #
    "principal that never did so is unregistered even when it belongs to the\n" #
    "app's owner, and a signed-in caller derived against a different origin is a\n" #
    "different principal than the one the frontend registered.\n" #
    "\n" #
    "A direct API caller registers by calling `claimAdmin` once as a signed-in\n" #
    "caller. The first caller to claim receives the `#admin` role; every later\n" #
    "caller receives `#notAuthorized`. An admin then assigns roles to other\n" #
    "principals with `assignRole(target, role)`.\n" #
    "\n" #
    "`hasAdmin()` is a public query that reports whether an administrator already\n" #
    "exists. It returns `true` once the bootstrap has been claimed (or when any\n" #
    "principal holds `#admin`) and `false` otherwise. It is a non-sensitive\n" #
    "boolean precondition, not a data read: it never reveals which principal\n" #
    "holds the role, and it may be called by anyone, including an anonymous\n" #
    "caller. A frontend uses it to hide the `claimAdmin` action once an\n" #
    "administrator exists.\n" #
    "\n" #
    "An unregistered signed-in caller has the `#guest` role and read-only access:\n" #
    "every write returns `#notAuthorized`. `getMyRole` reports the caller's role.\n" #
    "`listActors` is admin-only and returns `#notAuthorized` to anyone else.\n" #
    "\n" #
    "### Roles and write authorization\n" #
    "\n" #
    "The register offers exactly two lot kinds: `emerald` and `gold`.\n" #
    "\n" #
    "| Role | May create lot types | May append event kinds |\n" #
    "| --- | --- | --- |\n" #
    "| `#field_officer` | `gold` | `extracted`, `photo`, `weighed`, `sealed`, `moved`, `note`, `correction` |\n" #
    "| `#assayer` (Quality Tester) | none | `assay` |\n" #
    "| `#workshop` (Custom Role) | `emerald` | `cut`, `retail`, `split`, `merge`, `photo`, `note`, `correction` |\n" #
    "| `#admin` | any type | any kind |\n" #
    "| `#guest` (signed-in, no role) | none | none |\n" #
    "\n" #
    "`registerLot` rejects a caller whose role may not create the requested lot\n" #
    "type with `#notAuthorized`. `appendEvent` rejects a caller whose role may not\n" #
    "append the requested event kind with `#notAuthorized`. `splitLot` requires\n" #
    "the `split` event permission (workshop or admin) and, for every child, the\n" #
    "permission to create that child's lot type. `mergeLots` requires both the\n" #
    "`merge` and `note` event permissions (workshop or admin), because it appends\n" #
    "a `merge` event on the destination and a `note` on the source. `freezeLot`\n" #
    "is admin-only.\n" #
    "\n" #
    "### Admin-managed reference data\n" #
    "\n" #
    "The register's forms and displays are driven by runtime reference data, not\n" #
    "by compile-time variants, so an administrator can add, edit and remove lot\n" #
    "kinds, site names, statuses, event kinds, display labels and form defaults\n" #
    "without a canister upgrade.\n" #
    "\n" #
    "- `listReferenceEntries(kind)` is a public read returning the active entries\n" #
    "  of one `RefKind` (`#lot_kind`, `#site`, `#status`, `#event_kind`,\n" #
    "  `#caption`, `#form_default`), ordered by `sortOrder`.\n" #
    "- `listAllReferenceEntries()` is admin-only and returns every entry,\n" #
    "  including inactive ones, ordered by kind then `sortOrder`.\n" #
    "- `addReferenceEntry(input)`, `updateReferenceEntry(input)` and\n" #
    "  `removeReferenceEntry(id)` are admin-only. Adding an entry whose `kind`\n" #
    "  and `key` already exist returns `#duplicateEntry(key)`; editing or\n" #
    "  removing an unknown id returns `#unknownEntry(id)`.\n" #
    "\n" #
    "### Analysis documents\n" #
    "\n" #
    "Uploaded assay reports and spreadsheets are held for review as analysis\n" #
    "documents. `listAnalysisDocuments()` is admin-only and returns them newest\n" #
    "first. `addAnalysisDocument(input)` and `removeAnalysisDocument(id)` are\n" #
    "admin-only; removing an unknown id returns `#unknownDocument(id)`. The\n" #
    "document's `fileId` and `contentHash` are supplied by the caller; the\n" #
    "backend stores them and stamps `uploadedAt` from the canister clock and\n" #
    "`uploadedBy` from the caller.\n" #
    "\n" #
    "### Register analytics\n" #
    "\n" #
    "`registerAnalytics()` is admin-only and returns the register's own live\n" #
    "aggregates: `totalLots`, `totalEvents`, `lotsOverTime` and `eventsOverTime`\n" #
    "as per-day points, and `byKind`, `byStatus` and `bySite` breakdowns. It is\n" #
    "computed from the current register state on every call.\n" #
    "\n" #
    "### Status changes as provenance events\n" #
    "\n" #
    "Every status change is recorded as a new provenance event of kind\n" #
    "`status_change` in that block's chain, carrying the actor, the timestamp and\n" #
    "the resulting status. `changeStatus(lotId, input)` records a transition and\n" #
    "returns the updated `LotView`; `statusHistory(lotId)` is a public read that\n" #
    "returns the block's status-change history in provenance order. A transition\n" #
    "a role is not permitted to make is rejected with `#notAuthorized`.\n" #
    "\n" #
    "The permitted transitions are: Quality Tester (`#assayer`) may move\n" #
    "Recently Mined (`open`) and In Transit (`in_transit`) to Testing Quality\n" #
    "(`assayed`); Custom Role (`#workshop`) may move Testing Quality (`assayed`)\n" #
    "to Applied for crafting (`closed`), Retailed (`retailed`) or Confiscated by\n" #
    "Authorities (`frozen`); an admin may perform any transition.\n" #
    "\n" #
    "### Role display names\n" #
    "\n" #
    "The role `#assayer` displays as \"Quality Tester\" and `#workshop` displays as\n" #
    "\"Custom Role\". `roleDisplayName(role)` returns the display name for a role\n" #
    "and `listRoles()` returns every role. The stored role tags are unchanged.\n" #
    "\n" #
    "### Permissions section\n" #
    "\n" #
    "The admin panel's Permissions section lists every app capability with who\n" #
    "can do it. `getPermissions()` is admin-only and returns the capability rows,\n" #
    "the role defaults and the per-principal overrides. `getMyCapabilities()`\n" #
    "returns the calling principal's effective capabilities. Admin holds all\n" #
    "permissions by default; Custom Role starts with none. An admin edits a\n" #
    "role's defaults with `updateRolePermissions(input)` and sets a\n" #
    "per-principal override with `setPrincipalOverride(input)`;\n" #
    "`removePrincipalOverride(target)` clears one. The capability list includes\n" #
    "`delete_lot` (\"Delete a block\"), held by admin by default.\n" #
    "\n" #
    "### Deleting a single block\n" #
    "\n" #
    "`deleteLot(lotId)` is admin-only and removes exactly one block: the lot, its\n" #
    "events, its hash chain and its stored file references. It returns\n" #
    "`#ok(lotId)` on success, `#unknownLot(lotId)` when no such block exists, and\n" #
    "`#notAuthorized` when the caller does not hold the `#delete_lot` capability\n" #
    "(admin holds it by default). Remaining blocks and their chains of custody are\n" #
    "untouched. It is not idempotent in the sense that a retry after a successful\n" #
    "delete returns `#unknownLot`; re-read with `getLot` before retrying. There is\n" #
    "no bulk deletion and no deletion audit trail.\n" #
    "\n" #
    "### Purging all register data\n" #
    "\n" #
    "`requestPurge(phrase)` is admin-only and opens a purge request. The phrase\n" #
    "must be typed verbatim as `DeLeTe ALL DATA`; any other text is rejected with\n" #
    "`#invalidPhrase`. The requesting admin counts as the first confirmation.\n" #
    "`confirmPurge()` is admin-only and confirms the open request. The purge\n" #
    "executes automatically once more than half of the currently-assigned admins\n" #
    "have confirmed the same request, and the request is then closed.\n" #
    "`getPurgeRequest()` is admin-only and returns the open request with its\n" #
    "confirmation progress, so a requesting admin can see how many of the\n" #
    "required admins have confirmed so far.\n" #
    "\n" #
    "A purge clears every block, its events, its hash chain and its\n" #
    "block-derived supporting files. It preserves roles and actors, and it\n" #
    "preserves all reference data (lot kinds, sites, statuses, event kinds,\n" #
    "labels, defaults). After a successful purge the register shows its clean\n" #
    "empty state.\n" #
    "\n" #
    "## Structured queries (OQL)\n" #
    "\n" #
    "The canister also exposes a read-only Object Query Layer over its persisted\n" #
    "register data, through two public query methods:\n" #
    "\n" #
    "- `schema()` returns one JSON `Text` describing every entity the caller may\n" #
    "  read: its primary key, its fields (with scalar `typeName` and `role`), and\n" #
    "  any declared edges.\n" #
    "- `execute(qJson)` runs a JSON-encoded query and returns typed Candid rows.\n" #
    "  A query is a single JSON object; only `start` (an entity name) is\n" #
    "  required, and `where`, `orderBy`, `limit`, `offset`, `select`,\n" #
    "  `groupBy` and `aggregate` are optional.\n" #
    "\n" #
    "Authorization is per entity, resolved against the caller:\n" #
    "\n" #
    "| Entity | Backing data | Read level |\n" #
    "| --- | --- | --- |\n" #
    "| `lot` | the register's lot index | public |\n" #
    "| `referenceEntry` | admin-managed reference entries | public |\n" #
    "| `analysisDocument` | uploaded analysis documents | controllers only |\n" #
    "| `roleAssignment` | role assignments | controllers only |\n" #
    "\n" #
    "`schema()` hides entities the caller cannot read, and `execute()` scopes\n" #
    "rows per entity, so a caller never sees rows a level denies them. The\n" #
    "`lot` entity is the register's queryable projection: its `lotType`,\n" #
    "`status`, `openedBy`, `grossG`, `sealNo`, `parentIds`, `contentHash`,\n" #
    "`frozen` and `eventCount` columns are the same values the register stores,\n" #
    "with `status` and `lotType` rendered as their stable tag text (`open`,\n" #
    "`assayed`, `gold`, `emerald`, …). `referenceEntry` carries `kind` as its\n" #
    "stable tag text (`lot_kind`, `site`, `status`, `event_kind`, `caption`,\n" #
    "`form_default`). `roleAssignment` carries `principal` (canonical textual\n" #
    "form) and `role` as its stable tag text (`guest`, `field_officer`,\n" #
    "`assayer`, `workshop`, `admin`).\n" #
    "\n" #
    "OQL is read-only: it never mutates state, and it is not a substitute for\n" #
    "the register's own methods. A query that names an unknown entity or field,\n" #
    "or that is malformed JSON, traps rather than returning an error envelope.\n" #
    "\n" #
    "## Units and encodings\n" #
    "\n" #
    "- `Timestamp` is an `Int` count of nanoseconds from the Unix epoch, always\n" #
    "  taken from the canister clock, never a client clock.\n" #
    "- `grossG` is a decimal gram weight carried as text (for example `\"184.2\"`),\n" #
    "  so no floating-point rounding is introduced.\n" #
    "- `HashHex` is a SHA-256 digest rendered as 64 lowercase hex characters.\n" #
    "- `LotId` has the form `JOA-<SITE>-YYYYMMDD-<NNNN>`, for example\n" #
    "  `JOA-MFB-20260918-0047`. `<SITE>` is one of `MFB`, `LUS`, `KFB`; the daily\n" #
    "  sequence is four digits from `0001`.\n" #
    "- `FileId` is an opaque file-storage identifier for an uploaded document or\n" #
    "  photo. `FileHash` pairs a `fileId` with its `contentHash`.\n" #
    "- `Principal` values are Internet Computer principals; `openedBy` and each\n" #
    "  event's `by` are the caller principal.\n" #
    "- Optional values are Candid `opt`; `supersededBy` is `null` when an event\n" #
    "  has not been superseded.\n" #
    "\n" #
    "### Canonical JSON\n" #
    "\n" #
    "`canonicalSnapshotJson(lotId)` returns the exact canonical JSON that is\n" #
    "hashed into a lot's `contentHash`: keys sorted alphabetically, no extra\n" #
    "whitespace, every scalar rendered as a string, and `fileContentHashes`\n" #
    "carrying the sorted per-file content hashes for the lot and all of its\n" #
    "events. `canonicalEventJson(kind, payload, fileContentHashes)` does the same\n" #
    "for an event's `payloadHash`. `sha256Hex` and `sha256HexOfBlob` expose the\n" #
    "same digest the backend uses, so a client can recompute and compare every\n" #
    "hash.\n" #
    "\n" #
    "## Lifecycle and polling\n" #
    "\n" #
    "A lot is created by `registerLot` with event seq 1 of kind `extracted` and\n" #
    "status `open`. Each `appendEvent` increments the sequence and may move the\n" #
    "status: `moved` sets `in_transit`, `assay` sets `assayed`, `retail` sets\n" #
    "`retailed`; every other kind leaves the status unchanged. `changeStatus`\n" #
    "records an explicit transition as a `status_change` event. `splitLot`\n" #
    "creates child lots with `parentIds` set and a `split` event on each child;\n" #
    "the source lot is never deleted. `mergeLots` appends a `merge` event on the\n" #
    "destination and a `note` on the source. `freezeLot` sets `frozen` and status\n" #
    "`frozen`; after that every mutation on the lot returns `#lotFrozen`.\n" #
    "\n" #
    "The status `key` is the stable identifier stored on the lot; the\n" #
    "human-readable term comes from the `#status` reference entries and reads:\n" #
    "`open` is \"Recently Mined\", `in_transit` is \"In transit\", `assayed` is\n" #
    "\"Testing Quality\", `retailed` is \"Retailed\", `closed` is \"Applied for\n" #
    "crafting\" and `frozen` is \"Confiscated by Authorities\". Site labels read\n" #
    "\"Mining Site\" / \"Mining Sites\".\n" #
    "\n" #
    "All mutations are synchronous update calls that return the resulting\n" #
    "`LotView` (or `[LotView]` for a split) in the same response, so there is no\n" #
    "job to poll. To observe changes made by others, re-read with `listLots`,\n" #
    "`getLot` or `searchLots`; these are queries and return the current state.\n" #
    "\n" #
    "## Mutation retry safety\n" #
    "\n" #
    "Mutations are not idempotent. `registerLot` and `splitLot` allocate the next\n" #
    "daily sequence at call time, so retrying a call that already succeeded\n" #
    "creates a second lot rather than returning the first. `appendEvent`,\n" #
    "`mergeLots` and `freezeLot` append a new event on every successful call, so a\n" #
    "retry adds a duplicate event. After a timeout or an ambiguous failure,\n" #
    "re-read the lot with `getLot` and confirm whether the event landed before\n" #
    "retrying. `freezeLot` is destructive in the sense that it permanently blocks\n" #
    "further mutation of that lot; it cannot be undone.\n" #
    "\n" #
    "## Errors\n" #
    "\n" #
    "Register mutations return `Result<_, RegisterError>` with these variants:\n" #
    "\n" #
    "- `#notAuthenticated` — the caller is the anonymous principal.\n" #
    "- `#notAuthorized` — the caller's role does not permit the action.\n" #
    "- `#unknownLot(lotId)` — no lot with that id exists.\n" #
    "- `#duplicateLot(lotId)` — a lot with that id already exists.\n" #
    "- `#lotFrozen(lotId)` — the lot is frozen and cannot be mutated.\n" #
    "- `#invalidInput(message)` — the request is malformed, for example a split\n" #
    "  with no children or a merge of a lot into itself.\n" #
    "\n" #
    "Reference-data and analysis-document methods return\n" #
    "`Result<_, ReferenceError>` with these variants:\n" #
    "\n" #
    "- `#notAuthenticated` — the caller is the anonymous principal.\n" #
    "- `#notAuthorized` — the caller is not an admin.\n" #
    "- `#unknownEntry(id)` — no reference entry with that id exists.\n" #
    "- `#unknownDocument(id)` — no analysis document with that id exists.\n" #
    "- `#duplicateEntry(key)` — a reference entry with that kind and key exists.\n" #
    "- `#invalidInput(message)` — the request is malformed, for example a blank\n" #
    "  key, display name or title.\n" #
    "\n" #
    "Purge methods return `Result<_, PurgeError>` with these variants:\n" #
    "\n" #
    "- `#notAuthenticated` — the caller is the anonymous principal.\n" #
    "- `#notAuthorized` — the caller is not an admin.\n" #
    "- `#noPendingRequest` — there is no open purge request to confirm.\n" #
    "- `#alreadyRequested` — a purge request is already open.\n" #
    "- `#alreadyConfirmed` — the caller already confirmed the open request.\n" #
    "- `#invalidPhrase` — the confirmation phrase was not typed verbatim.\n" #
    "- `#invalidInput(message)` — the request is malformed.\n" #
    "\n" #
    "Permission methods return `Result<_, PermissionsError>` with these\n" #
    "variants:\n" #
    "\n" #
    "- `#notAuthenticated` — the caller is the anonymous principal.\n" #
    "- `#notAuthorized` — the caller is not an admin.\n" #
    "- `#unknownPrincipal(principal)` — no such principal has an override.\n" #
    "- `#invalidInput(message)` — the request is malformed.\n" #
    "\n" #
    "## Gotchas\n" #
    "\n" #
    "- The lot's item-kind field is named `lotType`, not `type`.\n" #
    "- `supersededBy` on an event is the seq of the later `correction` event that\n" #
    "  points at it; the original event stays visible and is marked\n" #
    "  `superseded by seq N` rather than being removed.\n" #
    "- `fileHashes` on a `LotView` is the persisted per-file content-hash set for\n" #
    "  the lot; it is empty only when no file was ever attached.\n" #
    "- `suggestLotId` is a hint computed from the current register state. It is\n" #
    "  not a reservation: a concurrent registration can take the same id, and\n" #
    "  `registerLot` allocates the id itself.\n" #
    "- `searchLots` matches a lowercased term against the lot id, a content-hash\n" #
    "  prefix, the seal number and the working reference; an empty term returns\n" #
    "  no hits.\n" #
    "- `registerSummary` is the public aggregate feed for the home-page graph:\n" #
    "  totals, counts by type, status and site, and per-day event activity.\n" #
    "  `registerAnalytics` is the admin-only equivalent with separate lot and\n" #
    "  event time series. Status and site breakdowns are keyed by the stable\n" #
    "  `key` (`open`, `assayed`, `MFB`, …); the display terms come from the\n" #
    "  `#status` and `#site` reference entries.\n" #
    "- Reference entries are keyed by `kind` plus `key`; the `key` is the stable\n" #
    "  identifier the register stores, while `displayName` is what a user sees.\n" #
    "  Deactivating an entry hides it from `listReferenceEntries` without\n" #
    "  deleting it.\n";
  };
};
