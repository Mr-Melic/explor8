import type { backendInterface } from "@/backend";
import type {
  AnalysisDocumentView,
  Capability,
  LotView,
  PermissionsView,
  PurgeOutcome,
  PurgeRequestView,
  RefEntryView,
  RefKind,
  RegisterAnalytics,
  RegisterSummary,
  Role,
  RoleInfo,
  StatusChange,
} from "@/lib/backend";
import { fakePrincipal } from "@/test/fixtures";
import { vi } from "vitest";

/**
 * A typed local stand-in for the generated backend actor.
 *
 * Every method the UI can reach is present and returns a resolved value, so a
 * component that calls one never trips over `undefined`. Tests override only
 * the methods they exercise. This is a mock seam, not a backend: it proves the
 * frontend's contract with the actor, never the canister's behavior.
 */
export type MockActor = {
  [K in keyof backendInterface]: ReturnType<typeof vi.fn>;
};

export interface MockActorOptions {
  lots?: LotView[];
  summary?: RegisterSummary;
  role?: Role;
  /** Result returned by `getMyRole`; `null` models a signed-in principal with no role yet. */
  myRole?: Role | null;
  /** Result returned by `listActors`. */
  actors?: { principal: unknown; role: Role }[];
  /** Result returned by `claimAdmin`. */
  claimAdminResult?: unknown;
  /** Result returned by `hasAdmin`; `false` models an unclaimed register. */
  hasAdmin?: boolean;
  /** Result returned by `registerLot`. */
  registerLotResult?: unknown;
  /** Result returned by `appendEvent`. */
  appendEventResult?: unknown;
  /** Result returned by `freezeLot`. */
  freezeLotResult?: unknown;
  /** Result returned by `deleteLot`; defaults to an `ok` echoing the lot id. */
  deleteLotResult?: unknown;
  /** Result returned by `assignRole`. */
  assignRoleResult?: unknown;
  /** Result returned by `searchLots`. */
  searchHits?: unknown[];
  /** Suggested id returned by `suggestLotId`. */
  suggestedId?: string;
  /** Active reference entries returned by `listReferenceEntries`, by kind. */
  referenceEntries?: Partial<Record<RefKind, RefEntryView[]>>;
  /** Every reference entry returned by `listAllReferenceEntries`. */
  allReferenceEntries?: RefEntryView[];
  /** Stored analysis documents returned by `listAnalysisDocuments`. */
  documents?: AnalysisDocumentView[];
  /** Result returned by `registerAnalytics`. */
  analytics?: RegisterAnalytics;
  /** The calling principal's effective capabilities, from `getMyCapabilities`. */
  myCapabilities?: Capability[];
  /** The full Permissions section returned by `getPermissions`. */
  permissions?: PermissionsView;
  /** The open purge request returned by `getPurgeRequest`; `null` models none. */
  purgeRequest?: PurgeRequestView | null;
  /** Result returned by `requestPurge`. */
  requestPurgeResult?: PurgeOutcome;
  /** Result returned by `confirmPurge`. */
  confirmPurgeResult?: PurgeOutcome;
  /** Status-change history returned by `statusHistory`, by lot id. */
  statusHistory?: Record<string, StatusChange[]>;
  /** Every role with its display name, from `listRoles`. */
  roles?: RoleInfo[];
}

export function createMockActor(options: MockActorOptions = {}): MockActor {
  const lots = options.lots ?? [];
  const summary = options.summary ?? {
    totalLots: BigInt(lots.length),
    totalEvents: 0n,
    byType: [],
    byStatus: [],
    bySite: [],
    activity: [],
  };

  const referenceEntries = options.referenceEntries ?? {};
  const allReferenceEntries =
    options.allReferenceEntries ??
    Object.values(referenceEntries).flatMap((entries) => entries ?? []);
  const documents = options.documents ?? [];
  const analytics = options.analytics ?? {
    totalLots: BigInt(lots.length),
    totalEvents: summary.totalEvents,
    lotsOverTime: [],
    eventsOverTime: [],
    byKind: [],
    byStatus: [],
    bySite: [],
  };

  const actor = {
    _initialize_access_control: vi.fn(async () => undefined),
    _internet_identity_sign_in_finish: vi.fn(async () => ({
      __kind__: "ok",
      ok: null,
    })),
    _internet_identity_sign_in_start: vi.fn(async () => new Uint8Array()),
    addAnalysisDocument: vi.fn(async () => ({
      __kind__: "ok",
      ok: documents[0] ?? null,
    })),
    addReferenceEntry: vi.fn(async () => ({
      __kind__: "ok",
      ok: allReferenceEntries[0] ?? null,
    })),
    appendEvent: vi.fn(
      async () =>
        options.appendEventResult ?? { __kind__: "ok", ok: lots[0] ?? null },
    ),
    assignCallerUserRole: vi.fn(async () => undefined),
    assignRole: vi.fn(
      async () =>
        options.assignRoleResult ?? {
          __kind__: "ok",
          ok: { principal: null, role: options.role ?? "guest" },
        },
    ),
    canonicalEventJson: vi.fn(async () => "{}"),
    canonicalSnapshotJson: vi.fn(async () => "{}"),
    changeStatus: vi.fn(
      async () =>
        options.appendEventResult ?? { __kind__: "ok", ok: lots[0] ?? null },
    ),
    claimAdmin: vi.fn(
      async () => options.claimAdminResult ?? { __kind__: "ok", ok: "admin" },
    ),
    deleteLot: vi.fn(
      async (lotId: string) =>
        options.deleteLotResult ?? { __kind__: "ok", ok: lotId },
    ),
    confirmPurge: vi.fn(async () => ({
      __kind__: "ok",
      ok: options.confirmPurgeResult ?? {
        __kind__: "executed",
        executed: {
          purgedAt: 1_758_153_600_000_000_000n,
          purgedBy: fakePrincipal(),
          eventsRemoved: 0n,
          lotsRemoved: 0n,
          filesRemoved: 0n,
        },
      },
    })),
    execute: vi.fn(async () => ({ hasMore: false, rows: [] })),
    freezeLot: vi.fn(
      async () =>
        options.freezeLotResult ?? { __kind__: "ok", ok: lots[0] ?? null },
    ),
    getApiDoc: vi.fn(async () => "# API"),
    getCallerUserRole: vi.fn(async () => "guest"),
    getMyCapabilities: vi.fn(async () => options.myCapabilities ?? []),
    getPermissions: vi.fn(async () => ({
      __kind__: "ok",
      ok: options.permissions ?? {
        roleDefaults: [],
        capabilities: [],
        overrides: [],
      },
    })),
    getPurgeRequest: vi.fn(async () => ({
      __kind__: "ok",
      ok: options.purgeRequest ?? null,
    })),
    hasAdmin: vi.fn(async () => options.hasAdmin ?? false),
    getLot: vi.fn(
      async (id: string) => lots.find((lot) => lot.id === id) ?? null,
    ),
    getMyRole: vi.fn(async () =>
      options.myRole === undefined ? (options.role ?? "guest") : options.myRole,
    ),
    isCallerAdmin: vi.fn(async () => options.role === "admin"),
    listActors: vi.fn(async () => ({
      __kind__: "ok",
      ok: options.actors ?? [],
    })),
    listAllReferenceEntries: vi.fn(async () => ({
      __kind__: "ok",
      ok: allReferenceEntries,
    })),
    listAnalysisDocuments: vi.fn(async () => ({
      __kind__: "ok",
      ok: documents,
    })),
    listLots: vi.fn(async () => lots),
    listReferenceEntries: vi.fn(
      async (kind: RefKind) => referenceEntries[kind] ?? [],
    ),
    listRoles: vi.fn(async () => options.roles ?? []),
    mergeLots: vi.fn(async () => ({ __kind__: "ok", ok: lots[0] ?? null })),
    registerAnalytics: vi.fn(async () => ({ __kind__: "ok", ok: analytics })),
    registerLot: vi.fn(
      async () =>
        options.registerLotResult ?? { __kind__: "ok", ok: lots[0] ?? null },
    ),
    registerSummary: vi.fn(async () => summary),
    removeAnalysisDocument: vi.fn(async () => ({ __kind__: "ok", ok: null })),
    removePrincipalOverride: vi.fn(async () => ({ __kind__: "ok", ok: null })),
    removeReferenceEntry: vi.fn(async () => ({ __kind__: "ok", ok: null })),
    requestPurge: vi.fn(async () => ({
      __kind__: "ok",
      ok: options.requestPurgeResult ?? {
        __kind__: "pending",
        pending: {
          id: "purge-0",
          confirmedBy: [fakePrincipal()],
          totalAdmins: 1n,
          confirmedCount: 1n,
          requiredConfirmations: 1n,
          requestedAt: 1_758_153_600_000_000_000n,
          requestedBy: fakePrincipal(),
        },
      },
    })),
    roleDisplayName: vi.fn(async (role: Role) => role),
    schema: vi.fn(async () => "{}"),
    searchLots: vi.fn(async () => options.searchHits ?? []),
    setPrincipalOverride: vi.fn(async () => ({
      __kind__: "ok",
      ok: {
        principal: fakePrincipal(),
        role: options.role ?? "guest",
        capabilities: [],
      },
    })),
    sha256Hex: vi.fn(async () => "0".repeat(64)),
    sha256HexOfBlob: vi.fn(async () => "0".repeat(64)),
    splitLot: vi.fn(async () => ({ __kind__: "ok", ok: [] })),
    statusHistory: vi.fn(
      async (lotId: string) => options.statusHistory?.[lotId] ?? [],
    ),
    suggestLotId: vi.fn(
      async () => options.suggestedId ?? "JOA-MFB-20260921-0001",
    ),
    updateReferenceEntry: vi.fn(async () => ({
      __kind__: "ok",
      ok: allReferenceEntries[0] ?? null,
    })),
    updateRolePermissions: vi.fn(async () => ({
      __kind__: "ok",
      ok: { role: options.role ?? "guest", capabilities: [] },
    })),
  } as unknown as MockActor;

  return actor;
}
