/// Adds the purchase-enquiry inbox state and the two new reference kinds, and
/// applies the display-term renames to the stored reference data.
///
/// `OldActor` is the `NewActor` of the preceding migration in the chain
/// (20260922_140000.mo); `NewActor` matches the stable fields declared in
/// main.mo exactly.
///
/// Three changes are folded into this one entry:
///
/// 1. `enquiryState` is introduced for the purchase-enquiry inbox. It starts
///    empty: no enquiry exists until a signed-in visitor submits one.
/// 2. `RefKind` gains `#status_explanation` (the per-status explanation texts)
///    and `#enquiry_destination` (the optional enquiry destination email).
///    `RefKind` is stored inside `referenceState.entries`, so the old shape
///    keeps its own `OldRefKind` type and every stored entry is widened with a
///    total mapping.
/// 3. The display-term renames are applied to the stored reference entries:
///    the `#status` display terms become "Recently Mined", "Testing Quality",
///    "Applied for crafting" and "Confiscated by Authorities"; the `#site`
///    display terms read "Mining Site" / "Mining Sites"; the `#caption`
///    entries for the lot field labels read "Registered at", "Mining Site",
///    "Mining Licence", "Registered by" and "Lot number"; and the
///    `#event_kind` display terms align with the current status names.
///
/// No lot, event, hash or hash-chain entry is touched, so the register stays
/// append-only and sealed records stay immutable.
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

  /// The reference-kind vocabulary of the preceding migration
  /// (20260922_140000.mo), which predates `#status_explanation` and
  /// `#enquiry_destination`. `OldActor` must match that migration's `NewActor`
  /// exactly, so the old shape keeps its own type.
  type OldRefKind = {
    #lot_kind;
    #site;
    #status;
    #event_kind;
    #caption;
    #form_default;
  };

  type RefKind = {
    #lot_kind;
    #site;
    #status;
    #event_kind;
    #caption;
    #form_default;
    #status_explanation;
    #enquiry_destination;
  };

  type OldRefEntry = {
    id : Text;
    kind : OldRefKind;
    key : Text;
    displayName : Text;
    value : Text;
    sortOrder : Nat;
    active : Bool;
  };

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
    #delete_lot;
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

  type Enquiry = {
    id : Text;
    submittedBy : Principal;
    name : Text;
    email : Text;
    phone : Text;
    message : Text;
    consent : Bool;
    submittedAt : Timestamp;
    withdrawn : Bool;
    withdrawnAt : ?Timestamp;
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
      entries : Map.Map<Text, OldRefEntry>;
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
    enquiryState : {
      var nextEnquirySeq : Nat;
      enquiries : Map.Map<Text, Enquiry>;
    };
  };

  // ── Transformations ───────────────────────────────────────────────────────

  /// Widen an old reference kind to the current vocabulary. Every old tag
  /// already exists in the new one, so this is a total, lossless mapping.
  func toNewRefKind(kind : OldRefKind) : RefKind {
    switch kind {
      case (#lot_kind) #lot_kind;
      case (#site) #site;
      case (#status) #status;
      case (#event_kind) #event_kind;
      case (#caption) #caption;
      case (#form_default) #form_default;
    };
  };

  /// The renamed display term for a stored reference entry, or null when the
  /// entry keeps its current display name. Only display terms change; the
  /// stable `key` and the `value` are preserved exactly.
  func renamedDisplayName(kind : RefKind, key : Text) : ?Text {
    switch (kind) {
      case (#status) {
        switch key {
          case ("open") ?"Recently Mined";
          case ("assayed") ?"Testing Quality";
          case ("closed") ?"Applied for crafting";
          case ("frozen") ?"Confiscated by Authorities";
          case (_) null;
        };
      };
      case (#site) {
        switch key {
          case ("MFB") ?"Mining Site";
          case ("LUS") ?"Mining Site";
          case ("KFB") ?"Mining Site";
          case (_) null;
        };
      };
      case (#caption) {
        switch key {
          case ("opened_at") ?"Registered at";
          case ("project") ?"Mining Site";
          case ("licence") ?"Mining Licence";
          case ("opened_by") ?"Registered by";
          case ("seal_no") ?"Lot number";
          case (_) null;
        };
      };
      case (#event_kind) {
        switch key {
          case ("extracted") ?"Recently Mined";
          case ("assay") ?"Testing Quality";
          case ("retail") ?"Retailed";
          case ("status_change") ?"Status change";
          case (_) null;
        };
      };
      case (_) null;
    };
  };

  /// Replace the word "provenance" with "Precious Material Origin History" in a
  /// stored display term, preserving the surrounding text exactly. Returns null
  /// when the term carries no such wording, so the caller keeps the existing
  /// display name.
  func renamedProvenance(text : Text) : ?Text {
    let lower = text.toLower();
    if (not lower.contains(#text "provenance")) {
      return null;
    };
    let replaced = text.replace(#text "provenance", "Precious Material Origin History");
    ?replaced.replace(#text "Provenance", "Precious Material Origin History");
  };

  /// Widen one stored reference entry and apply its display-term rename.
  func toNewRefEntry(entry : OldRefEntry) : RefEntry {
    let kind = toNewRefKind(entry.kind);
    let displayName = switch (renamedDisplayName(kind, entry.key)) {
      case (?renamed) renamed;
      case null {
        switch (renamedProvenance(entry.displayName)) {
          case (?renamed) renamed;
          case null entry.displayName;
        };
      };
    };
    {
      id = entry.id;
      kind;
      key = entry.key;
      displayName;
      value = entry.value;
      sortOrder = entry.sortOrder;
      active = entry.active;
    };
  };

  /// The default explanation text for a lot status, keyed by its stable status
  /// key. These seed the home page's per-status information panels; an admin
  /// can edit or remove them afterwards.
  func statusExplanation(key : Text) : ?Text {
    switch key {
      case ("open") ?"Recently mined material that has just been registered. Its origin, weight and licence details are recorded, and it has not yet left the site.";
      case ("in_transit") ?"The material has been moved from its registered site and is in transit under the recorded chain of custody.";
      case ("assayed") ?"The material is with a quality tester for assay. Its purity and weight are being verified before it moves on.";
      case ("retailed") ?"The material has been released to retail and is offered for sale under the recorded licence.";
      case ("closed") ?"The material's journey is complete and the record has been applied for crafting.";
      case ("frozen") ?"The material has been confiscated by the authorities and its record is frozen. No further changes can be made to it.";
      case (_) null;
    };
  };

  /// The status keys that receive a seeded explanation, in display order.
  let statusKeys = ["open", "in_transit", "assayed", "retailed", "closed", "frozen"];

  /// The highest numeric suffix among the stored `ref-<n>` ids, or 0 when none
  /// is stored. The incoming catalogue's counter can lag its stored ids, so the
  /// seed allocates above the real maximum and never overwrites an entry.
  func highestEntrySeq(entries : Map.Map<Text, RefEntry>) : Nat {
    var highest = 0;
    for (id in entries.keys()) {
      if (id.startsWith(#text "ref-")) {
        let suffix = id.trimStart(#text "ref-");
        switch (suffix.toNat()) {
          case (?n) { if (n > highest) { highest := n } };
          case null {};
        };
      };
    };
    highest;
  };

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

  /// Whether an entry of this kind and key is already stored.
  func hasEntry(entries : Map.Map<Text, RefEntry>, kind : RefKind, key : Text) : Bool {
    var found = false;
    for (entry in entries.values()) {
      if (entry.kind == kind and entry.key == key) {
        found := true;
      };
    };
    found;
  };

  /// Seed one catalogue entry unless the same kind and key is already stored.
  func seedMissing(
    entries : Map.Map<Text, RefEntry>,
    counter : { var next : Nat },
    kind : RefKind,
    key : Text,
    displayName : Text,
    value : Text,
    sortOrder : Nat,
  ) : () {
    if (not hasEntry(entries, kind, key)) {
      seedEntry(entries, counter, kind, key, displayName, value, sortOrder);
    };
  };

  /// The starting catalogue, with this migration's display terms already
  /// applied. Every entry is seeded only when the same kind and key is not
  /// already stored, so the register's forms and displays always have data to
  /// read and an administrator's own entries are never overwritten.
  func seedCatalogue(entries : Map.Map<Text, RefEntry>, startSeq : Nat) : Nat {
    let counter = { var next = startSeq };

    seedMissing(entries, counter, #lot_kind, "emerald", "Emerald", "emerald", 1);
    seedMissing(entries, counter, #lot_kind, "gold", "Gold", "gold", 2);

    seedMissing(entries, counter, #site, "MFB", "Mining Site", "MFB", 1);
    seedMissing(entries, counter, #site, "LUS", "Mining Site", "LUS", 2);
    seedMissing(entries, counter, #site, "KFB", "Mining Site", "KFB", 3);

    seedMissing(entries, counter, #status, "open", "Recently Mined", "open", 1);
    seedMissing(entries, counter, #status, "in_transit", "In transit", "in_transit", 2);
    seedMissing(entries, counter, #status, "assayed", "Testing Quality", "assayed", 3);
    seedMissing(entries, counter, #status, "retailed", "Retailed", "retailed", 4);
    seedMissing(entries, counter, #status, "closed", "Applied for crafting", "closed", 5);
    seedMissing(entries, counter, #status, "frozen", "Confiscated by Authorities", "frozen", 6);

    seedMissing(entries, counter, #event_kind, "extracted", "Recently Mined", "extracted", 1);
    seedMissing(entries, counter, #event_kind, "photo", "Photo", "photo", 2);
    seedMissing(entries, counter, #event_kind, "weighed", "Weighed", "weighed", 3);
    seedMissing(entries, counter, #event_kind, "sealed", "Sealed", "sealed", 4);
    seedMissing(entries, counter, #event_kind, "moved", "Moved", "moved", 5);
    seedMissing(entries, counter, #event_kind, "assay", "Testing Quality", "assay", 6);
    seedMissing(entries, counter, #event_kind, "split", "Split", "split", 7);
    seedMissing(entries, counter, #event_kind, "merge", "Merge", "merge", 8);
    seedMissing(entries, counter, #event_kind, "cut", "Cut", "cut", 9);
    seedMissing(entries, counter, #event_kind, "retail", "Retailed", "retail", 10);
    seedMissing(entries, counter, #event_kind, "correction", "Correction", "correction", 11);
    seedMissing(entries, counter, #event_kind, "note", "Note", "note", 12);

    seedMissing(entries, counter, #caption, "app_title", "Explor8", "Explor8", 1);
    seedMissing(entries, counter, #caption, "app_subtitle", "A product of Jewel of Africa", "A product of Jewel of Africa", 2);

    seedMissing(entries, counter, #form_default, "licence", "Mining Licence", "44287-HQ-LEL", 1);
    seedMissing(entries, counter, #form_default, "project", "Mining Site", "Mufumbwe / Kikonge", 2);

    counter.next;
  };

  /// Seed one `#status_explanation` entry per lot status, unless an entry with
  /// that key already exists. Returns the next free entry sequence.
  func seedStatusExplanations(
    entries : Map.Map<Text, RefEntry>,
    startSeq : Nat,
  ) : Nat {
    var seq = startSeq;
    var order = 0;
    for (key in statusKeys.values()) {
      if (not hasEntry(entries, #status_explanation, key)) {
        switch (statusExplanation(key)) {
          case (?value) {
            seq += 1;
            let id = "ref-" # seq.toText();
            entries.add(id, {
              id;
              kind = #status_explanation;
              key;
              displayName = key;
              value;
              sortOrder = order;
              active = true;
            });
          };
          case null {};
        };
      };
      order += 1;
    };
    seq;
  };

  public func migration(old : OldActor) : NewActor {
    // Rebuild the catalogue explicitly rather than through `Map.map`: every
    // stored entry is carried across by reference, so the seeded catalogue
    // survives the chain and only its display terms change.
    let entries = Map.empty<Text, RefEntry>();
    for ((id, entry) in old.referenceState.entries.entries()) {
      entries.add(id, toNewRefEntry(entry));
    };
    // The catalogue is the register's reference data. Seed any entry the
    // incoming state does not already carry, so the forms and displays always
    // have data to read while an administrator's own entries are preserved.
    let carriedSeq = seedCatalogue(entries, highestEntrySeq(entries));
    let nextEntrySeq = seedStatusExplanations(entries, carriedSeq);
    {
      accessControlState = old.accessControlState;
      registerState = old.registerState;
      rolesState = old.rolesState;
      referenceState = {
        var nextEntrySeq = nextEntrySeq;
        var nextDocSeq = old.referenceState.nextDocSeq;
        entries;
        documents = old.referenceState.documents;
      };
      purgeState = old.purgeState;
      permissionsState = old.permissionsState;
      enquiryState = {
        var nextEnquirySeq = 0;
        enquiries = Map.empty();
      };
    };
  };
};
