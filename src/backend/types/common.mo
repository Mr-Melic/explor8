/// Cross-cutting types shared across every JOA Gold Book domain.
module {
  /// Canister timestamp in nanoseconds (never a client clock).
  public type Timestamp = Int;

  /// SHA-256 digest rendered as 64 lowercase hex characters.
  public type HashHex = Text;

  /// A lot identifier, format JOA-<SITE>-YYYYMMDD-<NNNN>.
  public type LotId = Text;

  /// A file-storage identifier for an uploaded document or photo.
  public type FileId = Text;

  /// The three registered JOA sites.
  public type Site = {
    #MFB;
    #LUS;
    #KFB;
  };

  /// The kind of physical item a lot represents. The register offers exactly
  /// two kinds: Emerald and Gold.
  public type LotType = {
    #emerald;
    #gold;
  };

  /// Lifecycle status of a lot.
  public type LotStatus = {
    #open;
    #in_transit;
    #assayed;
    #retailed;
    #closed;
    #frozen;
  };

  /// The kind of provenance event appended to a lot.
  public type EventKind = {
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

  /// Roles layered on top of the built-in admin/user/guest model.
  public type Role = {
    #guest;
    #field_officer;
    #assayer;
    #workshop;
    #admin;
  };

  /// One recorded status transition on a lot, in provenance order.
  public type StatusChange = {
    seq : Nat;
    from : LotStatus;
    to : LotStatus;
    at : Timestamp;
    by : Principal;
  };

  /// A per-file content hash persisted alongside the file id.
  public type FileHash = {
    fileId : FileId;
    contentHash : HashHex;
  };

  /// One link in a lot's append-only hash chain.
  public type HashChainEntry = {
    at : Timestamp;
    eventSeq : Nat;
    contentHash : HashHex;
  };

  /// A single append-only provenance event on a lot.
  public type Event = {
    seq : Nat;
    kind : EventKind;
    at : Timestamp;
    by : Principal;
    payload : Text;
    fileIds : [FileId];
    payloadHash : HashHex;
  };

  /// A physical gold lot or jewellery piece in the register.
  public type Lot = {
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

  /// A lot as returned to the frontend, with per-file hashes and supersession.
  public type LotView = {
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
    fileHashes : [FileHash];
    contentHash : HashHex;
    hashChain : [HashChainEntry];
    events : [EventView];
    frozen : Bool;
  };

  /// An event as returned to the frontend, with supersession markers.
  public type EventView = {
    seq : Nat;
    kind : EventKind;
    at : Timestamp;
    by : Principal;
    payload : Text;
    fileIds : [FileId];
    payloadHash : HashHex;
    supersededBy : ?Nat;
  };

  /// A principal with its assigned role, for the admin actor list.
  public type ActorRole = {
    principal : Principal;
    role : Role;
  };

  /// A role with its human-readable display name, for the admin panel.
  public type RoleInfo = {
    role : Role;
    displayName : Text;
  };

  /// Counts of lots grouped by one dimension.
  public type CountBucket = {
    key : Text;
    count : Nat;
  };

  /// Event activity for one day, for the home-page graph.
  public type ActivityPoint = {
    day : Text;
    count : Nat;
  };

  /// Aggregate register data for the home-page graph.
  public type RegisterSummary = {
    totalLots : Nat;
    totalEvents : Nat;
    byType : [CountBucket];
    byStatus : [CountBucket];
    bySite : [CountBucket];
    activity : [ActivityPoint];
  };

  /// A search hit across lot id, content-hash prefix, seal number and working ref.
  public type LotSearchHit = {
    id : LotId;
    lotType : LotType;
    status : LotStatus;
    sealNo : Text;
    workingRef : Text;
    contentHash : HashHex;
  };

  /// Errors returned by lot and event mutations.
  public type RegisterError = {
    #notAuthenticated;
    #notAuthorized;
    #unknownLot : LotId;
    #duplicateLot : LotId;
    #lotFrozen : LotId;
    #invalidInput : Text;
  };
};
