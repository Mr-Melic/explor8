/// Adds the `#delete_lot` capability to the permission state introduced by the
/// preceding migration (20260922_120000.mo), so the admin panel's Permissions
/// section can list "Delete a block" and hold it for admin by default.
///
/// `OldActor` is the `NewActor` of the preceding migration in the chain
/// (20260922_120000.mo); `NewActor` matches the stable fields declared in
/// main.mo exactly.
///
/// The stored role defaults and per-principal overrides are widened to the new
/// capability vocabulary. Admin's stored default set gains `#delete_lot`; every
/// other role's stored set is preserved unchanged. No lot, event, hash or
/// hash-chain entry is touched, so the register stays append-only and sealed
/// records stay immutable.
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

  /// The capability vocabulary of the preceding migration (20260922_120000.mo),
  /// which predates the `#delete_lot` tag. `OldActor` must match that
  /// migration's `NewActor` exactly, so the old shape keeps its own type.
  type OldCapability = {
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
    #delete_lot;
  };

  type OldPrincipalOverride = {
    principal : Principal;
    role : Role;
    capabilities : [OldCapability];
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

  type OldActor = {
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
      roleDefaults : Map.Map<Text, [OldCapability]>;
      overrides : Map.Map<Principal, OldPrincipalOverride>;
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

  /// Widen an old capability to the current vocabulary. Every old tag already
  /// exists in the new one, so this is a total, lossless mapping.
  func toNewCapability(capability : OldCapability) : Capability {
    switch capability {
      case (#create_lot) #create_lot;
      case (#append_event) #append_event;
      case (#change_status) #change_status;
      case (#split_lot) #split_lot;
      case (#merge_lot) #merge_lot;
      case (#freeze_lot) #freeze_lot;
      case (#manage_reference_data) #manage_reference_data;
      case (#manage_analysis_documents) #manage_analysis_documents;
      case (#manage_roles) #manage_roles;
      case (#view_analytics) #view_analytics;
      case (#purge_register) #purge_register;
    };
  };

  /// Widen a stored capability list, preserving order and dropping nothing.
  func toNewCapabilities(capabilities : [OldCapability]) : [Capability] {
    capabilities.map(func (capability) = toNewCapability(capability));
  };

  /// Widen a per-principal override; every field is preserved.
  func toNewOverride(override : OldPrincipalOverride) : PrincipalOverride {
    {
      principal = override.principal;
      role = override.role;
      capabilities = toNewCapabilities(override.capabilities);
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

  /// Widen one stored role-default set. Admin's set gains `#delete_lot` when it
  /// is not already present, so admin holds every capability by default; every
  /// other role's stored set is preserved exactly.
  func toNewRoleDefaults(roleTagText : Text, capabilities : [OldCapability]) : [Capability] {
    let widened = toNewCapabilities(capabilities);
    if (roleTagText == roleTag(#admin) and not widened.any(func c = c == #delete_lot)) {
      widened.concat([#delete_lot]);
    } else {
      widened;
    };
  };

  public func migration(old : OldActor) : NewActor {
    let roleDefaults = old.permissionsState.roleDefaults.map<Text, [OldCapability], [Capability]>(
      func(tag, capabilities) = toNewRoleDefaults(tag, capabilities)
    );
    let overrides = old.permissionsState.overrides.map<Principal, OldPrincipalOverride, PrincipalOverride>(
      func(_principal, override) = toNewOverride(override)
    );
    {
      accessControlState = old.accessControlState;
      registerState = old.registerState;
      rolesState = old.rolesState;
      referenceState = old.referenceState;
      purgeState = old.purgeState;
      permissionsState = { roleDefaults; overrides };
    };
  };
};
