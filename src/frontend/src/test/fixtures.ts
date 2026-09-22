import type {
  EventView,
  HashChainEntry,
  LotView,
  RefEntryView,
  RegisterSummary,
  StatusChange,
} from "@/lib/backend";
import { EventKind, LotStatus, LotType, RefKind } from "@/lib/backend";
import type { Principal } from "@icp-sdk/core/principal";

/**
 * A stand-in principal. The register only ever calls `.toString()` on it in the
 * UI, so a minimal object with that method is enough and keeps the fixtures
 * free of any real identity.
 */
export function fakePrincipal(text = "aaaaa-aa"): Principal {
  return { toString: () => text } as unknown as Principal;
}

export const SEED_HASH_47 =
  "3f9a1c2b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8";
export const SEED_HASH_48 =
  "7c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abc";
export const SEED_HASH_03 =
  "b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3";

const OPENED_AT = 1_758_153_600_000_000_000n;

function event(
  seq: number,
  kind: EventKind,
  payload: string,
  payloadHash: string,
  supersededBy?: bigint,
): EventView {
  return {
    seq: BigInt(seq),
    kind,
    at: OPENED_AT + BigInt(seq) * 3_600_000_000_000n,
    by: fakePrincipal(),
    payload,
    payloadHash,
    fileIds: [],
    ...(supersededBy === undefined ? {} : { supersededBy }),
  };
}

function chain(entries: [number, string][]): HashChainEntry[] {
  return entries.map(([seq, contentHash]) => ({
    eventSeq: BigInt(seq),
    contentHash,
    at: OPENED_AT + BigInt(seq) * 3_600_000_000_000n,
  }));
}

/**
 * One recorded status transition, as the register stores it.
 *
 * Every status change is a provenance event, so a seed lot's `statusHistory`
 * carries the same sequence numbers as the events that produced it.
 */
function statusChange(
  seq: number,
  from: LotStatus,
  to: LotStatus,
): StatusChange {
  return {
    seq: BigInt(seq),
    from,
    to,
    at: OPENED_AT + BigInt(seq) * 3_600_000_000_000n,
    by: fakePrincipal(),
  };
}

/** The three seed lots the migration writes, as the frontend sees them. */
export function seedLots(): LotView[] {
  return [
    {
      id: "JOA-MFB-20260918-0047",
      lotType: LotType.gold,
      licence: "44287-HQ-LEL",
      project: "Mufumbwe / Kikonge",
      gps: "-13.4800, 25.7000",
      workingRef: "Trench T-12",
      grossG: "184.2",
      sealNo: "TYV-88341",
      status: LotStatus.assayed,
      parentIds: [],
      photoFileIds: [],
      fileIds: [],
      fileHashes: [],
      contentHash: SEED_HASH_47,
      statusHistory: [statusChange(4, LotStatus.open, LotStatus.assayed)],
      hashChain: chain([
        [1, SEED_HASH_47],
        [4, SEED_HASH_47],
      ]),
      events: [
        event(1, EventKind.extracted, "Extracted at Trench T-12", SEED_HASH_47),
        event(2, EventKind.weighed, "Weighed 184.2 g", SEED_HASH_47),
        event(3, EventKind.sealed, "Sealed TYV-88341", SEED_HASH_47),
        event(
          4,
          EventKind.assay,
          "Independent fire-assay Au 4.1 g/t cert AF-9921",
          SEED_HASH_47,
        ),
      ],
      frozen: false,
      openedAt: OPENED_AT,
      openedBy: fakePrincipal(),
    },
    {
      id: "JOA-MFB-20260918-0048",
      lotType: LotType.gold,
      licence: "44287-HQ-LEL",
      project: "Mufumbwe / Kikonge",
      gps: "-13.4800, 25.7000",
      workingRef: "Trench T-12",
      grossG: "22.0",
      sealNo: "TYV-88355",
      status: LotStatus.open,
      parentIds: ["JOA-MFB-20260918-0047"],
      photoFileIds: [],
      fileIds: [],
      fileHashes: [],
      contentHash: SEED_HASH_48,
      statusHistory: [],
      hashChain: chain([[1, SEED_HASH_48]]),
      events: [
        event(
          1,
          EventKind.split,
          "Split from JOA-MFB-20260918-0047",
          SEED_HASH_48,
        ),
      ],
      frozen: false,
      openedAt: OPENED_AT + 86_400_000_000_000n,
      openedBy: fakePrincipal(),
    },
    {
      id: "JOA-LUS-20260912-0003",
      lotType: LotType.emerald,
      licence: "44287-HQ-LEL",
      project: "Lusaka workshop",
      gps: "-15.4167, 28.2833",
      workingRef: "Bench B",
      grossG: "3.14",
      sealNo: "JW-4401",
      status: LotStatus.retailed,
      parentIds: [],
      photoFileIds: [],
      fileIds: [],
      fileHashes: [],
      contentHash: SEED_HASH_03,
      statusHistory: [statusChange(2, LotStatus.closed, LotStatus.retailed)],
      hashChain: chain([
        [1, SEED_HASH_03],
        [2, SEED_HASH_03],
      ]),
      events: [
        event(1, EventKind.cut, "Cut and polished at Bench B", SEED_HASH_03),
        event(2, EventKind.retail, "Retailed at flagship Lusaka", SEED_HASH_03),
      ],
      frozen: false,
      openedAt: OPENED_AT + 172_800_000_000_000n,
      openedBy: fakePrincipal(),
    },
  ];
}

/**
 * The reference catalogue the migration seeds, as the frontend reads it.
 *
 * Lot kinds are exactly Emerald and Gold; the sites, statuses, event kinds,
 * labels and form defaults mirror `migrations/20260921_180000.mo`. Tests that
 * exercise the register form or the admin panel read these through the mocked
 * `listReferenceEntries` / `listAllReferenceEntries`.
 */
export function seedReferenceEntries(): RefEntryView[] {
  const entry = (
    id: string,
    kind: RefKind,
    key: string,
    displayName: string,
    value: string,
    sortOrder: number,
  ): RefEntryView => ({
    id,
    kind,
    key,
    displayName,
    value,
    sortOrder: BigInt(sortOrder),
    active: true,
  });

  return [
    entry("ref-1", RefKind.lot_kind, "emerald", "Emerald", "emerald", 1),
    entry("ref-2", RefKind.lot_kind, "gold", "Gold", "gold", 2),
    entry("ref-3", RefKind.site, "MFB", "Mufumbwe", "MFB", 1),
    entry("ref-4", RefKind.site, "LUS", "Lusaka", "LUS", 2),
    entry("ref-5", RefKind.site, "KFB", "Kafubu", "KFB", 3),
    // The display terms are the post-migration ones: 20260921_190000.mo
    // renames open/assayed/closed/frozen by stable key and leaves the rest.
    entry("ref-6", RefKind.status, "open", "Recently Mined", "open", 1),
    entry("ref-7", RefKind.status, "in_transit", "In transit", "in_transit", 2),
    entry("ref-8", RefKind.status, "assayed", "Testing Quality", "assayed", 3),
    entry("ref-9", RefKind.status, "retailed", "Retailed", "retailed", 4),
    entry(
      "ref-10",
      RefKind.status,
      "closed",
      "Applied for crafting",
      "closed",
      5,
    ),
    entry(
      "ref-11",
      RefKind.status,
      "frozen",
      "Confiscated by Authorities",
      "frozen",
      6,
    ),
    entry(
      "ref-12",
      RefKind.event_kind,
      "extracted",
      "Extracted",
      "extracted",
      1,
    ),
    entry("ref-13", RefKind.event_kind, "note", "Note", "note", 12),
    entry("ref-14", RefKind.caption, "app_title", "Explor8", "Explor8", 1),
    entry(
      "ref-15",
      RefKind.caption,
      "app_subtitle",
      "A product of Jewel of Africa",
      "A product of Jewel of Africa",
      2,
    ),
    entry(
      "ref-16",
      RefKind.form_default,
      "licence",
      "Licence",
      "44287-HQ-LEL",
      1,
    ),
    entry(
      "ref-17",
      RefKind.form_default,
      "project",
      "Project",
      "Mufumbwe / Kikonge",
      2,
    ),
  ];
}

/** The seed catalogue grouped by kind, as `listReferenceEntries` returns it. */
export function seedReferenceByKind(): Partial<
  Record<RefKind, RefEntryView[]>
> {
  const grouped: Partial<Record<RefKind, RefEntryView[]>> = {};
  for (const entry of seedReferenceEntries()) {
    grouped[entry.kind] = [...(grouped[entry.kind] ?? []), entry];
  }
  return grouped;
}

/** A summary derived from the seed lots, as `registerSummary` would return. */
export function seedSummary(): RegisterSummary {
  return {
    totalLots: 3n,
    totalEvents: 7n,
    byType: [
      { key: LotType.gold, count: 2n },
      { key: LotType.emerald, count: 1n },
    ],
    byStatus: [
      { key: LotStatus.assayed, count: 1n },
      { key: LotStatus.open, count: 1n },
      { key: LotStatus.retailed, count: 1n },
    ],
    bySite: [
      { key: "MFB", count: 2n },
      { key: "LUS", count: 1n },
    ],
    activity: [
      { day: "20260918", count: 5n },
      { day: "20260919", count: 2n },
    ],
  };
}
