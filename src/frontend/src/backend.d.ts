import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ActivityPoint {
    day: string;
    count: bigint;
}
export interface ActorRole {
    principal: Principal;
    role: Role;
}
export interface AnalysisDocumentView {
    id: string;
    title: string;
    contentHash: HashHex;
    note: string;
    fileId: FileId;
    docKind: string;
    uploadedAt: Timestamp;
    uploadedBy: Principal;
}
export interface AnalyticsBucket {
    key: string;
    count: bigint;
}
export interface AnalyticsPoint {
    day: string;
    lots: bigint;
    events: bigint;
}
export interface CapabilityRow {
    displayName: string;
    roles: Array<Role>;
    capability: Capability;
}
export interface Cell {
    value: Value;
    name: string;
}
export interface CountBucket {
    key: string;
    count: bigint;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface EventView {
    at: Timestamp;
    by: Principal;
    seq: bigint;
    supersededBy?: bigint;
    kind: EventKind;
    payloadHash: HashHex;
    payload: string;
    fileIds: Array<FileId>;
}
export interface FileHash {
    contentHash: HashHex;
    fileId: FileId;
}
export type FileId = string;
export interface HashChainEntry {
    at: Timestamp;
    contentHash: HashHex;
    eventSeq: bigint;
}
export type HashHex = string;
export type LotId = string;
export interface LotSearchHit {
    id: LotId;
    status: LotStatus;
    contentHash: HashHex;
    workingRef: string;
    sealNo: string;
    lotType: LotType;
}
export interface LotView {
    id: LotId;
    gps: string;
    status: LotStatus;
    grossG: string;
    contentHash: HashHex;
    workingRef: string;
    statusHistory: Array<StatusChange>;
    sealNo: string;
    hashChain: Array<HashChainEntry>;
    parentIds: Array<LotId>;
    events: Array<EventView>;
    fileHashes: Array<FileHash>;
    photoFileIds: Array<FileId>;
    frozen: boolean;
    licence: string;
    lotType: LotType;
    project: string;
    openedAt: Timestamp;
    openedBy: Principal;
    fileIds: Array<FileId>;
}
export interface MergeInput {
    destinationId: LotId;
    sourceId: LotId;
    payload: string;
}
export interface NewAnalysisDocumentInput {
    title: string;
    contentHash: HashHex;
    note: string;
    fileId: FileId;
    docKind: string;
}
export interface NewEventInput {
    kind: EventKind;
    fileHashes: Array<FileHash>;
    payload: string;
    fileIds: Array<FileId>;
}
export interface NewLotInput {
    gps: string;
    grossG: string;
    workingRef: string;
    site: Site;
    sealNo: string;
    fileHashes: Array<FileHash>;
    photoFileIds: Array<FileId>;
    licence: string;
    lotType: LotType;
    project: string;
    fileIds: Array<FileId>;
}
export interface NewRefEntryInput {
    key: string;
    displayName: string;
    value: string;
    sortOrder: bigint;
    kind: RefKind;
}
export type PermissionsError = {
    __kind__: "unknownPrincipal";
    unknownPrincipal: Principal;
} | {
    __kind__: "notAuthorized";
    notAuthorized: null;
} | {
    __kind__: "invalidInput";
    invalidInput: string;
} | {
    __kind__: "notAuthenticated";
    notAuthenticated: null;
};
export interface PermissionsView {
    roleDefaults: Array<RolePermissions>;
    capabilities: Array<CapabilityRow>;
    overrides: Array<PrincipalOverride>;
}
export interface PrincipalOverride {
    principal: Principal;
    capabilities: Array<Capability>;
    role: Role;
}
export type PurgeError = {
    __kind__: "alreadyConfirmed";
    alreadyConfirmed: null;
} | {
    __kind__: "notAuthorized";
    notAuthorized: null;
} | {
    __kind__: "invalidInput";
    invalidInput: string;
} | {
    __kind__: "alreadyRequested";
    alreadyRequested: null;
} | {
    __kind__: "notAuthenticated";
    notAuthenticated: null;
} | {
    __kind__: "noPendingRequest";
    noPendingRequest: null;
} | {
    __kind__: "invalidPhrase";
    invalidPhrase: null;
};
export type PurgeOutcome = {
    __kind__: "pending";
    pending: PurgeRequestView;
} | {
    __kind__: "executed";
    executed: PurgeResult;
};
export interface PurgeRequestView {
    id: string;
    confirmedBy: Array<Principal>;
    totalAdmins: bigint;
    confirmedCount: bigint;
    requiredConfirmations: bigint;
    requestedAt: Timestamp;
    requestedBy: Principal;
}
export interface PurgeResult {
    purgedAt: Timestamp;
    purgedBy: Principal;
    eventsRemoved: bigint;
    lotsRemoved: bigint;
    filesRemoved: bigint;
}
export interface RefEntryView {
    id: string;
    key: string;
    active: boolean;
    displayName: string;
    value: string;
    sortOrder: bigint;
    kind: RefKind;
}
export type ReferenceError = {
    __kind__: "notAuthorized";
    notAuthorized: null;
} | {
    __kind__: "invalidInput";
    invalidInput: string;
} | {
    __kind__: "duplicateEntry";
    duplicateEntry: string;
} | {
    __kind__: "unknownDocument";
    unknownDocument: string;
} | {
    __kind__: "notAuthenticated";
    notAuthenticated: null;
} | {
    __kind__: "unknownEntry";
    unknownEntry: string;
};
export interface RegisterAnalytics {
    byKind: Array<AnalyticsBucket>;
    bySite: Array<AnalyticsBucket>;
    eventsOverTime: Array<AnalyticsPoint>;
    totalEvents: bigint;
    totalLots: bigint;
    lotsOverTime: Array<AnalyticsPoint>;
    byStatus: Array<AnalyticsBucket>;
}
export type RegisterError = {
    __kind__: "duplicateLot";
    duplicateLot: LotId;
} | {
    __kind__: "notAuthorized";
    notAuthorized: null;
} | {
    __kind__: "invalidInput";
    invalidInput: string;
} | {
    __kind__: "unknownLot";
    unknownLot: LotId;
} | {
    __kind__: "lotFrozen";
    lotFrozen: LotId;
} | {
    __kind__: "notAuthenticated";
    notAuthenticated: null;
};
export interface RegisterSummary {
    bySite: Array<CountBucket>;
    byType: Array<CountBucket>;
    totalEvents: bigint;
    totalLots: bigint;
    byStatus: Array<CountBucket>;
    activity: Array<ActivityPoint>;
}
export type Result = {
    __kind__: "ok";
    ok: RolePermissions;
} | {
    __kind__: "err";
    err: PermissionsError;
};
export type Result_1 = {
    __kind__: "ok";
    ok: RefEntryView;
} | {
    __kind__: "err";
    err: ReferenceError;
};
export type Result_10 = {
    __kind__: "ok";
    ok: Array<RefEntryView>;
} | {
    __kind__: "err";
    err: ReferenceError;
};
export type Result_11 = {
    __kind__: "ok";
    ok: Array<ActorRole>;
} | {
    __kind__: "err";
    err: RegisterError;
};
export type Result_12 = {
    __kind__: "ok";
    ok: PurgeRequestView | null;
} | {
    __kind__: "err";
    err: PurgeError;
};
export type Result_13 = {
    __kind__: "ok";
    ok: PermissionsView;
} | {
    __kind__: "err";
    err: PermissionsError;
};
export type Result_14 = {
    __kind__: "ok";
    ok: LotId;
} | {
    __kind__: "err";
    err: RegisterError;
};
export type Result_15 = {
    __kind__: "ok";
    ok: Role;
} | {
    __kind__: "err";
    err: RegisterError;
};
export type Result_16 = {
    __kind__: "ok";
    ok: ActorRole;
} | {
    __kind__: "err";
    err: RegisterError;
};
export type Result_17 = {
    __kind__: "ok";
    ok: AnalysisDocumentView;
} | {
    __kind__: "err";
    err: ReferenceError;
};
export type Result_18 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export type Result_2 = {
    __kind__: "ok";
    ok: Array<LotView>;
} | {
    __kind__: "err";
    err: RegisterError;
};
export type Result_3 = {
    __kind__: "ok";
    ok: PrincipalOverride;
} | {
    __kind__: "err";
    err: PermissionsError;
};
export type Result_4 = {
    __kind__: "ok";
    ok: PurgeOutcome;
} | {
    __kind__: "err";
    err: PurgeError;
};
export type Result_5 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: ReferenceError;
};
export type Result_6 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: PermissionsError;
};
export type Result_7 = {
    __kind__: "ok";
    ok: LotView;
} | {
    __kind__: "err";
    err: RegisterError;
};
export type Result_8 = {
    __kind__: "ok";
    ok: RegisterAnalytics;
} | {
    __kind__: "err";
    err: ReferenceError;
};
export type Result_9 = {
    __kind__: "ok";
    ok: Array<AnalysisDocumentView>;
} | {
    __kind__: "err";
    err: ReferenceError;
};
export interface Result__1 {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export interface RoleInfo {
    displayName: string;
    role: Role;
}
export interface RolePermissions {
    capabilities: Array<Capability>;
    role: Role;
}
export interface SetPrincipalOverrideInput {
    principal: Principal;
    capabilities: Array<Capability>;
    role: Role;
}
export interface SplitInput {
    children: Array<NewLotInput>;
    parentId: LotId;
}
export interface StatusChange {
    at: Timestamp;
    by: Principal;
    to: LotStatus;
    seq: bigint;
    from: LotStatus;
}
export interface StatusChangeInput {
    to: LotStatus;
    payload: string;
}
export type Timestamp = bigint;
export interface UpdateRefEntryInput {
    id: string;
    active: boolean;
    displayName: string;
    value: string;
    sortOrder: bigint;
}
export interface UpdateRolePermissionsInput {
    capabilities: Array<Capability>;
    role: Role;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export enum Capability {
    change_status = "change_status",
    purge_register = "purge_register",
    split_lot = "split_lot",
    create_lot = "create_lot",
    merge_lot = "merge_lot",
    manage_analysis_documents = "manage_analysis_documents",
    delete_lot = "delete_lot",
    freeze_lot = "freeze_lot",
    manage_roles = "manage_roles",
    manage_reference_data = "manage_reference_data",
    append_event = "append_event",
    view_analytics = "view_analytics"
}
export enum EventKind {
    cut = "cut",
    merge = "merge",
    retail = "retail",
    moved = "moved",
    assay = "assay",
    note = "note",
    status_change = "status_change",
    sealed = "sealed",
    weighed = "weighed",
    correction = "correction",
    split = "split",
    extracted = "extracted",
    photo = "photo"
}
export enum LotStatus {
    closed = "closed",
    assayed = "assayed",
    open = "open",
    in_transit = "in_transit",
    retailed = "retailed",
    frozen = "frozen"
}
export enum LotType {
    gold = "gold",
    emerald = "emerald"
}
export enum RefKind {
    status = "status",
    site = "site",
    form_default = "form_default",
    lot_kind = "lot_kind",
    caption = "caption",
    event_kind = "event_kind"
}
export enum Role {
    workshop = "workshop",
    admin = "admin",
    field_officer = "field_officer",
    assayer = "assayer",
    guest = "guest"
}
export enum Site {
    KFB = "KFB",
    LUS = "LUS",
    MFB = "MFB"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
/**
 * / JOA Gold Book — composition root for the provenance register backend.
 * / State is declared here with types only; initial values come from the
 * / migration chain in migrations/.
 * /
 * / Each piece of state has exactly one home: the register's lots, file hashes
 * / and OQL lot index live inside `registerState`, the role map lives inside
 * / `rolesState`, the admin-managed reference data, analysis documents and
 * / their counters live inside `referenceState`, the pending purge request
 * / lives inside `purgeState`, and the role permission defaults and
 * / per-principal overrides live inside `permissionsState`. The migration's
 * / `NewActor` matches this actor shape exactly.
 */
export interface backendInterface {
    /**
     * / Store an analysis document. Admin only.
     */
    addAnalysisDocument(input: NewAnalysisDocumentInput): Promise<Result_17>;
    /**
     * / Add a reference entry. Admin only.
     */
    addReferenceEntry(input: NewRefEntryInput): Promise<Result_1>;
    /**
     * / Append a provenance event to a lot. The caller's role must permit the
     * / event kind.
     */
    appendEvent(lotId: LotId, input: NewEventInput): Promise<Result_7>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    /**
     * / Assign a role to a principal. Admin only.
     */
    assignRole(target: Principal, role: Role): Promise<Result_16>;
    /**
     * / Canonical event payload JSON, so the frontend can recompute payloadHash.
     */
    canonicalEventJson(kind: EventKind, payload: string, fileContentHashes: Array<HashHex>): Promise<string>;
    /**
     * / Canonical lot snapshot JSON, so the frontend can recompute contentHash.
     * / Built through the register's own snapshot path, so it reproduces the
     * / sealed contentHash exactly, including event file content hashes and every
     * / event's payloadHash.
     */
    canonicalSnapshotJson(lotId: LotId): Promise<string | null>;
    /**
     * / Record a status change as a new provenance event in the lot's chain. The
     * / caller's role must be permitted to make the transition.
     */
    changeStatus(lotId: LotId, input: StatusChangeInput): Promise<Result_7>;
    /**
     * / The first identity that claims admin becomes admin.
     */
    claimAdmin(): Promise<Result_15>;
    /**
     * / Confirm the open purge request. Admin only. Executes automatically once
     * / more than half of the currently-assigned admins have confirmed.
     */
    confirmPurge(): Promise<Result_4>;
    /**
     * / Delete exactly one block, removing its events, hash chain and stored file
     * / references. Requires the `#delete_lot` capability, held by admin by
     * / default; a caller without it is refused with `#notAuthorized`. This is the
     * / register's one explicit destructive action.
     */
    deleteLot(lotId: LotId): Promise<Result_14>;
    execute(qJson: string): Promise<Result__1>;
    /**
     * / Freeze a lot. Admin only.
     */
    freezeLot(lotId: LotId): Promise<Result_7>;
    /**
     * / The backend's public API documentation as Markdown.
     */
    getApiDoc(): Promise<string>;
    getCallerUserRole(): Promise<UserRole>;
    /**
     * / Fetch a single lot by id. Public read.
     */
    getLot(lotId: LotId): Promise<LotView | null>;
    /**
     * / The calling principal's effective capabilities.
     */
    getMyCapabilities(): Promise<Array<Capability>>;
    /**
     * / The role of the calling principal.
     */
    getMyRole(): Promise<Role>;
    /**
     * / The full Permissions section. Admin only.
     */
    getPermissions(): Promise<Result_13>;
    /**
     * / The open purge request and its confirmation progress, if any. Admin only.
     */
    getPurgeRequest(): Promise<Result_12>;
    /**
     * / Whether an administrator already exists. Public and non-sensitive: it
     * / lets the frontend hide the claim action once the role has been claimed.
     */
    hasAdmin(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    /**
     * / List every actor with its principal and role. Admin only.
     */
    listActors(): Promise<Result_11>;
    /**
     * / List every reference entry, including inactive ones. Admin only.
     */
    listAllReferenceEntries(): Promise<Result_10>;
    /**
     * / List the stored analysis documents, newest first. Admin only.
     */
    listAnalysisDocuments(): Promise<Result_9>;
    /**
     * / List every lot in the register. Public read.
     */
    listLots(): Promise<Array<LotView>>;
    /**
     * / List the active reference entries of one kind. Public read: the register's
     * / forms and displays are driven by this data.
     */
    listReferenceEntries(kind: RefKind): Promise<Array<RefEntryView>>;
    /**
     * / Every role with its display name, for the admin panel.
     */
    listRoles(): Promise<Array<RoleInfo>>;
    /**
     * / Merge a source lot into a destination lot. Workshop or admin only.
     */
    mergeLots(input: MergeInput): Promise<Result_7>;
    /**
     * / The register's own live analytics. Admin only.
     */
    registerAnalytics(): Promise<Result_8>;
    /**
     * / Register a new lot. Signed-in callers with a role that permits the lot
     * / type only.
     */
    registerLot(input: NewLotInput): Promise<Result_7>;
    /**
     * / Aggregate register data for the home-page graph. Public read.
     */
    registerSummary(): Promise<RegisterSummary>;
    /**
     * / Remove an analysis document. Admin only.
     */
    removeAnalysisDocument(id: string): Promise<Result_5>;
    /**
     * / Remove a per-principal permission override. Admin only.
     */
    removePrincipalOverride(target: Principal): Promise<Result_6>;
    /**
     * / Remove a reference entry. Admin only.
     */
    removeReferenceEntry(id: string): Promise<Result_5>;
    /**
     * / Open a purge request. Admin only. The phrase must be typed verbatim.
     */
    requestPurge(phrase: string): Promise<Result_4>;
    /**
     * / The human-readable display name for a role. 'Assayer' reads
     * / 'Quality Tester' and 'Workshop' reads 'Custom Role'.
     */
    roleDisplayName(role: Role): Promise<string>;
    schema(): Promise<string>;
    /**
     * / Search across lot id, content-hash prefix, seal number and working ref.
     */
    searchLots(term: string): Promise<Array<LotSearchHit>>;
    /**
     * / Set a per-principal permission override for a role. Admin only.
     */
    setPrincipalOverride(input: SetPrincipalOverrideInput): Promise<Result_3>;
    /**
     * / SHA-256 of a UTF-8 text as 64 lowercase hex characters.
     */
    sha256Hex(input: string): Promise<HashHex>;
    /**
     * / SHA-256 of raw file bytes as 64 lowercase hex characters.
     */
    sha256HexOfBlob(input: Uint8Array): Promise<HashHex>;
    /**
     * / Split a lot into child lots. Workshop or admin only.
     */
    splitLot(input: SplitInput): Promise<Result_2>;
    /**
     * / The status-change history for a lot, in provenance order. Public read.
     */
    statusHistory(lotId: LotId): Promise<Array<StatusChange>>;
    /**
     * / Suggest the next lot id for a site and date.
     */
    suggestLotId(site: Site, date: string): Promise<LotId>;
    /**
     * / Edit a reference entry. Admin only.
     */
    updateReferenceEntry(input: UpdateRefEntryInput): Promise<Result_1>;
    /**
     * / Edit a role's default permission set. Admin only.
     */
    updateRolePermissions(input: UpdateRolePermissionsInput): Promise<Result>;
}
