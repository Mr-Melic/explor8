/// Types for the admin panel's Permissions section.
///
/// Every app capability is a `Capability`; each role has a default permission
/// set, and an admin may set a per-principal override for any role. Admin holds
/// all permissions by default; Custom Role starts with none.
import Common "common";

module {
  /// A role, as defined by the register's role model.
  public type Role = Common.Role;

  /// Every capability the app exposes, as listed in the admin Permissions
  /// section.
  public type Capability = {
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

  /// The permission set for one role: the capabilities it may perform.
  public type RolePermissions = {
    role : Role;
    capabilities : [Capability];
  };

  /// A per-principal override of a role's default permission set.
  public type PrincipalOverride = {
    principal : Principal;
    role : Role;
    capabilities : [Capability];
  };

  /// One row of the Permissions section: a capability and who can do it.
  public type CapabilityRow = {
    capability : Capability;
    displayName : Text;
    roles : [Role];
  };

  /// The full Permissions section as returned to the admin panel.
  public type PermissionsView = {
    capabilities : [CapabilityRow];
    roleDefaults : [RolePermissions];
    overrides : [PrincipalOverride];
  };

  /// Input for editing a role's default permission set.
  public type UpdateRolePermissionsInput = {
    role : Role;
    capabilities : [Capability];
  };

  /// Input for setting a per-principal permission override.
  public type SetPrincipalOverrideInput = {
    principal : Principal;
    role : Role;
    capabilities : [Capability];
  };

  /// Errors returned by permission mutations.
  public type PermissionsError = {
    #notAuthenticated;
    #notAuthorized;
    #unknownPrincipal : Principal;
    #invalidInput : Text;
  };
};
