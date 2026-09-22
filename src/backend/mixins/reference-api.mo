/// Public API for admin-managed reference data, register analytics and
/// uploaded analysis documents.
import Result "mo:core/Result";
import Types "../types/reference";
import ReferenceLib "../lib/reference";
import RegisterLib "../lib/register";
import RolesLib "../lib/roles";

mixin (
  referenceState : ReferenceLib.State,
  registerState : RegisterLib.State,
  rolesState : RolesLib.State,
) {
  /// List the active reference entries of one kind. Public read: the register's
  /// forms and displays are driven by this data.
  public query func listReferenceEntries(kind : Types.RefKind) : async [Types.RefEntryView] {
    ReferenceLib.listEntries(referenceState, kind);
  };

  /// List every reference entry, including inactive ones. Admin only.
  public query ({ caller }) func listAllReferenceEntries() : async Result.Result<[Types.RefEntryView], Types.ReferenceError> {
    ReferenceLib.listAllEntries(referenceState, rolesState, caller);
  };

  /// Add a reference entry. Admin only.
  public shared ({ caller }) func addReferenceEntry(input : Types.NewRefEntryInput) : async Result.Result<Types.RefEntryView, Types.ReferenceError> {
    ReferenceLib.addEntry(referenceState, rolesState, caller, input);
  };

  /// Edit a reference entry. Admin only.
  public shared ({ caller }) func updateReferenceEntry(input : Types.UpdateRefEntryInput) : async Result.Result<Types.RefEntryView, Types.ReferenceError> {
    ReferenceLib.updateEntry(referenceState, rolesState, caller, input);
  };

  /// Remove a reference entry. Admin only.
  public shared ({ caller }) func removeReferenceEntry(id : Text) : async Result.Result<(), Types.ReferenceError> {
    ReferenceLib.removeEntry(referenceState, rolesState, caller, id);
  };

  /// List the stored analysis documents, newest first. Admin only.
  public query ({ caller }) func listAnalysisDocuments() : async Result.Result<[Types.AnalysisDocumentView], Types.ReferenceError> {
    ReferenceLib.listDocuments(referenceState, rolesState, caller);
  };

  /// Store an analysis document. Admin only.
  public shared ({ caller }) func addAnalysisDocument(input : Types.NewAnalysisDocumentInput) : async Result.Result<Types.AnalysisDocumentView, Types.ReferenceError> {
    ReferenceLib.addDocument(referenceState, rolesState, caller, input);
  };

  /// Remove an analysis document. Admin only.
  public shared ({ caller }) func removeAnalysisDocument(id : Text) : async Result.Result<(), Types.ReferenceError> {
    ReferenceLib.removeDocument(referenceState, rolesState, caller, id);
  };

  /// The register's own live analytics. Admin only.
  public query ({ caller }) func registerAnalytics() : async Result.Result<Types.RegisterAnalytics, Types.ReferenceError> {
    ReferenceLib.registerAnalytics(registerState, rolesState, caller);
  };
};
