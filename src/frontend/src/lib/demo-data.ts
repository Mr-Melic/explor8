import { EventKind, LotStatus, LotType, Site } from "@/lib/backend";
import type {
  AnalyticsBucket,
  AnalyticsPoint,
  EventView,
  HashChainEntry,
  LotView,
  RegisterAnalytics,
  RegisterSummary,
} from "@/lib/backend";
import type { Principal } from "@icp-sdk/core/principal";

/**
 * A large, randomly generated register that lives only in the browser.
 *
 * Demo data exists so a reader can see the register's shape before any real
 * lot is sealed. It is generated fresh on every switch into demo mode, is
 * never written to storage, and never reaches the canister — the live register
 * stays untouched.
 */

const SITES: Site[] = [Site.MFB, Site.LUS, Site.KFB];
/**
 * The two lot kinds the register offers: Emerald and Gold.
 *
 * Gold is a single kind that replaces the four retired gold-related kinds
 * (sample bag, concentrate, doré bar, jewel). Demo data must never surface a
 * retired kind, so this list is the whole catalogue.
 */
const LOT_TYPES: LotType[] = [LotType.emerald, LotType.gold];
const STATUSES: LotStatus[] = [
  LotStatus.open,
  LotStatus.in_transit,
  LotStatus.assayed,
  LotStatus.retailed,
  LotStatus.closed,
  LotStatus.frozen,
];
const EVENT_KINDS: EventKind[] = [
  EventKind.extracted,
  EventKind.photo,
  EventKind.weighed,
  EventKind.sealed,
  EventKind.moved,
  EventKind.assay,
  EventKind.cut,
  EventKind.retail,
  EventKind.note,
];

const PROJECTS: Record<Site, string[]> = {
  [Site.MFB]: ["Mufumbwe / Kikonge", "Kikonge East", "Mufumbwe North"],
  [Site.LUS]: ["Lusaka workshop", "Bench B", "Flagship Lusaka"],
  [Site.KFB]: ["Kafubu emeralds", "Kagem block C", "Kafubu south"],
};

const WORKING_REFS = [
  "Trench T-12",
  "Pit 4 north face",
  "Bench B",
  "Hole H-07",
  "Adit A-2",
  "Wash plant 1",
];

const PAYLOADS: Record<EventKind, string[]> = {
  [EventKind.extracted]: ["Extracted at the working face"],
  [EventKind.photo]: [
    "Working face",
    "Material",
    "Sealed bag with tag visible",
  ],
  [EventKind.weighed]: ["Weighed on the register scale"],
  [EventKind.sealed]: ["Sealed with a tamper-evident tag"],
  [EventKind.moved]: ["Moved to the Lusaka vault", "Moved to the assay lab"],
  [EventKind.assay]: ["Independent fire-assay, certificate on file"],
  [EventKind.split]: ["Split into a child lot at the bench"],
  [EventKind.merge]: ["Merged into the destination lot"],
  [EventKind.cut]: ["Cut and polished at the bench"],
  [EventKind.retail]: ["Retailed at the flagship store"],
  [EventKind.correction]: ["Correction appended against an earlier event"],
  [EventKind.status_change]: ["Status changed by the register"],
  [EventKind.note]: ["Note appended by the field officer"],
};

const LICENCE = "44287-HQ-LEL";

/** A deterministic-looking but random hex digest, 64 lowercase characters. */
function randomHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

/** A stand-in principal. Demo data never carries a real identity. */
function demoPrincipal(): Principal {
  const hex = randomHash().slice(0, 12);
  return { toString: () => `${hex}-demo` } as unknown as Principal;
}

function isoDay(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function openedAt(offsetDays: number): bigint {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return BigInt(date.getTime()) * 1_000_000n;
}

function buildEvents(
  _lotId: string,
  site: Site,
  lotType: LotType,
  opened: bigint,
): EventView[] {
  const count = randomInt(2, 6);
  const events: EventView[] = [];
  const by = demoPrincipal();

  for (let index = 0; index < count; index += 1) {
    const kind = index === 0 ? EventKind.extracted : pick(EVENT_KINDS);
    const payload =
      index === 0 ? `Extracted at ${pick(WORKING_REFS)}` : pick(PAYLOADS[kind]);
    events.push({
      seq: BigInt(index + 1),
      kind,
      at: opened + BigInt(index + 1) * 3_600_000_000_000n,
      by,
      payload,
      payloadHash: randomHash(),
      fileIds: [],
    });
  }

  // A lot's first event is always its extraction, whatever the site.
  events[0] = {
    ...events[0],
    kind: EventKind.extracted,
    payload: `Extracted at ${pick(WORKING_REFS)}`,
  };

  if (lotType === LotType.emerald && site === Site.KFB) {
    events.push({
      seq: BigInt(events.length + 1),
      kind: EventKind.cut,
      at: opened + BigInt(events.length + 1) * 3_600_000_000_000n,
      by,
      payload: "Cut and polished at the bench",
      payloadHash: randomHash(),
      fileIds: [],
    });
  }

  return events;
}

function buildChain(
  events: EventView[],
  contentHash: string,
): HashChainEntry[] {
  return events.map((event) => ({
    eventSeq: event.seq,
    contentHash,
    at: event.at,
  }));
}

/** Generate a fresh register of demo lots. Never persisted, never uploaded. */
export function generateDemoLots(count = 48): LotView[] {
  const lots: LotView[] = [];

  for (let index = 0; index < count; index += 1) {
    const site = pick(SITES);
    const lotType = pick(LOT_TYPES);
    const offsetDays = randomInt(0, 45);
    const day = isoDay(offsetDays);
    const opened = openedAt(offsetDays);
    const id = `JOA-${site}-${day}-${String(index + 1).padStart(4, "0")}`;
    const contentHash = randomHash();
    const events = buildEvents(id, site, lotType, opened);
    const status = pick(STATUSES);
    const openedBy = demoPrincipal();

    lots.push({
      id,
      lotType,
      licence: LICENCE,
      project: pick(PROJECTS[site]),
      gps: `${(-13 - Math.random() * 3).toFixed(4)}, ${(25 + Math.random() * 4).toFixed(4)}`,
      workingRef: pick(WORKING_REFS),
      grossG: (Math.random() * 480 + 0.5).toFixed(2),
      sealNo: `TYV-${randomInt(10000, 99999)}`,
      status,
      statusHistory: [
        {
          seq: 1n,
          from: LotStatus.open,
          to: status,
          at: opened,
          by: openedBy,
        },
      ],
      parentIds: [],
      photoFileIds: [],
      fileIds: [],
      fileHashes: [],
      contentHash,
      hashChain: buildChain(events, contentHash),
      events,
      frozen: status === LotStatus.frozen,
      openedAt: opened,
      openedBy,
    });
  }

  return lots.sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
}

/** The summary the stats strip and graph read, derived from the demo lots. */
export function summarizeDemoLots(lots: LotView[]): RegisterSummary {
  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const bySite = new Map<string, number>();
  const activity = new Map<string, number>();
  let totalEvents = 0;

  for (const lot of lots) {
    byType.set(lot.lotType, (byType.get(lot.lotType) ?? 0) + 1);
    byStatus.set(lot.status, (byStatus.get(lot.status) ?? 0) + 1);
    const site = lot.id.slice(4, 7);
    bySite.set(site, (bySite.get(site) ?? 0) + 1);
    totalEvents += lot.events.length;

    for (const event of lot.events) {
      const day = new Date(Number(event.at / 1_000_000n))
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      activity.set(day, (activity.get(day) ?? 0) + 1);
    }
  }

  const toBuckets = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count: BigInt(count) }))
      .sort((a, b) => (a.count < b.count ? 1 : a.count > b.count ? -1 : 0));

  return {
    totalLots: BigInt(lots.length),
    totalEvents: BigInt(totalEvents),
    byType: toBuckets(byType),
    byStatus: toBuckets(byStatus),
    bySite: toBuckets(bySite),
    activity: Array.from(activity.entries())
      .map(([day, count]) => ({ day, count: BigInt(count) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

/**
 * The admin panel's analytics, derived from the demo lots.
 *
 * The admin panel reads `registerAnalytics` from the canister in Real-time
 * mode; in Demo-data mode there is no canister read to make, so the same
 * figures are computed here from the browser-held dataset. The shape matches
 * `RegisterAnalytics` exactly, so the panel renders either source unchanged.
 */
export function summarizeDemoAnalytics(lots: LotView[]): RegisterAnalytics {
  const byKind = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const bySite = new Map<string, number>();
  const lotsByDay = new Map<string, number>();
  const eventsByDay = new Map<string, number>();
  let totalEvents = 0;

  for (const lot of lots) {
    byKind.set(lot.lotType, (byKind.get(lot.lotType) ?? 0) + 1);
    byStatus.set(lot.status, (byStatus.get(lot.status) ?? 0) + 1);
    const site = lot.id.slice(4, 7);
    bySite.set(site, (bySite.get(site) ?? 0) + 1);

    const openedDay = new Date(Number(lot.openedAt / 1_000_000n))
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    lotsByDay.set(openedDay, (lotsByDay.get(openedDay) ?? 0) + 1);

    totalEvents += lot.events.length;
    for (const event of lot.events) {
      const day = new Date(Number(event.at / 1_000_000n))
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      eventsByDay.set(day, (eventsByDay.get(day) ?? 0) + 1);
    }
  }

  const toBuckets = (map: Map<string, number>): AnalyticsBucket[] =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count: BigInt(count) }))
      .sort((a, b) => (a.count < b.count ? 1 : a.count > b.count ? -1 : 0));

  const days = Array.from(
    new Set([...lotsByDay.keys(), ...eventsByDay.keys()]),
  ).sort((a, b) => a.localeCompare(b));

  const points: AnalyticsPoint[] = days.map((day) => ({
    day,
    lots: BigInt(lotsByDay.get(day) ?? 0),
    events: BigInt(eventsByDay.get(day) ?? 0),
  }));

  return {
    totalLots: BigInt(lots.length),
    totalEvents: BigInt(totalEvents),
    byKind: toBuckets(byKind),
    byStatus: toBuckets(byStatus),
    bySite: toBuckets(bySite),
    lotsOverTime: points,
    eventsOverTime: points,
  };
}
