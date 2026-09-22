/// Domain logic for the JOA Gold Book provenance register.
import Int "mo:core/Int";
import Map "mo:core/Map";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Table "mo:caffeineai-oql/Table";
import OqlTypes "mo:caffeineai-oql/Types";
import Types "../types/register";
import Hashing "hashing";
import RolesLib "roles";
import PermissionsLib "permissions";

module {
  /// The register state shared with the API mixins.
  public type State = {
    var nextSeq : Nat;
    lots : Map.Map<Types.LotId, Types.Lot>;
    fileHashes : Map.Map<Types.LotId, [Types.FileHash]>;
    var lotIndex : Table.Table;
  };

  /// The role state, needed to authorize register mutations.
  public type RolesState = RolesLib.State;

  /// The canonical tag text for a site.
  public func siteTag(site : Types.Site) : Text {
    switch site {
      case (#MFB) "MFB";
      case (#LUS) "LUS";
      case (#KFB) "KFB";
    };
  };

  /// The canonical tag text for a lot status.
  public func statusTag(status : Types.LotStatus) : Text {
    switch status {
      case (#open) "open";
      case (#in_transit) "in_transit";
      case (#assayed) "assayed";
      case (#retailed) "retailed";
      case (#closed) "closed";
      case (#frozen) "frozen";
    };
  };

  /// The canonical tag text for a lot type.
  public func lotTypeTag(lotType : Types.LotType) : Text {
    Hashing.lotTypeTag(lotType);
  };

  /// The site embedded in a lot id, or "" when the id is not well formed.
  public func siteOf(lotId : Types.LotId) : Text {
    let parts = lotId.split(#char '-').toArray();
    if (parts.size() < 3) { return "" };
    parts[1];
  };

  /// The YYYYMMDD segment of a lot id, or "" when the id is not well formed.
  func dateOf(lotId : Types.LotId) : Text {
    let parts = lotId.split(#char '-').toArray();
    if (parts.size() < 4) { return "" };
    parts[2];
  };

  /// The four-digit daily sequence of a lot id, or 0 when not well formed.
  func seqOf(lotId : Types.LotId) : Nat {
    let parts = lotId.split(#char '-').toArray();
    if (parts.size() < 4) { return 0 };
    parts[3].toNat() ?? 0;
  };

  /// Zero-pad a Nat to at least `width` digits.
  func pad(value : Nat, width : Nat) : Text {
    let digits = value.toText();
    var out = "";
    var i = digits.size();
    while (i < width) {
      out := out # "0";
      i += 1;
    };
    out # digits;
  };

  /// The YYYYMMDD text for a canister timestamp.
  public func dayOf(at : Types.Timestamp) : Text {
    let seconds = Int.abs(at) / 1_000_000_000;
    let days = seconds / 86_400;
    let (y, m, d) = civilFromDays(days);
    pad(y, 4) # pad(m, 2) # pad(d, 2);
  };

  /// Days since 1970-01-01 to a civil (year, month, day).
  func civilFromDays(days : Nat) : (Nat, Nat, Nat) {
    let z : Nat = days + 719_468;
    let era : Nat = z / 146_097;
    let doe : Nat = z - era * 146_097;
    let yoe : Nat = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y : Nat = yoe + era * 400;
    let doy : Nat = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp : Nat = (5 * doy + 2) / 153;
    let d : Nat = doy - (153 * mp + 2) / 5 + 1;
    let m : Nat = if (mp < 10) { mp + 3 } else { mp - 9 };
    let year : Nat = if (m <= 2) { y + 1 } else { y };
    (year, m, d);
  };

  /// The next daily sequence for a site and date, scanning existing ids.
  func nextDailySeq(state : State, site : Types.Site, date : Text) : Nat {
    let tag = siteTag(site);
    var highest = 0;
    for (lot in state.lots.values()) {
      if (siteOf(lot.id) == tag and dateOf(lot.id) == date) {
        let n = seqOf(lot.id);
        if (n > highest) { highest := n };
      };
    };
    highest + 1;
  };

  /// The canonical snapshot for a lot: current fields plus every file hash ever
  /// attached to the lot or any of its events.
  func snapshotOf(lot : Types.Lot, fileHashes : [Types.FileHash]) : Types.CanonicalSnapshot {
    {
      fileContentHashes = Hashing.collectFileContentHashes(fileHashes, lot.events);
      gps = lot.gps;
      grossG = lot.grossG;
      id = lot.id;
      licence = lot.licence;
      parentIds = lot.parentIds;
      project = lot.project;
      sealNo = lot.sealNo;
      lotType = lot.lotType;
      workingRef = lot.workingRef;
    };
  };

  /// The file hashes recorded for a lot, or an empty list.
  func hashesOf(state : State, lotId : Types.LotId) : [Types.FileHash] {
    state.fileHashes.get(lotId) ?? [];
  };

  /// Merge new file hashes into the lot's recorded set, newest wins per file id.
  func mergeFileHashes(existing : [Types.FileHash], incoming : [Types.FileHash]) : [Types.FileHash] {
    var out = existing;
    for (fh in incoming.values()) {
      let kept = out.filter(func (e : Types.FileHash) : Bool = e.fileId != fh.fileId);
      out := kept.concat([fh]);
    };
    out;
  };

  /// Append a hash-chain link and recompute the lot's content hash.
  func rehash(lot : Types.Lot, fileHashes : [Types.FileHash], at : Types.Timestamp, eventSeq : Nat) : Types.Lot {
    let contentHash = Hashing.computeContentHash(snapshotOf(lot, fileHashes));
    let entry : Types.HashChainEntry = { at; eventSeq; contentHash };
    { lot with contentHash; hashChain = lot.hashChain.concat([entry]) };
  };

  /// The row projection appended to the OQL lot index.
  func lotRow(lot : Types.Lot) : [(Text, OqlTypes.Value)] {
    [
      ("lotType", #text (Hashing.lotTypeTag(lot.lotType))),
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

  /// Persist a lot and refresh its OQL index row.
  func store(state : State, lot : Types.Lot) : () {
    state.lots.add(lot.id, lot);
    ignore state.lotIndex.append(lot, lotRow);
  };

  /// Rebuild the OQL lot index from the current lots. The columnar table has no
  /// per-row delete, so a single-block deletion rebuilds it in place with the
  /// same schema; the `Expose` entity keeps serving the remaining register.
  func rebuildLotIndex(state : State) : () {
    state.lotIndex := Table.new(
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
    for (lot in state.lots.values()) {
      ignore state.lotIndex.append(lot, lotRow);
    };
  };

  /// Delete exactly one block: removes the lot, its events, its hash chain and
  /// its stored file references, and rebuilds the OQL lot index without its
  /// row. Remaining blocks and their chains are untouched. Admin only, gated on
  /// the `#delete_lot` capability. This is the register's one explicit
  /// destructive action; every other operation stays append-only.
  public func deleteLot(
    state : State,
    roles : RolesState,
    permissions : PermissionsLib.State,
    caller : Principal,
    lotId : Types.LotId,
  ) : Result.Result<Types.LotId, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not PermissionsLib.can(permissions, roles, caller, #delete_lot)) {
      return #err(#notAuthorized);
    };
    if (state.lots.get(lotId) == null) {
      return #err(#unknownLot(lotId));
    };
    state.lots.remove(lotId);
    state.fileHashes.remove(lotId);
    rebuildLotIndex(state);
    #ok(lotId);
  };

  /// Clear every block, its hash chain and its OQL index rows. The OQL lot
  /// index is a columnar table with no `clear`, so it is rebuilt in place with
  /// the same schema; the `Expose` entity keeps serving an empty register.
  /// Roles, actors and reference data are untouched.
  public func clear(state : State) : () {
    state.lots.clear();
    state.fileHashes.clear();
    state.lotIndex := Table.new(
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
    state.nextSeq := 0;
  };

  /// Suggest the next lot id for a site and date, four-digit daily sequence
  /// from 0001, e.g. JOA-MFB-20260918-0047.
  public func suggestLotId(state : State, site : Types.Site, date : Text) : Types.LotId {
    "JOA-" # siteTag(site) # "-" # date # "-" # pad(nextDailySeq(state, site, date), 4);
  };

  /// Register a new lot: writes the lot with event seq 1 kind = extracted,
  /// openedAt from the canister clock, openedBy the caller, and the computed
  /// contentHash. Rejects duplicate ids.
  public func registerLot(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.NewLotInput,
  ) : Result.Result<Types.LotView, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.canCreateLot(roles, caller, input.lotType)) {
      return #err(#notAuthorized);
    };
    let now = nowNs();
    let lotId = suggestLotId(state, input.site, dayOf(now));
    if (state.lots.get(lotId) != null) {
      return #err(#duplicateLot(lotId));
    };
    let event : Types.Event = {
      seq = 1;
      kind = #extracted;
      at = now;
      by = caller;
      payload = "Lot opened";
      fileIds = input.fileIds;
      payloadHash = Hashing.computePayloadHash({
        kind = #extracted;
        payload = "Lot opened";
        fileContentHashes = input.fileHashes.map(func (fh : Types.FileHash) : Types.HashHex = fh.contentHash);
      });
    };
    let base : Types.Lot = {
      id = lotId;
      lotType = input.lotType;
      licence = input.licence;
      project = input.project;
      gps = input.gps;
      workingRef = input.workingRef;
      openedAt = now;
      openedBy = caller;
      grossG = input.grossG;
      sealNo = input.sealNo;
      status = #open;
      parentIds = [];
      photoFileIds = input.photoFileIds;
      fileIds = input.fileIds;
      contentHash = "";
      hashChain = [];
      events = [event];
      statusHistory = [];
      frozen = false;
    };
    let lot = rehash(base, input.fileHashes, now, 1);
    state.fileHashes.add(lotId, input.fileHashes);
    store(state, lot);
    #ok(toView(lot, input.fileHashes));
  };

  /// Append an event: increments seq, stamps canister time and caller,
  /// computes payloadHash, rebuilds contentHash, appends to hashChain.
  public func appendEvent(
    state : State,
    roles : RolesState,
    caller : Principal,
    lotId : Types.LotId,
    input : Types.NewEventInput,
  ) : Result.Result<Types.LotView, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.canAppendEvent(roles, caller, input.kind)) {
      return #err(#notAuthorized);
    };
    let lot = switch (state.lots.get(lotId)) {
      case (?lot) lot;
      case null { return #err(#unknownLot(lotId)) };
    };
    if (lot.frozen) {
      return #err(#lotFrozen(lotId));
    };
    let now = nowNs();
    let seq = lot.events.size() + 1;
    let event : Types.Event = {
      seq;
      kind = input.kind;
      at = now;
      by = caller;
      payload = input.payload;
      fileIds = input.fileIds;
      payloadHash = Hashing.computePayloadHash({
        kind = input.kind;
        payload = input.payload;
        fileContentHashes = input.fileHashes.map(func (fh : Types.FileHash) : Types.HashHex = fh.contentHash);
      });
    };
    let merged = mergeFileHashes(hashesOf(state, lotId), input.fileHashes);
    let withEvent : Types.Lot = {
      lot with
      events = lot.events.concat([event]);
      fileIds = lot.fileIds.concat(input.fileIds);
      status = statusAfter(lot.status, input.kind);
    };
    let updated = rehash(withEvent, merged, now, seq);
    state.fileHashes.add(lotId, merged);
    store(state, updated);
    #ok(toView(updated, merged));
  };

  /// The status a lot takes after an event of the given kind.
  func statusAfter(current : Types.LotStatus, kind : Types.EventKind) : Types.LotStatus {
    switch kind {
      case (#moved) #in_transit;
      case (#assay) #assayed;
      case (#retail) #retailed;
      case (_) current;
    };
  };

  /// Record a status change as a new provenance event in the lot's chain, with
  /// the actor, timestamp and resulting status. The caller's role must be
  /// permitted to make the transition; an unpermitted transition is rejected
  /// with `#notAuthorized`.
  public func changeStatus(
    state : State,
    roles : RolesState,
    caller : Principal,
    lotId : Types.LotId,
    input : Types.StatusChangeInput,
  ) : Result.Result<Types.LotView, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    let lot = switch (state.lots.get(lotId)) {
      case (?lot) lot;
      case null { return #err(#unknownLot(lotId)) };
    };
    if (lot.frozen) {
      return #err(#lotFrozen(lotId));
    };
    let role = RolesLib.roleOf(roles, caller);
    if (not canTransition(role, lot.status, input.to)) {
      return #err(#notAuthorized);
    };
    let now = nowNs();
    let seq = lot.events.size() + 1;
    let payload = if (input.payload == "") {
      "Status " # statusTag(lot.status) # " -> " # statusTag(input.to);
    } else {
      input.payload;
    };
    let event : Types.Event = {
      seq;
      kind = #status_change;
      at = now;
      by = caller;
      payload;
      fileIds = [];
      payloadHash = Hashing.computePayloadHash({ kind = #status_change; payload; fileContentHashes = [] });
    };
    let change : Types.StatusChange = {
      seq;
      from = lot.status;
      to = input.to;
      at = now;
      by = caller;
    };
    let withEvent : Types.Lot = {
      lot with
      events = lot.events.concat([event]);
      status = input.to;
      statusHistory = lot.statusHistory.concat([change]);
    };
    let updated = rehash(withEvent, hashesOf(state, lotId), now, seq);
    store(state, updated);
    #ok(toView(updated, hashesOf(state, lotId)));
  };

  /// The status-change history for a lot, in provenance order.
  public func statusHistory(state : State, lotId : Types.LotId) : [Types.StatusChange] {
    switch (state.lots.get(lotId)) {
      case (?lot) lot.statusHistory;
      case null [];
    };
  };

  /// Whether a role may make a status transition from `from` to `to`.
  /// Quality Tester (`#assayer`) may move Recently Mined (`#open`) and In
  /// Transit (`#in_transit`) to Testing Quality (`#assayed`); Custom Role
  /// (`#workshop`) may move Testing Quality to Applied for crafting
  /// (`#closed`), Retailed (`#retailed`) or Confiscated by Authorities
  /// (`#frozen`); an admin may perform any transition.
  public func canTransition(role : Types.Role, from : Types.LotStatus, to : Types.LotStatus) : Bool {
    switch role {
      case (#admin) { true };
      case (#assayer) {
        switch (from, to) {
          case (#open, #assayed) { true };
          case (#in_transit, #assayed) { true };
          case (_) { false };
        };
      };
      case (#workshop) {
        switch (from, to) {
          case (#assayed, #closed) { true };
          case (#assayed, #retailed) { true };
          case (#assayed, #frozen) { true };
          case (_) { false };
        };
      };
      case (_) { false };
    };
  };

  /// Split a lot: creates child lots with parentIds set and a split event on
  /// each child. Sources are never deleted.
  public func splitLot(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.SplitInput,
  ) : Result.Result<[Types.LotView], Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.canAppendEvent(roles, caller, #split)) {
      return #err(#notAuthorized);
    };
    let parent = switch (state.lots.get(input.parentId)) {
      case (?lot) lot;
      case null { return #err(#unknownLot(input.parentId)) };
    };
    if (parent.frozen) {
      return #err(#lotFrozen(input.parentId));
    };
    if (input.children.size() == 0) {
      return #err(#invalidInput("a split needs at least one child lot"));
    };
    for (child in input.children.values()) {
      if (not RolesLib.canCreateLot(roles, caller, child.lotType)) {
        return #err(#notAuthorized);
      };
    };
    let now = nowNs();
    var created : [Types.LotView] = [];
    for (child in input.children.values()) {
      let lotId = suggestLotId(state, child.site, dayOf(now));
      if (state.lots.get(lotId) != null) {
        return #err(#duplicateLot(lotId));
      };
      let event : Types.Event = {
        seq = 1;
        kind = #split;
        at = now;
        by = caller;
        payload = "Split from " # input.parentId;
        fileIds = child.fileIds;
        payloadHash = Hashing.computePayloadHash({
          kind = #split;
          payload = "Split from " # input.parentId;
          fileContentHashes = child.fileHashes.map(func (fh : Types.FileHash) : Types.HashHex = fh.contentHash);
        });
      };
      let base : Types.Lot = {
        id = lotId;
        lotType = child.lotType;
        licence = child.licence;
        project = child.project;
        gps = child.gps;
        workingRef = child.workingRef;
        openedAt = now;
        openedBy = caller;
        grossG = child.grossG;
        sealNo = child.sealNo;
        status = #open;
        parentIds = [input.parentId];
        photoFileIds = child.photoFileIds;
        fileIds = child.fileIds;
        contentHash = "";
        hashChain = [];
        events = [event];
        statusHistory = [];
        frozen = false;
      };
      let lot = rehash(base, child.fileHashes, now, 1);
      state.fileHashes.add(lotId, child.fileHashes);
      store(state, lot);
      created := created.concat([toView(lot, child.fileHashes)]);
    };
    #ok(created);
  };

  /// Merge: appends a merge event on the destination and a note on the source.
  public func mergeLots(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.MergeInput,
  ) : Result.Result<Types.LotView, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.canAppendEvent(roles, caller, #merge)) {
      return #err(#notAuthorized);
    };
    if (not RolesLib.canAppendEvent(roles, caller, #note)) {
      return #err(#notAuthorized);
    };
    if (input.sourceId == input.destinationId) {
      return #err(#invalidInput("a lot cannot be merged into itself"));
    };
    let source = switch (state.lots.get(input.sourceId)) {
      case (?lot) lot;
      case null { return #err(#unknownLot(input.sourceId)) };
    };
    let destination = switch (state.lots.get(input.destinationId)) {
      case (?lot) lot;
      case null { return #err(#unknownLot(input.destinationId)) };
    };
    if (source.frozen) {
      return #err(#lotFrozen(input.sourceId));
    };
    if (destination.frozen) {
      return #err(#lotFrozen(input.destinationId));
    };
    let now = nowNs();
    let note = if (input.payload == "") { "Merged into " # input.destinationId } else { input.payload };

    let sourceSeq = source.events.size() + 1;
    let sourceEvent : Types.Event = {
      seq = sourceSeq;
      kind = #note;
      at = now;
      by = caller;
      payload = note;
      fileIds = [];
      payloadHash = Hashing.computePayloadHash({ kind = #note; payload = note; fileContentHashes = [] });
    };
    let sourceWithEvent : Types.Lot = { source with events = source.events.concat([sourceEvent]) };
    let updatedSource = rehash(sourceWithEvent, hashesOf(state, input.sourceId), now, sourceSeq);
    store(state, updatedSource);

    let destSeq = destination.events.size() + 1;
    let destEvent : Types.Event = {
      seq = destSeq;
      kind = #merge;
      at = now;
      by = caller;
      payload = note;
      fileIds = [];
      payloadHash = Hashing.computePayloadHash({ kind = #merge; payload = note; fileContentHashes = [] });
    };
    let destWithEvent : Types.Lot = { destination with events = destination.events.concat([destEvent]) };
    let updatedDest = rehash(destWithEvent, hashesOf(state, input.destinationId), now, destSeq);
    store(state, updatedDest);
    #ok(toView(updatedDest, hashesOf(state, input.destinationId)));
  };

  /// Freeze a lot: sets frozen and status frozen; only a note by an admin is
  /// allowed afterwards.
  public func freezeLot(
    state : State,
    roles : RolesState,
    caller : Principal,
    lotId : Types.LotId,
  ) : Result.Result<Types.LotView, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    let lot = switch (state.lots.get(lotId)) {
      case (?lot) lot;
      case null { return #err(#unknownLot(lotId)) };
    };
    if (lot.frozen) {
      return #err(#lotFrozen(lotId));
    };
    let now = nowNs();
    let seq = lot.events.size() + 1;
    let event : Types.Event = {
      seq;
      kind = #note;
      at = now;
      by = caller;
      payload = "Lot frozen";
      fileIds = [];
      payloadHash = Hashing.computePayloadHash({ kind = #note; payload = "Lot frozen"; fileContentHashes = [] });
    };
    let withEvent : Types.Lot = {
      lot with
      events = lot.events.concat([event]);
      status = #frozen;
      frozen = true;
    };
    let updated = rehash(withEvent, hashesOf(state, lotId), now, seq);
    store(state, updated);
    #ok(toView(updated, hashesOf(state, lotId)));
  };

  /// List every lot in the register, newest first.
  public func listLots(state : State) : [Types.LotView] {
    let all = state.lots.values().toArray();
    let sorted = all.sort(func (a : Types.Lot, b : Types.Lot) : Order.Order {
      if (a.openedAt > b.openedAt) { #less } else if (a.openedAt < b.openedAt) { #greater } else { #equal };
    });
    sorted.map(func (lot : Types.Lot) : Types.LotView = toView(lot, hashesOf(state, lot.id)));
  };

  /// Fetch a single lot by id.
  public func getLot(state : State, lotId : Types.LotId) : ?Types.LotView {
    switch (state.lots.get(lotId)) {
      case (?lot) ?toView(lot, hashesOf(state, lotId));
      case null null;
    };
  };

  /// Search across lot id, content-hash prefix, seal number and working ref.
  public func searchLots(state : State, term : Text) : [Types.LotSearchHit] {
    let needle = term.trim(#predicate (func (c : Char) : Bool = c == ' ')).toLower();
    if (needle == "") {
      return [];
    };
    let hits = state.lots.values().filter(
      func (lot : Types.Lot) : Bool {
        lot.id.toLower().contains(#text needle)
        or lot.contentHash.toLower().startsWith(#text needle)
        or lot.sealNo.toLower().contains(#text needle)
        or lot.workingRef.toLower().contains(#text needle)
      }
    );
    hits.map(
      func (lot : Types.Lot) : Types.LotSearchHit {
        {
          id = lot.id;
          lotType = lot.lotType;
          status = lot.status;
          sealNo = lot.sealNo;
          workingRef = lot.workingRef;
          contentHash = lot.contentHash;
        };
      }
    ).toArray();
  };

  /// Aggregate register data for the home-page graph.
  public func registerSummary(state : State) : Types.RegisterSummary {
    let all = state.lots.values().toArray();
    var totalEvents = 0;
    for (lot in all.values()) {
      totalEvents += lot.events.size();
    };
    {
      totalLots = all.size();
      totalEvents;
      byType = bucketize(all, func (lot : Types.Lot) : Text = Hashing.lotTypeTag(lot.lotType));
      byStatus = bucketize(all, func (lot : Types.Lot) : Text = statusTag(lot.status));
      bySite = bucketize(all, func (lot : Types.Lot) : Text = siteOf(lot.id));
      activity = activityOf(all);
    };
  };

  /// Count lots grouped by a text key, sorted by key.
  func bucketize(lots : [Types.Lot], keyOf : Types.Lot -> Text) : [Types.CountBucket] {
    let counts = Map.empty<Text, Nat>();
    for (lot in lots.values()) {
      let key = keyOf(lot);
      counts.add(key, (counts.get(key) ?? 0) + 1);
    };
    let buckets = counts.entries().map(
      func ((key, count)) : Types.CountBucket = { key; count }
    ).toArray();
    buckets.sort(func (a : Types.CountBucket, b : Types.CountBucket) : Order.Order {
      if (a.key < b.key) { #less } else if (a.key > b.key) { #greater } else { #equal };
    });
  };

  /// Event counts per day, oldest first.
  func activityOf(lots : [Types.Lot]) : [Types.ActivityPoint] {
    let counts = Map.empty<Text, Nat>();
    for (lot in lots.values()) {
      for (event in lot.events.values()) {
        let day = dayOf(event.at);
        counts.add(day, (counts.get(day) ?? 0) + 1);
      };
    };
    let points = counts.entries().map(
      func ((day, count)) : Types.ActivityPoint = { day; count }
    ).toArray();
    points.sort(func (a : Types.ActivityPoint, b : Types.ActivityPoint) : Order.Order {
      if (a.day < b.day) { #less } else if (a.day > b.day) { #greater } else { #equal };
    });
  };

  /// Rebuild the canonical snapshot for a lot from its current fields plus all
  /// files ever attached to the lot and its events.
  public func rebuildSnapshot(lot : Types.Lot, fileHashes : [Types.FileHash]) : Types.CanonicalSnapshot {
    snapshotOf(lot, fileHashes);
  };

  /// Canonical snapshot JSON for a stored lot, built through the same snapshot
  /// path the register hashes, so a client can recompute the contentHash.
  public func canonicalSnapshotJson(state : State, lotId : Types.LotId) : ?Text {
    switch (state.lots.get(lotId)) {
      case (?lot) ?Hashing.canonicalSnapshotJson(snapshotOf(lot, hashesOf(state, lotId)));
      case null null;
    };
  };

  /// Recompute a lot's contentHash and append { at, eventSeq, contentHash } to
  /// its hash chain, preserving prior hashes.
  public func rehashLot(lot : Types.Lot, fileHashes : [Types.FileHash], at : Types.Timestamp, eventSeq : Nat) : Types.Lot {
    rehash(lot, fileHashes, at, eventSeq);
  };

  /// Project an internal lot to its public view, marking superseded events.
  /// `fileHashes` are the persisted per-file content hashes for the lot.
  public func toView(lot : Types.Lot, fileHashes : [Types.FileHash]) : Types.LotView {
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
      fileHashes;
      contentHash = lot.contentHash;
      hashChain = lot.hashChain;
      statusHistory = lot.statusHistory;
      events = lot.events.map(
        func (event : Types.Event) : Types.EventView {
          {
            seq = event.seq;
            kind = event.kind;
            at = event.at;
            by = event.by;
            payload = event.payload;
            fileIds = event.fileIds;
            payloadHash = event.payloadHash;
            supersededBy = supersededBy(lot.events, event.seq);
          }
        }
      );
      frozen = lot.frozen;
    };
  };

  /// The seq of the later correction event that points at `seq`, if any.
  /// A correction supersedes the event whose seq appears in its payload as
  /// "corrects #<seq>"; the earliest such correction wins.
  func supersededBy(events : [Types.Event], seq : Nat) : ?Nat {
    let marker = "corrects #" # seq.toText();
    var found : ?Nat = null;
    for (event in events.values()) {
      if (event.kind == #correction and event.seq > seq and event.payload.contains(#text marker)) {
        switch found {
          case null { found := ?event.seq };
          case (?existing) {
            if (event.seq < existing) { found := ?event.seq };
          };
        };
      };
    };
    found;
  };

  /// The canister clock in nanoseconds.
  func nowNs() : Types.Timestamp {
    Time.now();
  };
};
