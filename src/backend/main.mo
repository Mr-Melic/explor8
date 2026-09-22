/// JOA Gold Book — composition root for the provenance register backend.
/// State is declared here with types only; initial values come from the
/// migration chain in migrations/.
///
/// Each piece of state has exactly one home: the register's lots, file hashes
/// and OQL lot index live inside `registerState`, the role map lives inside
/// `rolesState`, the admin-managed reference data, analysis documents and
/// their counters live inside `referenceState`, the pending purge request
/// lives inside `purgeState`, and the role permission defaults and
/// per-principal overrides live inside `permissionsState`. The migration's
/// `NewActor` matches this actor shape exactly.
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import Table "mo:caffeineai-oql/Table";
import TextValue "mo:caffeineai-oql/TextValue";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import BoolValue "mo:caffeineai-oql/BoolValue";

import RegisterLib "lib/register";
import RolesLib "lib/roles";
import ReferenceLib "lib/reference";
import PurgeLib "lib/purge";
import PermissionsLib "lib/permissions";
import RegisterApi "mixins/register-api";
import RolesApi "mixins/roles-api";
import ReferenceApi "mixins/reference-api";
import PurgeApi "mixins/purge-api";
import PermissionsApi "mixins/permissions-api";
import ApiDocMixin "mixins/api-doc";

import ReferenceTypes "types/reference";
import RegisterTypes "types/register";

actor {
  /// The canonical tag text for a reference kind, used as the OQL column value.
  func refKindTag(kind : ReferenceTypes.RefKind) : Text {
    switch kind {
      case (#lot_kind) "lot_kind";
      case (#site) "site";
      case (#status) "status";
      case (#event_kind) "event_kind";
      case (#caption) "caption";
      case (#form_default) "form_default";
    };
  };

  /// The canonical tag text for a role, used as the OQL column value.
  func roleTag(role : RegisterTypes.Role) : Text {
    switch role {
      case (#guest) "guest";
      case (#field_officer) "field_officer";
      case (#assayer) "assayer";
      case (#workshop) "workshop";
      case (#admin) "admin";
    };
  };

  let accessControlState : AccessControl.AccessControlState;
  let registerState : RegisterLib.State;
  let rolesState : RolesLib.State;
  let referenceState : ReferenceLib.State;
  let purgeState : PurgeLib.State;
  let permissionsState : PermissionsLib.State;

  include MixinAuthorization(accessControlState, null);
  include RegisterApi(registerState, rolesState, permissionsState);
  include RolesApi(rolesState);
  include ReferenceApi(referenceState, registerState, rolesState);
  include PurgeApi(purgeState, registerState, rolesState);
  include PermissionsApi(permissionsState, rolesState);
  include ApiDocMixin();
  include Expose({
    entities = [
      registerState.lotIndex.entityWith("lot", "Lot", "id").public_().build(),
      Entity.manual<ReferenceTypes.RefEntry>(
        "referenceEntry",
        func () = referenceState.entries.values(),
        "ReferenceEntry",
        "id",
      )
        .payload("id", func (entry : ReferenceTypes.RefEntry) : Text = entry.id)
        .payload("kind", func (entry : ReferenceTypes.RefEntry) : Text = refKindTag(entry.kind))
        .payload("key", func (entry : ReferenceTypes.RefEntry) : Text = entry.key)
        .payload("displayName", func (entry : ReferenceTypes.RefEntry) : Text = entry.displayName)
        .payload("value", func (entry : ReferenceTypes.RefEntry) : Text = entry.value)
        .payload("sortOrder", func (entry : ReferenceTypes.RefEntry) : Nat = entry.sortOrder)
        .payload("active", func (entry : ReferenceTypes.RefEntry) : Bool = entry.active)
        .public_()
        .build(),
      Entity.manual<ReferenceTypes.AnalysisDocument>(
        "analysisDocument",
        func () = referenceState.documents.values(),
        "AnalysisDocument",
        "id",
      )
        .payload("id", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.id)
        .payload("title", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.title)
        .payload("docKind", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.docKind)
        .payload("fileId", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.fileId)
        .payload("contentHash", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.contentHash)
        .payload("uploadedAt", func (doc : ReferenceTypes.AnalysisDocument) : Int = doc.uploadedAt)
        .payload("uploadedBy", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.uploadedBy.toText())
        .payload("note", func (doc : ReferenceTypes.AnalysisDocument) : Text = doc.note)
        .controllerOnly()
        .build(),
      Entity.manual<{ principal : Text; role : Text }>(
        "roleAssignment",
        func () = rolesState.roles.entries().map(
          func ((principal, role) : (Principal, RegisterTypes.Role)) : { principal : Text; role : Text } =
            { principal = principal.toText(); role = roleTag(role) }
        ),
        "RoleAssignment",
        "principal",
      )
        .payload("principal", func (assignment : { principal : Text; role : Text }) : Text = assignment.principal)
        .payload("role", func (assignment : { principal : Text; role : Text }) : Text = assignment.role)
        .controllerOnly()
        .build(),
    ];
  });
};
