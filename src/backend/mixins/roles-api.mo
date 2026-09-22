/// Public API for role assignment and the admin actor list.
import Result "mo:core/Result";
import Types "../types/register";
import RolesLib "../lib/roles";

mixin (
  rolesState : RolesLib.State,
) {
  /// The first identity that claims admin becomes admin.
  public shared ({ caller }) func claimAdmin() : async Result.Result<Types.Role, Types.RegisterError> {
    RolesLib.claimAdmin(rolesState, caller);
  };

  /// Assign a role to a principal. Admin only.
  public shared ({ caller }) func assignRole(target : Principal, role : Types.Role) : async Result.Result<Types.ActorRole, Types.RegisterError> {
    RolesLib.assignRole(rolesState, caller, target, role);
  };

  /// The role of the calling principal.
  public query ({ caller }) func getMyRole() : async Types.Role {
    RolesLib.roleOf(rolesState, caller);
  };

  /// The human-readable display name for a role. 'Assayer' reads
  /// 'Quality Tester' and 'Workshop' reads 'Custom Role'.
  public query func roleDisplayName(role : Types.Role) : async Text {
    RolesLib.roleDisplayName(role);
  };

  /// Every role with its display name, for the admin panel.
  public query func listRoles() : async [Types.RoleInfo] {
    RolesLib.allRoles().map(
      func (role : Types.Role) : Types.RoleInfo = { role; displayName = RolesLib.roleDisplayName(role) }
    );
  };

  /// Whether an administrator already exists. Public and non-sensitive: it
  /// lets the frontend hide the claim action once the role has been claimed.
  public query func hasAdmin() : async Bool {
    RolesLib.hasAdmin(rolesState);
  };

  /// List every actor with its principal and role. Admin only.
  public query ({ caller }) func listActors() : async Result.Result<[Types.ActorRole], Types.RegisterError> {
    RolesLib.listActors(rolesState, caller);
  };
};
