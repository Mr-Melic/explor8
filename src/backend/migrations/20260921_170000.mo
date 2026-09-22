/// Initial stable state for the JOA Gold Book provenance register.
///
/// This is the single pending migration for this build: it folds the earlier
/// initial-state file into one entry so the chain holds exactly one pending
/// migration. `OldActor` is the empty baseline actor `{}`; `NewActor` matches
/// the stable fields declared in main.mo exactly, with each piece of state
/// having exactly one home.
///
/// The three brief seed lots are written here, so they exist before any call
/// and are readable by a logged-out guest through the public `listLots` query.
/// They are hashed through the same canonical-JSON + SHA-256 path the register
/// uses at runtime, so the frontend can recompute every hash.
///
/// Self-contained: only mo:core and mops package imports are allowed here.
import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Sha256 "mo:sha2/Sha256";
import Table "mo:caffeineai-oql/Table";
import OqlTypes "mo:caffeineai-oql/Types";

module {
  type Timestamp = Int;
  type HashHex = Text;
  type LotId = Text;
  type FileId = Text;

  type LotType = { #sample_bag; #concentrate; #dore; #jewel; #emerald };

  type LotStatus = { #open; #in_transit; #assayed; #retailed; #closed; #frozen };

  type EventKind = {
    #extracted;
    #photo;
    #weighed;
    #sealed;
    #moved;
    #assay;
    #split;
    #merge;
    #cut;
    #retail;
    #correction;
    #note;
  };

  type Role = { #guest; #field_officer; #assayer; #workshop; #admin };

  type FileHash = { fileId : FileId; contentHash : HashHex };

  type HashChainEntry = { at : Timestamp; eventSeq : Nat; contentHash : HashHex };

  type Event = {
    seq : Nat;
    kind : EventKind;
    at : Timestamp;
    by : Principal;
    payload : Text;
    fileIds : [FileId];
    payloadHash : HashHex;
  };

  type Lot = {
    id : LotId;
    lotType : LotType;
    licence : Text;
    project : Text;
    gps : Text;
    workingRef : Text;
    openedAt : Timestamp;
    openedBy : Principal;
    grossG : Text;
    sealNo : Text;
    status : LotStatus;
    parentIds : [LotId];
    photoFileIds : [FileId];
    fileIds : [FileId];
    contentHash : HashHex;
    hashChain : [HashChainEntry];
    events : [Event];
    frozen : Bool;
  };

  type OldActor = {};

  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    registerState : {
      var nextSeq : Nat;
      lots : Map.Map<LotId, Lot>;
      fileHashes : Map.Map<LotId, [FileHash]>;
      lotIndex : Table.Table;
    };
    rolesState : {
      var firstAdminClaimed : Bool;
      roles : Map.Map<Principal, Role>;
    };
  };

  // ── Canonical hashing (mirrors lib/hashing.mo) ────────────────────────────

  func hexDigit(n : Nat) : Text {
    switch n {
      case 0 "0";
      case 1 "1";
      case 2 "2";
      case 3 "3";
      case 4 "4";
      case 5 "5";
      case 6 "6";
      case 7 "7";
      case 8 "8";
      case 9 "9";
      case 10 "a";
      case 11 "b";
      case 12 "c";
      case 13 "d";
      case 14 "e";
      case _ "f";
    };
  };

  func sha256Hex(input : Text) : HashHex {
    let digest = Sha256.fromBlob(input.encodeUtf8());
    var out = "";
    for (byte in digest.values()) {
      let n = byte.toNat();
      out := out # hexDigit(n / 16) # hexDigit(n % 16);
    };
    out;
  };

  func jsonString(value : Text) : Text {
    var out = "\"";
    for (c in value.chars()) {
      switch c {
        case '\u{22}' { out := out # "\\\"" };
        case '\u{5C}' { out := out # "\\\\" };
        case '\n' { out := out # "\\n" };
        case '\r' { out := out # "\\r" };
        case '\t' { out := out # "\\t" };
        case _ { out := out # c.toText() };
      };
    };
    out # "\"";
  };

  func jsonStringArray(items : [Text]) : Text {
    "[" # items.map(func item = jsonString(item)).values().join(",") # "]";
  };

  func lotTypeTag(lotType : LotType) : Text {
    switch lotType {
      case (#sample_bag) "sample_bag";
      case (#concentrate) "concentrate";
      case (#dore) "dore";
      case (#jewel) "jewel";
      case (#emerald) "emerald";
    };
  };

  func eventKindTag(kind : EventKind) : Text {
    switch kind {
      case (#extracted) "extracted";
      case (#photo) "photo";
      case (#weighed) "weighed";
      case (#sealed) "sealed";
      case (#moved) "moved";
      case (#assay) "assay";
      case (#split) "split";
      case (#merge) "merge";
      case (#cut) "cut";
      case (#retail) "retail";
      case (#correction) "correction";
      case (#note) "note";
    };
  };

  func statusTag(status : LotStatus) : Text {
    switch status {
      case (#open) "open";
      case (#in_transit) "in_transit";
      case (#assayed) "assayed";
      case (#retailed) "retailed";
      case (#closed) "closed";
      case (#frozen) "frozen";
    };
  };

  /// contentHash = SHA-256 of the canonical lot snapshot JSON. The snapshot's
  /// fileContentHashes list carries every event's payloadHash (the seed lots
  /// have no files), mirroring lib/hashing.mo's collectFileContentHashes.
  func computeContentHash(lot : Lot) : HashHex {
    let payloadHashes = lot.events.map(func (event : Event) : HashHex = event.payloadHash);
    sha256Hex(
      "{" #
      "\"fileContentHashes\":" # jsonStringArray(payloadHashes.sort()) # "," #
      "\"gps\":" # jsonString(lot.gps) # "," #
      "\"grossG\":" # jsonString(lot.grossG) # "," #
      "\"id\":" # jsonString(lot.id) # "," #
      "\"licence\":" # jsonString(lot.licence) # "," #
      "\"parentIds\":" # jsonStringArray(lot.parentIds) # "," #
      "\"project\":" # jsonString(lot.project) # "," #
      "\"sealNo\":" # jsonString(lot.sealNo) # "," #
      "\"type\":" # jsonString(lotTypeTag(lot.lotType)) # "," #
      "\"workingRef\":" # jsonString(lot.workingRef) #
      "}"
    );
  };

  /// payloadHash = SHA-256 of the canonical event payload JSON.
  func computePayloadHash(kind : EventKind, payload : Text) : HashHex {
    sha256Hex(
      "{" #
      "\"fileContentHashes\":" # jsonStringArray([]) # "," #
      "\"kind\":" # jsonString(eventKindTag(kind)) # "," #
      "\"payload\":" # jsonString(payload) #
      "}"
    );
  };

  // ── Seed lots ─────────────────────────────────────────────────────────────

  /// Write one seed lot with its events, hashing through the production path.
  func seedLot(
    lots : Map.Map<LotId, Lot>,
    fileHashes : Map.Map<LotId, [FileHash]>,
    operator : Principal,
    openedAt : Timestamp,
    spec : {
      id : LotId;
      lotType : LotType;
      licence : Text;
      project : Text;
      gps : Text;
      workingRef : Text;
      grossG : Text;
      sealNo : Text;
      status : LotStatus;
      parentIds : [LotId];
      events : [(EventKind, Text, Timestamp)];
    },
  ) : () {
    var events : [Event] = [];
    var seq = 0;
    for ((kind, payload, at) in spec.events.values()) {
      seq += 1;
      events := events.concat([
        {
          seq;
          kind;
          at;
          by = operator;
          payload;
          fileIds = [];
          payloadHash = computePayloadHash(kind, payload);
        }
      ]);
    };
    let base : Lot = {
      id = spec.id;
      lotType = spec.lotType;
      licence = spec.licence;
      project = spec.project;
      gps = spec.gps;
      workingRef = spec.workingRef;
      openedAt;
      openedBy = operator;
      grossG = spec.grossG;
      sealNo = spec.sealNo;
      status = spec.status;
      parentIds = spec.parentIds;
      photoFileIds = [];
      fileIds = [];
      contentHash = "";
      hashChain = [];
      events;
      frozen = false;
    };
    let contentHash = computeContentHash(base);
    let lot : Lot = {
      base with
      contentHash;
      hashChain = [{ at = openedAt; eventSeq = seq; contentHash }];
    };
    lots.add(spec.id, lot);
    fileHashes.add(spec.id, []);
  };

  /// The three brief lots, written once on first deploy.
  func seed(
    lots : Map.Map<LotId, Lot>,
    fileHashes : Map.Map<LotId, [FileHash]>,
  ) : () {
    let at : Timestamp = 1_758_153_600_000_000_000;
    let operator = Principal.fromText("aaaaa-aa");
    seedLot(
      lots,
      fileHashes,
      operator,
      at,
      {
        id = "JOA-MFB-20260918-0047";
        lotType = #sample_bag;
        licence = "44287-HQ-LEL";
        project = "Mufumbwe / Kikonge";
        gps = "-13.4800, 25.7000";
        workingRef = "Trench T-12";
        grossG = "184.2";
        sealNo = "TYV-88341";
        status = #assayed;
        parentIds = [];
        events = [
          (#extracted, "Extracted at Trench T-12", at),
          (#weighed, "Weighed 184.2 g", at + 3_600_000_000_000),
          (#sealed, "Sealed TYV-88341", at + 7_200_000_000_000),
          (#assay, "Independent fire-assay Au 4.1 g/t cert AF-9921", at + 86_400_000_000_000),
        ];
      },
    );
    seedLot(
      lots,
      fileHashes,
      operator,
      at + 86_400_000_000_000,
      {
        id = "JOA-MFB-20260918-0048";
        lotType = #concentrate;
        licence = "44287-HQ-LEL";
        project = "Mufumbwe / Kikonge";
        gps = "-13.4800, 25.7000";
        workingRef = "Trench T-12";
        grossG = "22.0";
        sealNo = "TYV-88355";
        status = #open;
        parentIds = ["JOA-MFB-20260918-0047"];
        events = [
          (#split, "Split from JOA-MFB-20260918-0047", at + 86_400_000_000_000),
        ];
      },
    );
    seedLot(
      lots,
      fileHashes,
      operator,
      at + 172_800_000_000_000,
      {
        id = "JOA-LUS-20260912-0003";
        lotType = #emerald;
        licence = "44287-HQ-LEL";
        project = "Lusaka workshop";
        gps = "-15.4167, 28.2833";
        workingRef = "Bench B";
        grossG = "3.14";
        sealNo = "JW-4401";
        status = #retailed;
        parentIds = [];
        events = [
          (#cut, "Cut and polished at Bench B", at + 172_800_000_000_000),
          (#retail, "Retailed at flagship Lusaka", at + 259_200_000_000_000),
        ];
      },
    );
  };

  // ── OQL lot index row ─────────────────────────────────────────────────────

  /// The row projection appended to the OQL lot index.
  func lotRow(lot : Lot) : [(Text, OqlTypes.Value)] {
    [
      ("lotType", #text (lotTypeTag(lot.lotType))),
      ("licence", #text (lot.licence)),
      ("project", #text (lot.project)),
      ("gps", #text (lot.gps)),
      ("workingRef", #text (lot.workingRef)),
      ("openedAt", #int (lot.openedAt)),
      ("openedBy", #text (lot.openedBy.toText())),
      ("grossG", #text (lot.grossG)),
      ("sealNo", #text (lot.sealNo)),
      ("status", #text (statusTag(lot.status))),
      ("parentIds", #text (lot.parentIds.values().join(","))),
      ("contentHash", #text (lot.contentHash)),
      ("frozen", #bool (lot.frozen)),
      ("eventCount", #nat (lot.events.size())),
    ];
  };

  public func migration(_old : OldActor) : NewActor {
    let lots = Map.empty<LotId, Lot>();
    let fileHashes = Map.empty<LotId, [FileHash]>();
    // The lot index carries no stored `id` column: the entity's primary key is
    // `id`, and `Table.entityWith` traps when the primary key collides with a
    // stored column.
    let lotIndex = Table.new(
      [
        ("lotType", #text),
        ("licence", #text),
        ("project", #text),
        ("gps", #text),
        ("workingRef", #text),
        ("openedAt", #int),
        ("openedBy", #text),
        ("grossG", #text),
        ("sealNo", #text),
        ("status", #text),
        ("parentIds", #text),
        ("contentHash", #text),
        ("frozen", #bool),
        ("eventCount", #nat),
      ],
      [("lotType", #hash), ("status", #hash), ("sealNo", #hash)],
    );
    seed(lots, fileHashes);
    for (lot in lots.values()) {
      ignore lotIndex.append(lot, lotRow);
    };
    {
      accessControlState = AccessControl.initState();
      registerState = {
        var nextSeq = 0;
        lots;
        fileHashes;
        lotIndex;
      };
      rolesState = {
        var firstAdminClaimed = false;
        roles = Map.empty();
      };
    };
  };
};
