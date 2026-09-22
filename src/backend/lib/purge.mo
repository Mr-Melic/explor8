/// Domain logic for the admin-only "Purge all register data" workflow.
///
/// The purge clears every block, its events, its hash chain and its
/// block-derived supporting files. It preserves roles and actors, and it
/// preserves all reference data (lot kinds, sites, statuses, event kinds,
/// labels, defaults).
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Types "../types/purge";
import RegisterLib "register";
import RolesLib "roles";

module {
  /// The purge state shared with the API mixin.
  public type State = {
    var nextRequestSeq : Nat;
    var pending : ?Types.PurgeRequest;
  };

  /// The register state a purge clears.
  public type RegisterState = RegisterLib.State;

  /// The role state a purge reads to count currently-assigned admins.
  public type RolesState = RolesLib.State;

  /// The number of admins currently assigned a role.
  public func adminCount(roles : RolesState) : Nat {
    RolesLib.admins(roles).size();
  };

  /// The number of confirmations a purge request needs: more than half of the
  /// currently-assigned admins.
  public func requiredConfirmations(roles : RolesState) : Nat {
    adminCount(roles) / 2 + 1;
  };

  /// Project a pending request to its public view.
  public func toView(request : Types.PurgeRequest, roles : RolesState) : Types.PurgeRequestView {
    {
      id = request.id;
      requestedBy = request.requestedBy;
      requestedAt = request.requestedAt;
      confirmedBy = request.confirmations.map(func (c : Types.PurgeConfirmation) : Principal = c.admin);
      confirmedCount = request.confirmations.size();
      requiredConfirmations = request.requiredConfirmations;
      totalAdmins = adminCount(roles);
    };
  };

  /// The pending purge request, if one is open.
  public func pendingRequest(state : State, roles : RolesState) : ?Types.PurgeRequestView {
    switch (state.pending) {
      case (?request) ?toView(request, roles);
      case null null;
    };
  };

  /// Open a purge request. Admin only. The confirmation phrase must match
  /// `Types.confirmationPhrase` verbatim; any other text is rejected with
  /// `#invalidPhrase`. The requesting admin counts as the first confirmation.
  public func requestPurge(
    state : State,
    register : RegisterState,
    roles : RolesState,
    caller : Principal,
    phrase : Text,
  ) : Result.Result<Types.PurgeOutcome, Types.PurgeError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    if (phrase != Types.confirmationPhrase) {
      return #err(#invalidPhrase);
    };
    if (state.pending != null) {
      return #err(#alreadyRequested);
    };
    let now = Time.now();
    let id = "purge-" # state.nextRequestSeq.toText();
    state.nextRequestSeq += 1;
    let request : Types.PurgeRequest = {
      id;
      requestedBy = caller;
      requestedAt = now;
      confirmations = [{ admin = caller; at = now }];
      requiredConfirmations = requiredConfirmations(roles);
    };
    if (request.confirmations.size() >= request.requiredConfirmations) {
      let result = executePurge(state, register, caller);
      return #ok(#executed(result));
    };
    state.pending := ?request;
    #ok(#pending(toView(request, roles)));
  };

  /// Confirm the open purge request. Admin only. When the confirmation count
  /// exceeds half of the currently-assigned admins the purge executes
  /// automatically and the request is closed.
  public func confirmPurge(
    state : State,
    register : RegisterState,
    roles : RolesState,
    caller : Principal,
  ) : Result.Result<Types.PurgeOutcome, Types.PurgeError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    let request = switch (state.pending) {
      case (?request) request;
      case null { return #err(#noPendingRequest) };
    };
    if (request.confirmations.any(func (c : Types.PurgeConfirmation) : Bool = c.admin == caller)) {
      return #err(#alreadyConfirmed);
    };
    let now = Time.now();
    let updated : Types.PurgeRequest = {
      request with
      confirmations = request.confirmations.concat([{ admin = caller; at = now }]);
    };
    if (updated.confirmations.size() >= updated.requiredConfirmations) {
      let result = executePurge(state, register, caller);
      return #ok(#executed(result));
    };
    state.pending := ?updated;
    #ok(#pending(toView(updated, roles)));
  };

  /// Clear every block, its events, its hash chain and its block-derived
  /// supporting files from the register. Roles, actors and reference data are
  /// untouched.
  public func executePurge(
    state : State,
    register : RegisterState,
    caller : Principal,
  ) : Types.PurgeResult {
    var lotsRemoved = 0;
    var eventsRemoved = 0;
    var filesRemoved = 0;
    for (lot in register.lots.values()) {
      lotsRemoved += 1;
      eventsRemoved += lot.events.size();
      filesRemoved += lot.fileIds.size() + lot.photoFileIds.size();
    };
    RegisterLib.clear(register);
    state.pending := null;
    {
      lotsRemoved;
      eventsRemoved;
      filesRemoved;
      purgedAt = Time.now();
      purgedBy = caller;
    };
  };
};
