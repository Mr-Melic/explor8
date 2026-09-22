/// Domain logic for the admin panel's Permissions section.
///
/// Admin holds all permissions by default; Custom Role starts with none.
/// Admins can edit the default permissions for each role and set per-principal
/// permission overrides for any role.
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types/permissions";
import RegisterTypes "../types/register";
import RolesLib "roles";

module {
  /// The permission state shared with the API mixin. Role defaults are keyed
  /// by the role's canonical tag text.
  public type State = {
    roleDefaults : Map.Map<Text, [Types.Capability]>;
    overrides : Map.Map<Principal, Types.PrincipalOverride>;
  };

  /// The role state, needed to authorize permission mutations.
  public type RolesState = RolesLib.State;

  /// Every capability, in display order.
  public func allCapabilities() : [Types.Capability] {
    [
      #create_lot,
      #append_event,
      #change_status,
      #split_lot,
      #merge_lot,
      #freeze_lot,
      #manage_reference_data,
      #manage_analysis_documents,
      #manage_roles,
      #view_analytics,
      #purge_register,
      #delete_lot,
    ];
  };

  /// The canonical tag text for a capability.
  public func capabilityTag(capability : Types.Capability) : Text {
    switch capability {
      case (#create_lot) "create_lot";
      case (#append_event) "append_event";
      case (#change_status) "change_status";
      case (#split_lot) "split_lot";
      case (#merge_lot) "merge_lot";
      case (#freeze_lot) "freeze_lot";
      case (#manage_reference_data) "manage_reference_data";
      case (#manage_analysis_documents) "manage_analysis_documents";
      case (#manage_roles) "manage_roles";
      case (#view_analytics) "view_analytics";
      case (#purge_register) "purge_register";
      case (#delete_lot) "delete_lot";
    };
  };

  /// The human-readable label for a capability.
  public func capabilityLabel(capability : Types.Capability) : Text {
    switch capability {
      case (#create_lot) "Register a block";
      case (#append_event) "Append a provenance event";
      case (#change_status) "Change a block's status";
      case (#split_lot) "Split a block";
      case (#merge_lot) "Merge blocks";
      case (#freeze_lot) "Confiscate a block";
      case (#manage_reference_data) "Manage reference data";
      case (#manage_analysis_documents) "Manage analysis documents";
      case (#manage_roles) "Manage roles and actors";
      case (#view_analytics) "View analytics";
      case (#purge_register) "Purge all register data";
      case (#delete_lot) "Delete a block";
    };
  };

  /// The canonical tag text for a role, used to key the role-default map.
  public func roleTag(role : RegisterTypes.Role) : Text {
    switch role {
      case (#guest) "guest";
      case (#field_officer) "field_officer";
      case (#assayer) "assayer";
      case (#workshop) "workshop";
      case (#admin) "admin";
    };
  };

  /// The built-in default permission set for a role. Admin holds every
  /// capability; every other role, including Custom Role (`#workshop`), starts
  /// with none.
  public func defaultCapabilities(role : RegisterTypes.Role) : [Types.Capability] {
    switch role {
      case (#admin) allCapabilities();
      case (_) [];
    };
  };

  /// The stored default permission set for a role, falling back to the
  /// built-in defaults when the role has no stored entry.
  public func roleDefaults(state : State, role : RegisterTypes.Role) : [Types.Capability] {
    state.roleDefaults.get(roleTag(role)) ?? defaultCapabilities(role);
  };

  /// The effective permission set for a principal: its per-principal override
  /// when one exists, otherwise the default set for its role.
  public func effectiveCapabilities(state : State, roles : RolesState, caller : Principal) : [Types.Capability] {
    switch (state.overrides.get(caller)) {
      case (?override) override.capabilities;
      case null roleDefaults(state, RolesLib.roleOf(roles, caller));
    };
  };

  /// Whether a principal may perform a capability.
  public func can(state : State, roles : RolesState, caller : Principal, capability : Types.Capability) : Bool {
    effectiveCapabilities(state, roles, caller).any(func c = c == capability);
  };

  /// The full Permissions section: every capability with who can do it, the
  /// role defaults, and the per-principal overrides. Admin only.
  public func permissionsView(
    state : State,
    roles : RolesState,
    caller : Principal,
  ) : Result.Result<Types.PermissionsView, Types.PermissionsError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    let capabilities = allCapabilities().map(
      func (capability : Types.Capability) : Types.CapabilityRow {
        {
          capability;
          displayName = capabilityLabel(capability);
          roles = RolesLib.allRoles().filter(
            func (role : RegisterTypes.Role) : Bool = roleDefaults(state, role).any(func c = c == capability)
          );
        };
      }
    );
    let roleDefaultRows = RolesLib.allRoles().map(
      func (role : RegisterTypes.Role) : Types.RolePermissions {
        { role; capabilities = roleDefaults(state, role) };
      }
    );
    let overrides = state.overrides.values().toArray();
    #ok({ capabilities; roleDefaults = roleDefaultRows; overrides });
  };

  /// Edit a role's default permission set. Admin only.
  public func updateRolePermissions(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.UpdateRolePermissionsInput,
  ) : Result.Result<Types.RolePermissions, Types.PermissionsError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    state.roleDefaults.add(roleTag(input.role), input.capabilities);
    #ok({ role = input.role; capabilities = input.capabilities });
  };

  /// Set a per-principal permission override for a role. Admin only.
  public func setPrincipalOverride(
    state : State,
    roles : RolesState,
    caller : Principal,
    input : Types.SetPrincipalOverrideInput,
  ) : Result.Result<Types.PrincipalOverride, Types.PermissionsError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    if (input.principal.isAnonymous()) {
      return #err(#unknownPrincipal(input.principal));
    };
    let override : Types.PrincipalOverride = {
      principal = input.principal;
      role = input.role;
      capabilities = input.capabilities;
    };
    state.overrides.add(input.principal, override);
    #ok(override);
  };

  /// Remove a per-principal permission override. Admin only.
  public func removePrincipalOverride(
    state : State,
    roles : RolesState,
    caller : Principal,
    target : Principal,
  ) : Result.Result<(), Types.PermissionsError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not RolesLib.isAdmin(roles, caller)) {
      return #err(#notAuthorized);
    };
    state.overrides.remove(target);
    #ok(());
  };
};
