/// Adds the purge workflow state, the role-permission state, and the
/// per-lot status-change history introduced by the purge, status-change and
/// permissions features.
///
/// `OldActor` is the `NewActor` of the preceding migration in the chain
/// (20260921_190000.mo); `NewActor` matches the stable fields declared in
/// main.mo exactly.
///
/// Existing lots gain an empty `statusHistory`; their stored status, events,
/// hashes and hash-chain entries are untouched, so the register stays
/// append-only and sealed records stay immutable. The purge state starts with
/// no pending request, and the permission state starts with the built-in role
/// defaults and no per-principal overrides.
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
    #status_change;
  };

  /// The event-kind vocabulary of the preceding migration (20260921_190000.mo),
  /// which predates the `#status_change` tag. `OldActor` must match that
  /// migration's `NewActor` exactly, so the old shape keeps its own type.
  type OldEventKind = {
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

  type StatusChange = {
    seq : Nat;
    from : LotStatus;
    to : LotStatus;
    at : Timestamp;
    by : Principal;
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
    statusHistory : [StatusChange];
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

  type Capability = {
    #create_lot;
    #append_event;
    #change_status;
    #split_lot;
    #merge_lot;
    #freeze_lot;
    #manage_reference_data;
    #manage_analysis_documents;
    #manage_roles;
    #view_analytics;
    #purge_register;
  };

  type PrincipalOverride = {
    principal : Principal;
    role : Role;
    capabilities : [Capability];
  };

  type PurgeConfirmation = { admin : Principal; at : Timestamp };

  type PurgeRequest = {
    id : Text;
    requestedBy : Principal;
    requestedAt : Timestamp;
    confirmations : [PurgeConfirmation];
    requiredConfirmations : Nat;
  };

  // ── Old shape: the NewActor of 20260921_190000.mo ─────────────────────────

  type OldEvent = {
    seq : Nat;
    kind : OldEventKind;
    at : Timestamp;
    by : Principal;
    payload : Text;
    fileIds : [FileId];
    payloadHash : HashHex;
  };

  type OldLot = {
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
    events : [OldEvent];
    frozen : Bool;
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
      var lotIndex : Table.Table;
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
    purgeState : {
      var nextRequestSeq : Nat;
      var pending : ?PurgeRequest;
    };
    permissionsState : {
      roleDefaults : Map.Map<Text, [Capability]>;
      overrides : Map.Map<Principal, PrincipalOverride>;
    };
  };

  // ── Transformations ───────────────────────────────────────────────────────

  /// Widen an old event kind to the current vocabulary. Every old tag already
  /// exists in the new one, so this is a total, lossless mapping.
  func toNewEventKind(kind : OldEventKind) : EventKind {
    switch kind {
      case (#extracted) #extracted;
      case (#photo) #photo;
      case (#weighed) #weighed;
      case (#sealed) #sealed;
      case (#moved) #moved;
      case (#assay) #assay;
      case (#split) #split;
      case (#merge) #merge;
      case (#cut) #cut;
      case (#retail) #retail;
      case (#correction) #correction;
      case (#note) #note;
    };
  };

  /// Widen an old event to the current event shape; every field is preserved.
  func toNewEvent(event : OldEvent) : Event {
    {
      seq = event.seq;
      kind = toNewEventKind(event.kind);
      at = event.at;
      by = event.by;
      payload = event.payload;
      fileIds = event.fileIds;
      payloadHash = event.payloadHash;
    };
  };

  /// Give an existing lot an empty status-change history; every other field is
  /// preserved exactly.
  func toNewLot(lot : OldLot) : Lot {
    {
      id = lot.id;
      lotType = lot.lotType;
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
      events = lot.events.map(func(event) = toNewEvent(event));
      statusHistory = [];
      frozen = lot.frozen;
    };
  };

  /// The built-in default permission set for a role. Admin holds every
  /// capability; Custom Role (`#workshop`) starts with none.
  func defaultCapabilities(role : Role) : [Capability] {
    switch role {
      case (#admin) [
        #create_lot,
        #append_event,
        #change_status,
        #split_lot,
        #merge_lot,
        #freeze_lot,
        #manage_reference_data,
        #manage_analysis_documents,
        #manage_roles,
        #view_analytics,
        #purge_register,
      ];
      case (_) [];
    };
  };

  /// The canonical tag text for a role, used to key the role-default map.
  func roleTag(role : Role) : Text {
    switch role {
      case (#guest) "guest";
      case (#field_officer) "field_officer";
      case (#assayer) "assayer";
      case (#workshop) "workshop";
      case (#admin) "admin";
    };
  };

  /// The seeded role-default permission map.
  func seededRoleDefaults() : Map.Map<Text, [Capability]> {
    let defaults = Map.empty<Text, [Capability]>();
    defaults.add(roleTag(#guest), defaultCapabilities(#guest));
    defaults.add(roleTag(#field_officer), defaultCapabilities(#field_officer));
    defaults.add(roleTag(#assayer), defaultCapabilities(#assayer));
    defaults.add(roleTag(#workshop), defaultCapabilities(#workshop));
    defaults.add(roleTag(#admin), defaultCapabilities(#admin));
    defaults;
  };

  public func migration(old : OldActor) : NewActor {
    let lots = old.registerState.lots.map<LotId, OldLot, Lot>(
      func(_id, lot) = toNewLot(lot)
    );
    {
      accessControlState = old.accessControlState;
      registerState = {
        var nextSeq = old.registerState.nextSeq;
        lots;
        fileHashes = old.registerState.fileHashes;
        var lotIndex = old.registerState.lotIndex;
      };
      rolesState = old.rolesState;
      referenceState = old.referenceState;
      purgeState = {
        var nextRequestSeq = 0;
        var pending = null;
      };
      permissionsState = {
        roleDefaults = seededRoleDefaults();
        overrides = Map.empty();
      };
    };
  };
};
