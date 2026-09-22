/// Types for the admin-only "Purge all register data" workflow.
///
/// A purge is a two-phase, multi-admin action: one admin requests it by typing
/// the exact confirmation phrase, and the purge executes automatically once
/// more than half of the currently-assigned admins have confirmed the same
/// request. The request is closed once it executes.
module {
  /// Canister timestamp in nanoseconds (never a client clock).
  public type Timestamp = Int;

  /// The exact phrase a requesting admin must type to open a purge request.
  public let confirmationPhrase : Text = "DeLeTe ALL DATA";

  /// One admin's confirmation of a pending purge request.
  public type PurgeConfirmation = {
    admin : Principal;
    at : Timestamp;
  };

  /// A pending purge request awaiting the remaining admins' confirmations.
  public type PurgeRequest = {
    id : Text;
    requestedBy : Principal;
    requestedAt : Timestamp;
    confirmations : [PurgeConfirmation];
    requiredConfirmations : Nat;
  };

  /// A purge request as returned to the frontend, with the live progress a
  /// requesting admin sees while awaiting the remaining admins.
  public type PurgeRequestView = {
    id : Text;
    requestedBy : Principal;
    requestedAt : Timestamp;
    confirmedBy : [Principal];
    confirmedCount : Nat;
    requiredConfirmations : Nat;
    totalAdmins : Nat;
  };

  /// The outcome of a purge request or confirmation call.
  public type PurgeOutcome = {
    /// The request is still awaiting confirmations.
    #pending : PurgeRequestView;
    /// The purge executed; the register is now empty.
    #executed : PurgeResult;
  };

  /// What a completed purge removed.
  public type PurgeResult = {
    lotsRemoved : Nat;
    eventsRemoved : Nat;
    filesRemoved : Nat;
    purgedAt : Timestamp;
    purgedBy : Principal;
  };

  /// Errors returned by the purge workflow.
  public type PurgeError = {
    #notAuthenticated;
    #notAuthorized;
    #noPendingRequest;
    #alreadyRequested;
    #alreadyConfirmed;
    #invalidPhrase;
    #invalidInput : Text;
  };
};
