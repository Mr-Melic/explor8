/// Renames the seeded reference catalogue's status display terms to the
/// register's simplified vocabulary, and normalises any site entry whose
/// display name is the bare word "Site"/"Sites" to "Mining Site"/"Mining
/// Sites".
///
/// `OldActor` is the `NewActor` of the preceding migration in the chain
/// (20260921_180000.mo); `NewActor` matches the stable fields declared in
/// main.mo exactly.
///
/// Only `displayName` changes. The `key` is the stable identifier the register
/// stores and the `LotStatus` enum tags (`#open`, `#in_transit`, `#assayed`,
/// `#retailed`, `#closed`, `#frozen`) are untouched, so no stored lot, event,
/// hash or hash-chain entry is rewritten. The register stays append-only and
/// sealed records stay immutable.
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

  type LotType = { #emerald; #gold };

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
      lots : Map.Map<LotId, Lot>;
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
    referenceState : {
      var nextEntrySeq : Nat;
      var nextDocSeq : Nat;
      entries : Map.Map<Text, RefEntry>;
      documents : Map.Map<Text, AnalysisDocument>;
    };
  };

  // ── Display-term renames ──────────────────────────────────────────────────

  /// The simplified status vocabulary, keyed by the stable stored identifier.
  /// A key that is not listed keeps its current display name.
  func renamedStatus(key : Text) : ?Text {
    switch key {
      case "open" ?"Recently Mined";
      case "assayed" ?"Testing Quality";
      case "closed" ?"Applied for crafting";
      case "frozen" ?"Confiscated by Authorities";
      case _ null;
    };
  };

  /// Normalise a bare "Site"/"Sites" display name to the register's wording.
  func renamedSite(displayName : Text) : Text {
    switch displayName {
      case "Site" "Mining Site";
      case "Sites" "Mining Sites";
      case _ displayName;
    };
  };

  /// The display name a status entry should carry after this migration.
  func statusDisplayName(key : Text, current : Text) : Text {
    switch (renamedStatus(key)) {
      case (?name) name;
      case null current;
    };
  };

  /// Rewrite one reference entry's display name where this migration renames
  /// it; every other field is preserved.
  func toNewEntry(entry : RefEntry) : RefEntry {
    let displayName = switch (entry.kind) {
      case (#status) statusDisplayName(entry.key, entry.displayName);
      case (#site) renamedSite(entry.displayName);
      case (_) entry.displayName;
    };
    {
      id = entry.id;
      kind = entry.kind;
      key = entry.key;
      displayName;
      value = entry.value;
      sortOrder = entry.sortOrder;
      active = entry.active;
    };
  };

  public func migration(old : OldActor) : NewActor {
    let entries = old.referenceState.entries.map<Text, RefEntry, RefEntry>(
      func(_id, entry) = toNewEntry(entry)
    );
    {
      accessControlState = old.accessControlState;
      registerState = old.registerState;
      rolesState = old.rolesState;
      referenceState = {
        var nextEntrySeq = old.referenceState.nextEntrySeq;
        var nextDocSeq = old.referenceState.nextDocSeq;
        entries;
        documents = old.referenceState.documents;
      };
    };
  };
};
