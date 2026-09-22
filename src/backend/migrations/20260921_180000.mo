/// Adds admin-managed reference data, analysis documents and their counters to
/// the stable state, and narrows the register's lot kinds to exactly Emerald
/// and Gold.
///
/// `OldActor` is the `NewActor` of the preceding migration in the chain
/// (20260921_170000.mo); `NewActor` matches the stable fields declared in
/// main.mo exactly.
///
/// The reference catalogue is seeded here so the register's forms and displays
/// have data before any call: lot kinds start with exactly Emerald and Gold,
/// plus the three sites, the lot statuses, the event kinds, the header labels
/// and the form defaults. An administrator can add, edit and remove every one
/// of these afterwards.
///
/// The previous `LotType` carried four gold-related kinds (`sample_bag`,
/// `concentrate`, `dore`, `jewel`) plus `emerald`. This migration replaces
/// them with a single `gold` kind, so every stored lot whose kind was one of
/// the retired gold kinds is remapped to `gold`. The lot's `contentHash` and
/// `hashChain` are left untouched: they are the sealed historical record and
/// the register is append-only, so a migration never rewrites them.
///
/// Self-contained: only mo:core and mops package imports are allowed here.
import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Table "mo:caffeineai-oql/Table";

module {
  type Timestamp = Int;
  type HashHex = Text;
  type LotId = Text;
  type FileId = Text;

  // ── Old types (as deployed by 20260921_170000.mo) ─────────────────────────

  type OldLotType = { #sample_bag; #concentrate; #dore; #jewel; #emerald };

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

  type OldLot = {
    id : LotId;
    lotType : OldLotType;
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

  // ── New types (as declared in main.mo and types/) ─────────────────────────

  type NewLotType = { #emerald; #gold };

  type NewLot = {
    id : LotId;
    lotType : NewLotType;
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

  // ── New reference-data types (inlined; no project imports) ────────────────

  type RefKind = { #lot_kind; #site; #status; #event_kind; #caption; #form_default };

  type RefEntry = {
    id : Text;
    kind : RefKind;
    key : Text;
    displayName : Text;
    value : Text;
    sortOrder : Nat;
    active : Bool;
  };

  type AnalysisDocument = {
    id : Text;
    title : Text;
    docKind : Text;
    fileId : FileId;
    contentHash : HashHex;
    uploadedAt : Timestamp;
    uploadedBy : Principal;
    note : Text;
  };

  type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    registerState : {
      var nextSeq : Nat;
      lots : Map.Map<LotId, OldLot>;
      fileHashes : Map.Map<LotId, [FileHash]>;
      lotIndex : Table.Table;
    };
    rolesState : {
      var firstAdminClaimed : Bool;
      roles : Map.Map<Principal, Role>;
    };
  };

  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    registerState : {
      var nextSeq : Nat;
      lots : Map.Map<LotId, NewLot>;
      fileHashes : Map.Map<LotId, [FileHash]>;
      lotIndex : Table.Table;
    };
    rolesState : {
      var firstAdminClaimed : Bool;
      roles : Map.Map<Principal, Role>;
    };
    referenceState : {
      var nextEntrySeq : Nat;
      var nextDocSeq : Nat;
      entries : Map.Map<Text, RefEntry>;
      documents : Map.Map<Text, AnalysisDocument>;
    };
  };

  // ── Lot-kind narrowing ────────────────────────────────────────────────────

  /// Map a retired lot kind onto the single Gold kind; Emerald is unchanged.
  func toNewLotType(lotType : OldLotType) : NewLotType {
    switch lotType {
      case (#emerald) #emerald;
      case (_) #gold;
    };
  };

  /// Rewrite one stored lot's kind, preserving every other field.
  func toNewLot(lot : OldLot) : NewLot {
    {
      id = lot.id;
      lotType = toNewLotType(lot.lotType);
      licence = lot.licence;
      project = lot.project;
      gps = lot.gps;
      workingRef = lot.workingRef;
      openedAt = lot.openedAt;
      openedBy = lot.openedBy;
      grossG = lot.grossG;
      sealNo = lot.sealNo;
      status = lot.status;
      parentIds = lot.parentIds;
      photoFileIds = lot.photoFileIds;
      fileIds = lot.fileIds;
      contentHash = lot.contentHash;
      hashChain = lot.hashChain;
      events = lot.events;
      frozen = lot.frozen;
    };
  };

  // ── Reference catalogue seed ──────────────────────────────────────────────

  /// Insert one reference entry, allocating its id from the running counter.
  func seedEntry(
    entries : Map.Map<Text, RefEntry>,
    counter : { var next : Nat },
    kind : RefKind,
    key : Text,
    displayName : Text,
    value : Text,
    sortOrder : Nat,
  ) : () {
    counter.next += 1;
    let id = "ref-" # counter.next.toText();
    entries.add(id, { id; kind; key; displayName; value; sortOrder; active = true });
  };

  /// The starting catalogue: exactly two lot kinds (Emerald and Gold), the
  /// three sites, the statuses, the event kinds, the header labels and the
  /// form defaults. Everything here is admin-editable afterwards.
  func seedReference(entries : Map.Map<Text, RefEntry>) : () {
    let counter = { var next = 0 };

    // Lot kinds — Emerald and Gold only.
    seedEntry(entries, counter, #lot_kind, "emerald", "Emerald", "emerald", 1);
    seedEntry(entries, counter, #lot_kind, "gold", "Gold", "gold", 2);

    // Site names.
    seedEntry(entries, counter, #site, "MFB", "Mufumbwe", "MFB", 1);
    seedEntry(entries, counter, #site, "LUS", "Lusaka", "LUS", 2);
    seedEntry(entries, counter, #site, "KFB", "Kafubu", "KFB", 3);

    // Lot statuses.
    seedEntry(entries, counter, #status, "open", "Open", "open", 1);
    seedEntry(entries, counter, #status, "in_transit", "In transit", "in_transit", 2);
    seedEntry(entries, counter, #status, "assayed", "Assayed", "assayed", 3);
    seedEntry(entries, counter, #status, "retailed", "Retailed", "retailed", 4);
    seedEntry(entries, counter, #status, "closed", "Closed", "closed", 5);
    seedEntry(entries, counter, #status, "frozen", "Frozen", "frozen", 6);

    // Event kinds.
    seedEntry(entries, counter, #event_kind, "extracted", "Extracted", "extracted", 1);
    seedEntry(entries, counter, #event_kind, "photo", "Photo", "photo", 2);
    seedEntry(entries, counter, #event_kind, "weighed", "Weighed", "weighed", 3);
    seedEntry(entries, counter, #event_kind, "sealed", "Sealed", "sealed", 4);
    seedEntry(entries, counter, #event_kind, "moved", "Moved", "moved", 5);
    seedEntry(entries, counter, #event_kind, "assay", "Assay", "assay", 6);
    seedEntry(entries, counter, #event_kind, "split", "Split", "split", 7);
    seedEntry(entries, counter, #event_kind, "merge", "Merge", "merge", 8);
    seedEntry(entries, counter, #event_kind, "cut", "Cut", "cut", 9);
    seedEntry(entries, counter, #event_kind, "retail", "Retail", "retail", 10);
    seedEntry(entries, counter, #event_kind, "correction", "Correction", "correction", 11);
    seedEntry(entries, counter, #event_kind, "note", "Note", "note", 12);

    // Header and display labels.
    seedEntry(entries, counter, #caption, "app_title", "Explor8", "Explor8", 1);
    seedEntry(entries, counter, #caption, "app_subtitle", "A product of Jewel of Africa", "A product of Jewel of Africa", 2);

    // Form defaults.
    seedEntry(entries, counter, #form_default, "licence", "Licence", "44287-HQ-LEL", 1);
    seedEntry(entries, counter, #form_default, "project", "Project", "Mufumbwe / Kikonge", 2);
  };

  public func migration(old : OldActor) : NewActor {
    let entries = Map.empty<Text, RefEntry>();
    seedReference(entries);
    let lots = old.registerState.lots.map<LotId, OldLot, NewLot>(
      func(_id, lot) = toNewLot(lot)
    );
    {
      accessControlState = old.accessControlState;
      registerState = {
        var nextSeq = old.registerState.nextSeq;
        lots;
        fileHashes = old.registerState.fileHashes;
        lotIndex = old.registerState.lotIndex;
      };
      rolesState = old.rolesState;
      referenceState = {
        var nextEntrySeq = 0;
        var nextDocSeq = 0;
        entries;
        documents = Map.empty();
      };
    };
  };
};
