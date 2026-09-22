/// Public API for the admin panel's Permissions section.
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types/permissions";
import PermissionsLib "../lib/permissions";
import RolesLib "../lib/roles";

mixin (
  permissionsState : PermissionsLib.State,
  rolesState : RolesLib.State,
) {
  /// The full Permissions section. Admin only.
  public query ({ caller }) func getPermissions() : async Result.Result<Types.PermissionsView, Types.PermissionsError> {
    PermissionsLib.permissionsView(permissionsState, rolesState, caller);
  };

  /// The calling principal's effective capabilities.
  public query ({ caller }) func getMyCapabilities() : async [Types.Capability] {
    PermissionsLib.effectiveCapabilities(permissionsState, rolesState, caller);
  };

  /// Edit a role's default permission set. Admin only.
  public shared ({ caller }) func updateRolePermissions(input : Types.UpdateRolePermissionsInput) : async Result.Result<Types.RolePermissions, Types.PermissionsError> {
    PermissionsLib.updateRolePermissions(permissionsState, rolesState, caller, input);
  };

  /// Set a per-principal permission override for a role. Admin only.
  public shared ({ caller }) func setPrincipalOverride(input : Types.SetPrincipalOverrideInput) : async Result.Result<Types.PrincipalOverride, Types.PermissionsError> {
    PermissionsLib.setPrincipalOverride(permissionsState, rolesState, caller, input);
  };

  /// Remove a per-principal permission override. Admin only.
  public shared ({ caller }) func removePrincipalOverride(target : Principal) : async Result.Result<(), Types.PermissionsError> {
    PermissionsLib.removePrincipalOverride(permissionsState, rolesState, caller, target);
  };
};
