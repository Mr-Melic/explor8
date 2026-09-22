/// Public API for the admin-only "Purge all register data" workflow.
import Result "mo:core/Result";
import Types "../types/purge";
import PurgeLib "../lib/purge";
import RegisterLib "../lib/register";
import RolesLib "../lib/roles";

mixin (
  purgeState : PurgeLib.State,
  registerState : RegisterLib.State,
  rolesState : RolesLib.State,
) {
  /// The open purge request and its confirmation progress, if any. Admin only.
  public query ({ caller }) func getPurgeRequest() : async Result.Result<?Types.PurgeRequestView, Types.PurgeError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(rolesState, caller)) {
      return #err(#notAuthorized);
    };
    #ok(PurgeLib.pendingRequest(purgeState, rolesState));
  };

  /// Open a purge request. Admin only. The phrase must be typed verbatim.
  public shared ({ caller }) func requestPurge(phrase : Text) : async Result.Result<Types.PurgeOutcome, Types.PurgeError> {
    PurgeLib.requestPurge(purgeState, registerState, rolesState, caller, phrase);
  };

  /// Confirm the open purge request. Admin only. Executes automatically once
  /// more than half of the currently-assigned admins have confirmed.
  public shared ({ caller }) func confirmPurge() : async Result.Result<Types.PurgeOutcome, Types.PurgeError> {
    PurgeLib.confirmPurge(purgeState, registerState, rolesState, caller);
  };
};
