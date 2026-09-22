/// Role assignment and authorization checks layered on the built-in
/// admin/user/guest model.
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types/register";

module {
  /// The role state shared with the API mixins.
  public type State = {
    var firstAdminClaimed : Bool;
    roles : Map.Map<Principal, Types.Role>;
  };

  /// The human-readable display name for a role. 'Assayer' reads
  /// 'Quality Tester' and 'Workshop' reads 'Custom Role'.
  public func roleDisplayName(role : Types.Role) : Text {
    switch role {
      case (#guest) "Guest reader";
      case (#field_officer) "Field officer";
      case (#assayer) "Quality Tester";
      case (#workshop) "Custom Role";
      case (#admin) "Register administrator";
    };
  };

  /// The role a display name refers to, or null when it names no role.
  public func roleFromDisplayName(name : Text) : ?Types.Role {
    allRoles().find(func (role : Types.Role) : Bool = roleDisplayName(role) == name);
  };

  /// Every role, in display order.
  public func allRoles() : [Types.Role] {
    [#guest, #field_officer, #assayer, #workshop, #admin];
  };

  /// The principals currently assigned the admin role.
  public func admins(state : State) : [Principal] {
    state.roles.entries().filter(
      func ((_, role) : (Principal, Types.Role)) : Bool = role == #admin
    ).map(
      func ((principal, _) : (Principal, Types.Role)) : Principal = principal
    ).toArray();
  };

  /// The first identity that claims admin becomes admin; thereafter only an
  /// admin can assign roles.
  public func claimAdmin(state : State, caller : Principal) : Result.Result<Types.Role, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (state.firstAdminClaimed) {
      return #err(#notAuthorized);
    };
    state.firstAdminClaimed := true;
    state.roles.add(caller, #admin);
    #ok(#admin);
  };

  /// Assign a role to a principal. Admin only.
  public func assignRole(
    state : State,
    caller : Principal,
    target : Principal,
    role : Types.Role,
  ) : Result.Result<Types.ActorRole, Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not isAdmin(state, caller)) {
      return #err(#notAuthorized);
    };
    if (target.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    state.roles.add(target, role);
    #ok({ principal = target; role });
  };

  /// The role of a caller; a signed-in user with no role is a read-only guest.
  public func roleOf(state : State, caller : Principal) : Types.Role {
    if (caller.isAnonymous()) {
      return #guest;
    };
    state.roles.get(caller) ?? #guest;
  };

  /// List every actor with its principal and role. Admin only.
  public func listActors(state : State, caller : Principal) : Result.Result<[Types.ActorRole], Types.RegisterError> {
    if (caller.isAnonymous()) {
      return #err(#notAuthenticated);
    };
    if (not isAdmin(state, caller)) {
      return #err(#notAuthorized);
    };
    let actors = state.roles.entries().map(
      func((principal, role)) = { principal; role }
    ).toArray();
    #ok(actors);
  };

  /// Whether the caller may create a lot of the given type. The register
  /// offers exactly two kinds: field officers register Gold, the workshop
  /// registers Emerald, and an admin may register either.
  public func canCreateLot(state : State, caller : Principal, lotType : Types.LotType) : Bool {
    switch (roleOf(state, caller)) {
      case (#admin) { true };
      case (#field_officer) {
        switch (lotType) {
          case (#gold) { true };
          case (_) { false };
        };
      };
      case (#workshop) {
        switch (lotType) {
          case (#emerald) { true };
          case (_) { false };
        };
      };
      case (_) { false };
    };
  };

  /// Whether the caller may append an event of the given kind.
  public func canAppendEvent(state : State, caller : Principal, kind : Types.EventKind) : Bool {
    switch (roleOf(state, caller)) {
      case (#admin) { true };
      case (#field_officer) {
        switch (kind) {
          case (#extracted or #photo or #weighed or #sealed or #moved or #note or #correction) { true };
          case (_) { false };
        };
      };
      case (#assayer) {
        switch (kind) {
          case (#assay) { true };
          case (_) { false };
        };
      };
      case (#workshop) {
        switch (kind) {
          case (#cut or #retail or #split or #merge or #photo or #note or #correction) { true };
          case (_) { false };
        };
      };
      case (_) { false };
    };
  };

  /// Whether an administrator already exists. This is a non-sensitive
  /// precondition: it reports only that the bootstrap has been claimed, never
  /// who holds the role, so it is safe for any caller including anonymous.
  public func hasAdmin(state : State) : Bool {
    if (state.firstAdminClaimed) {
      return true;
    };
    state.roles.entries().any(func((_, role)) = role == #admin);
  };

  /// Whether the caller is an admin.
  public func isAdmin(state : State, caller : Principal) : Bool {
    switch (roleOf(state, caller)) {
      case (#admin) { true };
      case (_) { false };
    };
  };
};
