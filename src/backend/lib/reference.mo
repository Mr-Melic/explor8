/// Domain logic for admin-managed reference data, register analytics and
/// uploaded analysis documents.
import Map "mo:core/Map";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Types "../types/reference";
import RegisterTypes "../types/register";
import RegisterLib "register";
import RolesLib "roles";

module {
  /// The reference-data state shared with the API mixin.
  public type State = {
    var nextEntrySeq : Nat;
    var nextDocSeq : Nat;
    entries : Map.Map<Text, Types.RefEntry>;
    documents : Map.Map<Text, Types.AnalysisDocument>;
  };

  /// The role state, needed to authorize reference-data mutations.
  public type RolesState = RolesLib.State;

  /// The register state, needed to compute live analytics.
  public type RegisterState = RegisterLib.State;

  /// The canonical tag text for a reference kind, used to order entries.
  func kindTag(kind : Types.RefKind) : Text {
    switch kind {
      case (#lot_kind) "lot_kind";
      case (#site) "site";
      case (#status) "status";
      case (#event_kind) "event_kind";
      case (#caption) "caption";
      case (#form_default) "form_default";
    };
  };

  /// Project an internal entry to its public view.
  func toView(entry : Types.RefEntry) : Types.RefEntryView {
    {
      id = entry.id;
      kind = entry.kind;
      key = entry.key;
      displayName = entry.displayName;
      value = entry.value;
      sortOrder = entry.sortOrder;
      active = entry.active;
    };
  };

  /// Project an internal document to its public view.
  func toDocView(doc : Types.AnalysisDocument) : Types.AnalysisDocumentView {
    {
      id = doc.id;
      title = doc.title;
      docKind = doc.docKind;
      fileId = doc.fileId;
      contentHash = doc.contentHash;
      uploadedAt = doc.uploadedAt;
      uploadedBy = doc.uploadedBy;
      note = doc.note;
    };
  };

  /// Order two entries by kind, then sortOrder, then id.
  func compareEntries(a : Types.RefEntry, b : Types.RefEntry) : Order.Order {
    let ka = kindTag(a.kind);
    let kb = kindTag(b.kind);
    if (ka < kb) { return #less };
    if (ka > kb) { return #greater };
    if (a.sortOrder < b.sortOrder) { return #less };
    if (a.sortOrder > b.sortOrder) { return #greater };
    if (a.id < b.id) { return #less };
    if (a.id > b.id) { return #greater };
    #equal;
  };

  /// Order two documents newest first, then by id.
  func compareDocs(a : Types.AnalysisDocument, b : Types.AnalysisDocument) : Order.Order {
    if (a.uploadedAt > b.uploadedAt) { return #less };
    if (a.uploadedAt < b.uploadedAt) { return #greater };
    if (a.id < b.id) { return #less };
    if (a.id > b.id) { return #greater };
    #equal;
  };

  /// Whether the caller is a signed-in admin.
  func requireAdmin(roles : RolesState, caller : Principal) : ?Types.ReferenceError {
    if (caller.isAnonymous()) {
      return ?#notAuthenticated;
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return ?#notAuthorized;
    };
    null;
  };

  /// List the active reference entries of one kind, ordered by sortOrder.
  public func listEntries(state : State, kind : Types.RefKind) : [Types.RefEntryView] {
    let matching = state.entries.values().filter(
      func (entry : Types.RefEntry) : Bool = entry.kind == kind and entry.active
    );
    let sorted = matching.toArray().sort(compareEntries);
    sorted.map(func (entry : Types.RefEntry) : Types.RefEntryView = toView(entry));
  };

  /// List every reference entry, ordered by kind then sortOrder. Admin only.
  public func listAllEntries(state : State, roles : RolesState, caller : Principal) : Result.Result<[Types.RefEntryView], Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let sorted = state.entries.values().toArray().sort(compareEntries);
    #ok(sorted.map(func (entry : Types.RefEntry) : Types.RefEntryView = toView(entry)));
  };

  /// Add a reference entry. Admin only.
  public func addEntry(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.NewRefEntryInput,
  ) : Result.Result<Types.RefEntryView, Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let key = input.key.trim(#predicate (func (c : Char) : Bool = c == ' '));
    if (key == "") {
      return #err(#invalidInput("a reference entry needs a key"));
    };
    let displayName = input.displayName.trim(#predicate (func (c : Char) : Bool = c == ' '));
    if (displayName == "") {
      return #err(#invalidInput("a reference entry needs a display name"));
    };
    for (entry in state.entries.values()) {
      if (entry.kind == input.kind and entry.key == key) {
        return #err(#duplicateEntry(key));
      };
    };
    state.nextEntrySeq += 1;
    let id = "ref-" # state.nextEntrySeq.toText();
    let entry : Types.RefEntry = {
      id;
      kind = input.kind;
      key;
      displayName;
      value = input.value;
      sortOrder = input.sortOrder;
      active = true;
    };
    state.entries.add(id, entry);
    #ok(toView(entry));
  };

  /// Edit a reference entry. Admin only.
  public func updateEntry(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.UpdateRefEntryInput,
  ) : Result.Result<Types.RefEntryView, Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let existing = switch (state.entries.get(input.id)) {
      case (?entry) entry;
      case null { return #err(#unknownEntry(input.id)) };
    };
    let displayName = input.displayName.trim(#predicate (func (c : Char) : Bool = c == ' '));
    if (displayName == "") {
      return #err(#invalidInput("a reference entry needs a display name"));
    };
    let updated : Types.RefEntry = {
      existing with
      displayName;
      value = input.value;
      sortOrder = input.sortOrder;
      active = input.active;
    };
    state.entries.add(input.id, updated);
    #ok(toView(updated));
  };

  /// Remove a reference entry. Admin only.
  public func removeEntry(
    state : State,
    roles : RolesState,
    caller : Principal,
    id : Text,
  ) : Result.Result<(), Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    if (state.entries.get(id) == null) {
      return #err(#unknownEntry(id));
    };
    state.entries.remove(id);
    #ok(());
  };

  /// List the stored analysis documents, newest first. Admin only.
  public func listDocuments(state : State, roles : RolesState, caller : Principal) : Result.Result<[Types.AnalysisDocumentView], Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let sorted = state.documents.values().toArray().sort(compareDocs);
    #ok(sorted.map(func (doc : Types.AnalysisDocument) : Types.AnalysisDocumentView = toDocView(doc)));
  };

  /// Store an analysis document. Admin only.
  public func addDocument(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.NewAnalysisDocumentInput,
  ) : Result.Result<Types.AnalysisDocumentView, Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let title = input.title.trim(#predicate (func (c : Char) : Bool = c == ' '));
    if (title == "") {
      return #err(#invalidInput("an analysis document needs a title"));
    };
    if (input.fileId == "") {
      return #err(#invalidInput("an analysis document needs a file id"));
    };
    state.nextDocSeq += 1;
    let id = "doc-" # state.nextDocSeq.toText();
    let doc : Types.AnalysisDocument = {
      id;
      title;
      docKind = input.docKind;
      fileId = input.fileId;
      contentHash = input.contentHash;
      uploadedAt = Time.now();
      uploadedBy = caller;
      note = input.note;
    };
    state.documents.add(id, doc);
    #ok(toDocView(doc));
  };

  /// Remove an analysis document. Admin only.
  public func removeDocument(
    state : State,
    roles : RolesState,
    caller : Principal,
    id : Text,
  ) : Result.Result<(), Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    if (state.documents.get(id) == null) {
      return #err(#unknownDocument(id));
    };
    state.documents.remove(id);
    #ok(());
  };

  /// The register's own live analytics. Admin only.
  public func registerAnalytics(
    register : RegisterState,
    roles : RolesState,
    caller : Principal,
  ) : Result.Result<Types.RegisterAnalytics, Types.ReferenceError> {
    switch (requireAdmin(roles, caller)) {
      case (?err) { return #err(err) };
      case null {};
    };
    let lots = register.lots.values().toArray();
    var totalEvents = 0;
    let lotCounts = Map.empty<Text, Nat>();
    let eventCounts = Map.empty<Text, Nat>();
    let kindCounts = Map.empty<Text, Nat>();
    let statusCounts = Map.empty<Text, Nat>();
    let siteCounts = Map.empty<Text, Nat>();
    for (lot in lots.values()) {
      totalEvents += lot.events.size();
      let day = RegisterLib.dayOf(lot.openedAt);
      lotCounts.add(day, (lotCounts.get(day) ?? 0) + 1);
      let kind = RegisterLib.lotTypeTag(lot.lotType);
      kindCounts.add(kind, (kindCounts.get(kind) ?? 0) + 1);
      let status = RegisterLib.statusTag(lot.status);
      statusCounts.add(status, (statusCounts.get(status) ?? 0) + 1);
      let site = RegisterLib.siteOf(lot.id);
      siteCounts.add(site, (siteCounts.get(site) ?? 0) + 1);
      for (event in lot.events.values()) {
        let eventDay = RegisterLib.dayOf(event.at);
        eventCounts.add(eventDay, (eventCounts.get(eventDay) ?? 0) + 1);
      };
    };
    let points = pointsOf(lotCounts, eventCounts);
    #ok({
      totalLots = lots.size();
      totalEvents;
      lotsOverTime = points;
      eventsOverTime = points;
      byKind = bucketsOf(kindCounts);
      byStatus = bucketsOf(statusCounts);
      bySite = bucketsOf(siteCounts);
    });
  };

  /// Per-day analytics points, oldest first. Each point carries the genuine
  /// number of lots registered that day and the genuine number of events
  /// recorded that day, so the two series stay independent.
  func pointsOf(lotCounts : Map.Map<Text, Nat>, eventCounts : Map.Map<Text, Nat>) : [Types.AnalyticsPoint] {
    let days = Map.empty<Text, ()>();
    for (day in lotCounts.keys()) {
      days.add(day, ());
    };
    for (day in eventCounts.keys()) {
      days.add(day, ());
    };
    let points = days.keys().map(
      func (day : Text) : Types.AnalyticsPoint = {
        day;
        lots = lotCounts.get(day) ?? 0;
        events = eventCounts.get(day) ?? 0;
      }
    ).toArray();
    points.sort(func (a : Types.AnalyticsPoint, b : Types.AnalyticsPoint) : Order.Order {
      if (a.day < b.day) { #less } else if (a.day > b.day) { #greater } else { #equal };
    });
  };

  /// Counts grouped by a text key, sorted by key.
  func bucketsOf(counts : Map.Map<Text, Nat>) : [Types.AnalyticsBucket] {
    let buckets = counts.entries().map(
      func ((key, count)) : Types.AnalyticsBucket = { key; count }
    ).toArray();
    buckets.sort(func (a : Types.AnalyticsBucket, b : Types.AnalyticsBucket) : Order.Order {
      if (a.key < b.key) { #less } else if (a.key > b.key) { #greater } else { #equal };
    });
  };
};
