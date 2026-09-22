import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

/**
 * The JOA Gold Book register's real public API, driven against the app's own
 * compiled wasm on the platform's PocketIC replica.
 *
 * The frontend suite mocks the actor, so it passes unchanged against a canister
 * whose methods are all `Debug.todo()` stubs. This lane is the only place the
 * real canister is called: it proves the seed state is readable, that the
 * append-only write path round-trips, and that per-caller authorization is
 * enforced by the backend rather than only by the UI.
 *
 * Shapes come from the generated declarations, not the frontend wrapper:
 * `Nat`/`Int` are `bigint`, `?T` is `[] | [T]`, a variant is `{ tag: null }`,
 * and a unit reply decodes to `null`.
 */

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

const SEED_LOT = "JOA-MFB-20260918-0047";
const SEED_LOT_EMERALD = "JOA-LUS-20260912-0003";

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

/** A fresh actor for the same canister, so a test can choose its caller. */
function actorFor(identity: ReturnType<typeof createIdentity>): Actor<_SERVICE> {
  const next = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  next.setIdentity(identity);
  return next;
}

/** A minimal valid lot input; `site` drives the generated id. */
function lotInput(overrides: Partial<Parameters<_SERVICE["registerLot"]>[0]> = {}) {
  return {
    gps: "-13.4800, 25.7000",
    grossG: "10.0",
    workingRef: "Trench T-12",
    site: { MFB: null } as const,
    sealNo: "TYV-90001",
    fileHashes: [],
    photoFileIds: [],
    licence: "44287-HQ-LEL",
    lotType: { gold: null } as const,
    project: "Mufumbwe / Kikonge",
    fileIds: [],
    ...overrides,
  };
}

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  }));
});

afterAll(async () => {
  await pic?.tearDown();
});

it("reads the three seeded lots for an anonymous caller", async () => {
  // A freshly created actor calls as the anonymous principal until an identity
  // is set, which is exactly the logged-out guest the library serves.
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);
  const lots = await guest.listLots();

  expect(lots).toHaveLength(3);
  const ids = lots.map((lot) => lot.id).sort();
  expect(ids).toEqual(
    [SEED_LOT, "JOA-MFB-20260918-0048", SEED_LOT_EMERALD].sort(),
  );

  // Every seed lot carries a 64-character content hash computed by the
  // production hashing path, and a hash chain that starts at that hash.
  for (const lot of lots) {
    expect(lot.contentHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(lot.hashChain.length).toBeGreaterThan(0);
    expect(lot.hashChain[0].contentHash).toBe(lot.contentHash);
  }
});

it("fetches a single seed lot and its canonical snapshot", async () => {
  const lot = await actor.getLot(SEED_LOT);
  expect(lot).toHaveLength(1);
  expect(lot[0]).toMatchObject({ id: SEED_LOT, sealNo: "TYV-88341" });

  // The snapshot JSON is what the frontend hashes to recompute contentHash, so
  // it must exist for a seeded lot and be non-empty.
  const snapshot = await actor.canonicalSnapshotJson(SEED_LOT);
  expect(snapshot).toHaveLength(1);
  expect(snapshot[0]).toContain(SEED_LOT);

  // An unknown lot is an absent optional, not a trap.
  expect(await actor.getLot("JOA-MFB-20260918-9999")).toEqual([]);
});

it("answers every public read the library depends on without trapping", async () => {
  const summary = await actor.registerSummary();
  expect(summary.totalLots).toBe(3n);
  expect(summary.totalEvents).toBe(7n);
  expect(summary.byType.length).toBeGreaterThan(0);

  // Search matches on id, seal number and working ref.
  const byId = await actor.searchLots(SEED_LOT);
  expect(byId.map((hit) => hit.id)).toContain(SEED_LOT);
  const bySeal = await actor.searchLots("TYV-88355");
  expect(bySeal.map((hit) => hit.id)).toContain("JOA-MFB-20260918-0048");
  const byRef = await actor.searchLots("Bench B");
  expect(byRef.map((hit) => hit.id)).toContain(SEED_LOT_EMERALD);

  // The hashing helpers the frontend calls are live and return real digests.
  const textHash = await actor.sha256Hex("abc");
  expect(textHash).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const blobHash = await actor.sha256HexOfBlob(new Uint8Array([97, 98, 99]));
  expect(blobHash).toBe(textHash);

  const eventJson = await actor.canonicalEventJson({ note: null }, "hello", []);
  expect(eventJson).toContain("hello");

  // The id suggestion and the API doc are queryable.
  expect(await actor.suggestLotId({ MFB: null }, "20260918")).toMatch(
    /^JOA-MFB-20260918-\d{4}$/u,
  );
  expect((await actor.getApiDoc()).length).toBeGreaterThan(0);
  expect((await actor.schema()).length).toBeGreaterThan(0);
});

it("rejects anonymous callers on every write", async () => {
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  await expect(guest.registerLot(lotInput())).resolves.toEqual({
    err: { notAuthenticated: null },
  });
  await expect(
    guest.appendEvent(SEED_LOT, {
      kind: { note: null },
      fileHashes: [],
      payload: "guest note",
      fileIds: [],
    }),
  ).resolves.toEqual({ err: { notAuthenticated: null } });
  await expect(guest.claimAdmin()).resolves.toEqual({
    err: { notAuthenticated: null },
  });
  await expect(guest.freezeLot(SEED_LOT)).resolves.toEqual({
    err: { notAuthenticated: null },
  });
  await expect(
    guest.assignRole(createIdentity("bob").getPrincipal(), { assayer: null }),
  ).resolves.toEqual({ err: { notAuthenticated: null } });
});

it("lets the first identity claim admin and only an admin assign roles", async () => {
  const alice = createIdentity("alice");
  const bob = createIdentity("bob");
  const aliceActor = actorFor(alice);
  const bobActor = actorFor(bob);

  // The first claim wins and returns the admin role.
  await expect(aliceActor.claimAdmin()).resolves.toEqual({
    ok: { admin: null },
  });
  await expect(aliceActor.getMyRole()).resolves.toEqual({ admin: null });

  // A second claim is refused; the first admin is not displaced.
  await expect(bobActor.claimAdmin()).resolves.toEqual({
    err: { notAuthorized: null },
  });

  // A signed-in principal with no role is a read-only guest.
  await expect(bobActor.getMyRole()).resolves.toEqual({ guest: null });

  // Only the admin can assign a role.
  await expect(
    bobActor.assignRole(bob.getPrincipal(), { assayer: null }),
  ).resolves.toEqual({ err: { notAuthorized: null } });
  await expect(
    aliceActor.assignRole(bob.getPrincipal(), { assayer: null }),
  ).resolves.toEqual({
    ok: { principal: bob.getPrincipal(), role: { assayer: null } },
  });
  await expect(bobActor.getMyRole()).resolves.toEqual({ assayer: null });

  // Only the admin can list actors.
  await expect(bobActor.listActors()).resolves.toEqual({
    err: { notAuthorized: null },
  });
  const actors = await aliceActor.listActors();
  expect(actors).toHaveProperty("ok");
  const entries = (actors as { ok: { role: unknown }[] }).ok;
  expect(entries).toHaveLength(2);
  expect(entries.map((entry) => entry.role)).toContainEqual({ admin: null });
  expect(entries.map((entry) => entry.role)).toContainEqual({ assayer: null });
});

it("reports whether an administrator exists through the public hasAdmin query", async () => {
  // A fresh canister so the bootstrap state is observable: the shared fixture
  // already has an admin by the time this file's later tests run.
  const { canisterId: freshId } = await pic!.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  });

  // The query is public: an anonymous caller can read it, and a register with
  // no administrator reports false.
  const guest = pic!.createActor<_SERVICE>(idlFactory, freshId);
  await expect(guest.hasAdmin()).resolves.toBe(false);

  // The first claim flips it to true.
  const alice = createIdentity("alice");
  const aliceActor = pic!.createActor<_SERVICE>(idlFactory, freshId);
  aliceActor.setIdentity(alice);
  await expect(aliceActor.claimAdmin()).resolves.toEqual({
    ok: { admin: null },
  });
  await expect(guest.hasAdmin()).resolves.toBe(true);

  // A second claim is refused and does not disturb the flag.
  const bob = createIdentity("bob");
  const bobActor = pic!.createActor<_SERVICE>(idlFactory, freshId);
  bobActor.setIdentity(bob);
  await expect(bobActor.claimAdmin()).resolves.toEqual({
    err: { notAuthorized: null },
  });
  await expect(guest.hasAdmin()).resolves.toBe(true);

  // The flag corresponds to a real role: the claimant is the admin.
  await expect(aliceActor.getMyRole()).resolves.toEqual({ admin: null });
});

it("round-trips a lot through the real canister and grows its hash chain on append", async () => {
  const officer = createIdentity("officer");
  const officerActor = actorFor(officer);

  // A field officer may register a lot.
  await expect(
    officerActor.assignRole(officer.getPrincipal(), { field_officer: null }),
  ).resolves.toEqual({ err: { notAuthorized: null } });

  // The admin from the previous test is the only one who can grant the role.
  const adminActor = actorFor(createIdentity("alice"));
  await expect(
    adminActor.assignRole(officer.getPrincipal(), { field_officer: null }),
  ).resolves.toEqual({
    ok: { principal: officer.getPrincipal(), role: { field_officer: null } },
  });

  const created = await officerActor.registerLot(lotInput());
  expect(created).toHaveProperty("ok");
  const lot = (created as { ok: { id: string; contentHash: string; hashChain: unknown[] } }).ok;
  expect(lot.id).toMatch(/^JOA-MFB-\d{8}-\d{4}$/u);
  expect(lot.contentHash).toMatch(/^[0-9a-f]{64}$/u);
  expect(lot.hashChain).toHaveLength(1);

  // Appending an assay event is refused for a field officer...
  await expect(
    officerActor.appendEvent(lot.id, {
      kind: { assay: null },
      fileHashes: [],
      payload: "Au 4.1 g/t",
      fileIds: [],
    }),
  ).resolves.toEqual({ err: { notAuthorized: null } });

  // ...but a note is allowed, and it appends a link to the hash chain while
  // the previous hash stays visible in the chain.
  const appended = await officerActor.appendEvent(lot.id, {
    kind: { note: null },
    fileHashes: [],
    payload: "Moved to store",
    fileIds: [],
  });
  expect(appended).toHaveProperty("ok");
  const updated = (appended as {
    ok: { contentHash: string; hashChain: { contentHash: string }[]; events: unknown[] };
  }).ok;
  expect(updated.hashChain).toHaveLength(2);
  expect(updated.hashChain[0].contentHash).toBe(lot.contentHash);
  expect(updated.hashChain[1].contentHash).toBe(updated.contentHash);
  expect(updated.events).toHaveLength(2);

  // The change is persisted, not just echoed back.
  const reread = await officerActor.getLot(lot.id);
  expect(reread).toHaveLength(1);
  expect(reread[0].contentHash).toBe(updated.contentHash);
  expect(reread[0].hashChain).toHaveLength(2);
});

it("changes contentHash when an appended event carries a file hash", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));
  const assayer = createIdentity("assayer");
  const assayerActor = actorFor(assayer);

  // Only an assayer may append an `assay` event.
  await expect(
    adminActor.assignRole(assayer.getPrincipal(), { assayer: null }),
  ).resolves.toEqual({
    ok: { principal: assayer.getPrincipal(), role: { assayer: null } },
  });

  const created = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-90003" }),
  );
  const lot = (created as { ok: { id: string; contentHash: string } }).ok;

  // The canonical snapshot folds in the content hashes of every file attached
  // to the lot or any of its events, so an event carrying a file moves the
  // lot's content hash.
  const fileHash = "a".repeat(64);
  const appended = await assayerActor.appendEvent(lot.id, {
    kind: { assay: null },
    fileHashes: [{ fileId: "cert-1", contentHash: fileHash }],
    payload: "Independent fire-assay Au 4.1 g/t cert AF-9921",
    fileIds: ["cert-1"],
  });
  expect(appended).toHaveProperty("ok");
  const updated = (appended as {
    ok: { contentHash: string; hashChain: { contentHash: string }[] };
  }).ok;
  expect(updated.contentHash).not.toBe(lot.contentHash);
  expect(updated.hashChain).toHaveLength(2);
  expect(updated.hashChain[0].contentHash).toBe(lot.contentHash);

  // The canonical snapshot the frontend hashes now carries the file hash.
  const snapshot = await adminActor.canonicalSnapshotJson(lot.id);
  expect(snapshot).toHaveLength(1);
  expect(snapshot[0]).toContain(fileHash);
});

it("returns the renamed status and site display terms from the migration chain", async () => {
  // A fresh canister runs the whole migration chain from genesis, so this is
  // the only place the 20260921_190000.mo rename is actually applied and read
  // back. The frontend suite mocks the actor and can only prove its own
  // fallback literals; this asserts what the real catalogue returns.
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  const statuses = await guest.listReferenceEntries({ status: null });
  const byKey = new Map(statuses.map((entry) => [entry.key, entry.displayName]));

  // The stable keys are unchanged; only the display terms were renamed.
  expect(byKey.get("open")).toBe("Recently Mined");
  expect(byKey.get("assayed")).toBe("Testing Quality");
  expect(byKey.get("closed")).toBe("Applied for crafting");
  expect(byKey.get("frozen")).toBe("Confiscated by Authorities");

  // A status the rename does not list keeps its seeded display name.
  expect(byKey.get("in_transit")).toBe("In transit");
  expect(byKey.get("retailed")).toBe("Retailed");

  // The site entries are seeded with real place names, not the bare
  // "Site"/"Sites" the migration normalises, so they pass through unchanged.
  const sites = await guest.listReferenceEntries({ site: null });
  expect(sites.map((entry) => entry.displayName).sort()).toEqual([
    "Kafubu",
    "Lusaka",
    "Mufumbwe",
  ]);
});

it("serves the seeded reference catalogue and gates its mutations on admin", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  // The public read is open to an anonymous caller and seeds exactly the two
  // lot kinds the register offers.
  const lotKinds = await guest.listReferenceEntries({ lot_kind: null });
  expect(lotKinds.map((entry) => entry.key).sort()).toEqual([
    "emerald",
    "gold",
  ]);
  expect(lotKinds.every((entry) => entry.active)).toBe(true);

  // The admin-only reads are refused for an anonymous caller.
  await expect(guest.listAllReferenceEntries()).resolves.toEqual({
    err: { notAuthenticated: null },
  });
  await expect(
    guest.addReferenceEntry({
      kind: { site: null },
      key: "NDL",
      displayName: "Ndola",
      value: "NDL",
      sortOrder: 4n,
    }),
  ).resolves.toEqual({ err: { notAuthenticated: null } });

  // An admin can add, edit and remove an entry, and the change is persisted.
  const added = await adminActor.addReferenceEntry({
    kind: { site: null },
    key: "NDL",
    displayName: "Ndola",
    value: "NDL",
    sortOrder: 4n,
  });
  expect(added).toHaveProperty("ok");
  const entry = (added as { ok: { id: string; displayName: string } }).ok;
  expect(entry.displayName).toBe("Ndola");

  const edited = await adminActor.updateReferenceEntry({
    id: entry.id,
    displayName: "Ndola depot",
    value: "NDL",
    sortOrder: 4n,
    active: true,
  });
  expect(edited).toHaveProperty("ok");
  expect((edited as { ok: { displayName: string } }).ok.displayName).toBe(
    "Ndola depot",
  );

  const sites = await guest.listReferenceEntries({ site: null });
  expect(sites.map((item) => item.key)).toContain("NDL");

  await expect(adminActor.removeReferenceEntry(entry.id)).resolves.toEqual({
    ok: null,
  });
  const afterRemove = await guest.listReferenceEntries({ site: null });
  expect(afterRemove.map((item) => item.key)).not.toContain("NDL");

  // A duplicate key is refused rather than silently overwriting.
  await expect(
    adminActor.addReferenceEntry({
      kind: { site: null },
      key: "MFB",
      displayName: "Mufumbwe again",
      value: "MFB",
      sortOrder: 9n,
    }),
  ).resolves.toEqual({ err: { duplicateEntry: "MFB" } });
});

it("stores and removes analysis documents as admin only", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  await expect(guest.listAnalysisDocuments()).resolves.toEqual({
    err: { notAuthenticated: null },
  });
  await expect(
    guest.addAnalysisDocument({
      title: "Guest report",
      docKind: "Assay report",
      note: "",
      fileId: "file-guest",
      contentHash: "a".repeat(64),
    }),
  ).resolves.toEqual({ err: { notAuthenticated: null } });

  const added = await adminActor.addAnalysisDocument({
    title: "Fire-assay certificate AF-9921",
    docKind: "Assay report",
    note: "Covers the MFB lots.",
    fileId: "file-1",
    contentHash: "b".repeat(64),
  });
  expect(added).toHaveProperty("ok");
  const doc = (added as { ok: { id: string; title: string; fileId: string } })
    .ok;
  expect(doc.title).toBe("Fire-assay certificate AF-9921");
  expect(doc.fileId).toBe("file-1");

  const listed = await adminActor.listAnalysisDocuments();
  expect(listed).toHaveProperty("ok");
  const documents = (listed as { ok: { id: string }[] }).ok;
  expect(documents.map((item) => item.id)).toContain(doc.id);

  await expect(adminActor.removeAnalysisDocument(doc.id)).resolves.toEqual({
    ok: null,
  });
  const afterRemove = await adminActor.listAnalysisDocuments();
  expect(
    (afterRemove as { ok: { id: string }[] }).ok.map((item) => item.id),
  ).not.toContain(doc.id);
});

it("reports genuine independent lot and event series in register analytics", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  // Analytics are admin-only.
  await expect(guest.registerAnalytics()).resolves.toEqual({
    err: { notAuthenticated: null },
  });

  const result = await adminActor.registerAnalytics();
  expect(result).toHaveProperty("ok");
  const analytics = (
    result as {
      ok: {
        totalLots: bigint;
        totalEvents: bigint;
        lotsOverTime: { day: string; lots: bigint; events: bigint }[];
        eventsOverTime: { day: string; lots: bigint; events: bigint }[];
        byKind: { key: string; count: bigint }[];
      };
    }
  ).ok;

  // The register holds at least the three seeded lots; earlier tests in this
  // file register more, so the totals are asserted against the series rather
  // than against a fixed seed count.
  expect(analytics.totalLots).toBeGreaterThanOrEqual(3n);
  expect(analytics.totalEvents).toBeGreaterThanOrEqual(7n);

  // Each series is non-empty and carries its own genuine counts: the lot
  // series counts lots, the event series counts events, and neither is the
  // other array reused.
  expect(analytics.lotsOverTime.length).toBeGreaterThan(0);
  expect(analytics.eventsOverTime.length).toBeGreaterThan(0);
  const lotsTotal = analytics.lotsOverTime.reduce(
    (sum, point) => sum + point.lots,
    0n,
  );
  const eventsTotal = analytics.eventsOverTime.reduce(
    (sum, point) => sum + point.events,
    0n,
  );
  expect(lotsTotal).toBe(analytics.totalLots);
  expect(eventsTotal).toBe(analytics.totalEvents);

  // The breakdowns are populated from the register's own lots.
  expect(analytics.byKind.map((bucket) => bucket.key).sort()).toEqual([
    "emerald",
    "gold",
  ]);
});

it("freezes a lot as admin and refuses further appends", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));

  const created = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-90002" }),
  );
  const lot = (created as { ok: { id: string } }).ok;

  // A non-admin cannot freeze.
  await expect(officerActor.freezeLot(lot.id)).resolves.toEqual({
    err: { notAuthorized: null },
  });

  const frozen = await adminActor.freezeLot(lot.id);
  expect(frozen).toHaveProperty("ok");
  expect((frozen as { ok: { frozen: boolean; status: unknown } }).ok.frozen).toBe(
    true,
  );
  expect((frozen as { ok: { status: unknown } }).ok.status).toEqual({
    frozen: null,
  });

  // A frozen lot rejects further appends.
  await expect(
    officerActor.appendEvent(lot.id, {
      kind: { note: null },
      fileHashes: [],
      payload: "after freeze",
      fileIds: [],
    }),
  ).resolves.toEqual({ err: { lotFrozen: lot.id } });
});

it("lets a Quality Tester move Recently Mined and In Transit to Testing Quality", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));
  const assayer = createIdentity("assayer");
  const assayerActor = actorFor(assayer);

  await expect(
    adminActor.assignRole(assayer.getPrincipal(), { assayer: null }),
  ).resolves.toEqual({
    ok: { principal: assayer.getPrincipal(), role: { assayer: null } },
  });

  // Recently Mined → Testing Quality is the Quality Tester's own transition.
  const fromOpen = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-91001" }),
  );
  const openLotId = (fromOpen as { ok: { id: string } }).ok.id;
  const assayed = await assayerActor.changeStatus(openLotId, {
    to: { assayed: null },
    payload: "Assay complete",
  });
  expect(assayed).toHaveProperty("ok");
  expect((assayed as { ok: { status: unknown } }).ok.status).toEqual({
    assayed: null,
  });

  // The change is a new provenance event, and the history records it.
  const history = await assayerActor.statusHistory(openLotId);
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({
    from: { open: null },
    to: { assayed: null },
  });

  // In Transit → Testing Quality is the other permitted move.
  const fromTransit = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-91002" }),
  );
  const transitLotId = (fromTransit as { ok: { id: string } }).ok.id;
  // The admin moves it to In Transit first, since no role may move into it.
  await expect(
    adminActor.changeStatus(transitLotId, {
      to: { in_transit: null },
      payload: "Dispatched",
    }),
  ).resolves.toHaveProperty("ok");
  await expect(
    assayerActor.changeStatus(transitLotId, {
      to: { assayed: null },
      payload: "Assay complete",
    }),
  ).resolves.toHaveProperty("ok");
});

it("rejects a Quality Tester's transition the register does not permit", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));
  const assayerActor = actorFor(createIdentity("assayer"));

  const created = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-91003" }),
  );
  const lotId = (created as { ok: { id: string } }).ok.id;

  // A Quality Tester may not move Recently Mined straight to Applied for
  // crafting, nor to In Transit; the backend rejects both.
  await expect(
    assayerActor.changeStatus(lotId, {
      to: { closed: null },
      payload: "skip assay",
    }),
  ).resolves.toEqual({ err: { notAuthorized: null } });
  await expect(
    assayerActor.changeStatus(lotId, {
      to: { in_transit: null },
      payload: "skip assay",
    }),
  ).resolves.toEqual({ err: { notAuthorized: null } });

  // The rejected attempts left the lot and its history untouched.
  const lot = await adminActor.getLot(lotId);
  expect((lot as { ok: { status: unknown } }[])[0]).toMatchObject({
    status: { open: null },
  });
  expect(await adminActor.statusHistory(lotId)).toEqual([]);
});

it("lets a Custom Role move Testing Quality to Applied for crafting, Retailed or Confiscated", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));
  const workshop = createIdentity("workshop");
  const workshopActor = actorFor(workshop);

  await expect(
    adminActor.assignRole(workshop.getPrincipal(), { workshop: null }),
  ).resolves.toEqual({
    ok: { principal: workshop.getPrincipal(), role: { workshop: null } },
  });

  // Each target is exercised on its own lot, moved to Testing Quality by the
  // admin first so the Custom Role starts from the status it may act on.
  const targets = [
    { to: { closed: null } as const, sealNo: "TYV-92001" },
    { to: { retailed: null } as const, sealNo: "TYV-92002" },
    { to: { frozen: null } as const, sealNo: "TYV-92003" },
  ];

  for (const target of targets) {
    const created = await officerActor.registerLot(
      lotInput({ sealNo: target.sealNo }),
    );
    const lotId = (created as { ok: { id: string } }).ok.id;
    await expect(
      adminActor.changeStatus(lotId, {
        to: { assayed: null },
        payload: "Assay complete",
      }),
    ).resolves.toHaveProperty("ok");

    const moved = await workshopActor.changeStatus(lotId, {
      to: target.to,
      payload: "Workshop decision",
    });
    expect(moved).toHaveProperty("ok");
    expect((moved as { ok: { status: unknown } }).ok.status).toEqual(target.to);
  }
});

it("rejects a Custom Role's transition the register does not permit", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));
  const workshopActor = actorFor(createIdentity("workshop"));

  const created = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-92004" }),
  );
  const lotId = (created as { ok: { id: string } }).ok.id;
  await expect(
    adminActor.changeStatus(lotId, {
      to: { assayed: null },
      payload: "Assay complete",
    }),
  ).resolves.toHaveProperty("ok");

  // A Custom Role may not move Testing Quality back to Recently Mined or on to
  // In Transit; only the three downstream statuses are permitted.
  await expect(
    workshopActor.changeStatus(lotId, {
      to: { open: null },
      payload: "reopen",
    }),
  ).resolves.toEqual({ err: { notAuthorized: null } });
  await expect(
    workshopActor.changeStatus(lotId, {
      to: { in_transit: null },
      payload: "dispatch",
    }),
  ).resolves.toEqual({ err: { notAuthorized: null } });

  // The lot is still in Testing Quality with only the admin's change recorded.
  const lot = await adminActor.getLot(lotId);
  expect((lot as { ok: { status: unknown } }[])[0]).toMatchObject({
    status: { assayed: null },
  });
  expect(await adminActor.statusHistory(lotId)).toHaveLength(1);
});

it("deletes exactly one block as admin and leaves the rest of the register intact", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));

  // Two fresh blocks, so the deletion has a sibling to leave untouched.
  const first = await officerActor.registerLot(lotInput({ sealNo: "TYV-94001" }));
  const firstId = (first as { ok: { id: string } }).ok.id;
  const second = await officerActor.registerLot(lotInput({ sealNo: "TYV-94002" }));
  const secondId = (second as { ok: { id: string } }).ok.id;

  const before = await adminActor.listLots();
  const beforeIds = (before as { id: string }[]).map((lot) => lot.id);
  expect(beforeIds).toContain(firstId);
  expect(beforeIds).toContain(secondId);

  // The admin holds `delete_lot` by default and removes exactly one block.
  await expect(adminActor.deleteLot(firstId)).resolves.toEqual({
    ok: firstId,
  });

  // The deleted block is gone...
  expect(await adminActor.getLot(firstId)).toEqual([]);
  const after = await adminActor.listLots();
  const afterIds = (after as { id: string }[]).map((lot) => lot.id);
  expect(afterIds).not.toContain(firstId);
  // ...and the sibling block is still listed and readable.
  expect(afterIds).toContain(secondId);
  expect(await adminActor.getLot(secondId)).toHaveLength(1);

  // Deleting an unknown block is refused rather than trapping.
  await expect(adminActor.deleteLot("JOA-MFB-20260918-9999")).resolves.toEqual({
    err: { unknownLot: "JOA-MFB-20260918-9999" },
  });
});

it("refuses block deletion for a caller without the delete_lot capability", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));
  const guest = pic!.createActor<_SERVICE>(idlFactory, canisterId);

  const created = await officerActor.registerLot(lotInput({ sealNo: "TYV-94003" }));
  const lotId = (created as { ok: { id: string } }).ok.id;

  // An anonymous caller is refused before authorization is even considered.
  await expect(guest.deleteLot(lotId)).resolves.toEqual({
    err: { notAuthenticated: null },
  });

  // A signed-in field officer does not hold `delete_lot`, so the register
  // refuses with `notAuthorized` and the block survives.
  await expect(officerActor.deleteLot(lotId)).resolves.toEqual({
    err: { notAuthorized: null },
  });
  expect(await adminActor.getLot(lotId)).toHaveLength(1);
});

it("lets an admin perform any status transition", async () => {
  const adminActor = actorFor(createIdentity("alice"));
  const officerActor = actorFor(createIdentity("officer"));

  const created = await officerActor.registerLot(
    lotInput({ sealNo: "TYV-93001" }),
  );
  const lotId = (created as { ok: { id: string } }).ok.id;

  // An admin may move Recently Mined straight to Applied for crafting, which
  // neither the Quality Tester nor the Custom Role may do.
  const moved = await adminActor.changeStatus(lotId, {
    to: { closed: null },
    payload: "Admin override",
  });
  expect(moved).toHaveProperty("ok");
  expect((moved as { ok: { status: unknown } }).ok.status).toEqual({
    closed: null,
  });

  // And back out again, which no other role may do from Applied for crafting.
  await expect(
    adminActor.changeStatus(lotId, {
      to: { retailed: null },
      payload: "Admin override",
    }),
  ).resolves.toHaveProperty("ok");
  expect(await adminActor.statusHistory(lotId)).toHaveLength(2);
});
