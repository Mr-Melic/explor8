/// Types for admin-managed reference data, register analytics and uploaded
/// analysis documents.
///
/// Reference data is runtime data, not a compile-time variant: the register's
/// forms and displays are driven by the entries an administrator maintains, so
/// lot kinds, site names, statuses, event kinds, labels and form defaults can
/// all be added, edited and removed without a canister upgrade.
module {
  /// Canister timestamp in nanoseconds (never a client clock).
  public type Timestamp = Int;

  /// SHA-256 digest rendered as 64 lowercase hex characters.
  public type HashHex = Text;

  /// A file-storage identifier for an uploaded document or photo.
  public type FileId = Text;

  /// The category a reference entry belongs to.
  ///
  /// `#status_explanation` carries one entry per lot status whose `key` is the
  /// stable status key and whose `value` is the explanation text shown in the
  /// home page's per-status information panel. `#enquiry_destination` carries
  /// at most one entry whose `value` is the optional destination email for
  /// purchase enquiries; when no such entry exists no enquiry email is sent.
  public type RefKind = {
    #lot_kind;
    #site;
    #status;
    #event_kind;
    #caption;
    #form_default;
    #status_explanation;
    #enquiry_destination;
  };

  /// One admin-managed reference entry.
  public type RefEntry = {
    id : Text;
    kind : RefKind;
    key : Text;
    displayName : Text;
    value : Text;
    sortOrder : Nat;
    active : Bool;
  };

  /// A reference entry as returned to the frontend.
  public type RefEntryView = {
    id : Text;
    kind : RefKind;
    key : Text;
    displayName : Text;
    value : Text;
    sortOrder : Nat;
    active : Bool;
  };

  /// An uploaded analysis document (assay report, spreadsheet) held for review.
  public type AnalysisDocument = {
    id : Text;
    title : Text;
    docKind : Text;
    fileId : FileId;
    contentHash : HashHex;
    uploadedAt : Timestamp;
    uploadedBy : Principal;
    note : Text;
  };

  /// An analysis document as returned to the frontend.
  public type AnalysisDocumentView = {
    id : Text;
    title : Text;
    docKind : Text;
    fileId : FileId;
    contentHash : HashHex;
    uploadedAt : Timestamp;
    uploadedBy : Principal;
    note : Text;
  };

  /// One day of register activity.
  public type AnalyticsPoint = {
    day : Text;
    lots : Nat;
    events : Nat;
  };

  /// A count grouped by one dimension.
  public type AnalyticsBucket = {
    key : Text;
    count : Nat;
  };

  /// The register's own live analytics for the admin panel.
  public type RegisterAnalytics = {
    totalLots : Nat;
    totalEvents : Nat;
    lotsOverTime : [AnalyticsPoint];
    eventsOverTime : [AnalyticsPoint];
    byKind : [AnalyticsBucket];
    byStatus : [AnalyticsBucket];
    bySite : [AnalyticsBucket];
  };

  /// Errors returned by reference-data and analysis-document mutations.
  public type ReferenceError = {
    #notAuthenticated;
    #notAuthorized;
    #unknownEntry : Text;
    #unknownDocument : Text;
    #duplicateEntry : Text;
    #invalidInput : Text;
  };

  /// Input for adding a reference entry.
  public type NewRefEntryInput = {
    kind : RefKind;
    key : Text;
    displayName : Text;
    value : Text;
    sortOrder : Nat;
  };

  /// Input for editing a reference entry.
  public type UpdateRefEntryInput = {
    id : Text;
    displayName : Text;
    value : Text;
    sortOrder : Nat;
    active : Bool;
  };

  /// Input for storing an analysis document.
  public type NewAnalysisDocumentInput = {
    title : Text;
    docKind : Text;
    fileId : FileId;
    contentHash : HashHex;
    note : Text;
  };
};
