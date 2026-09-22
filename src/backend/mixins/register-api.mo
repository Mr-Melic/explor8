/// Public API for the JOA Gold Book provenance register.
import Result "mo:core/Result";
import Types "../types/register";
import RegisterLib "../lib/register";
import RolesLib "../lib/roles";
import PermissionsLib "../lib/permissions";
import Hashing "../lib/hashing";

mixin (
  registerState : RegisterLib.State,
  rolesState : RolesLib.State,
  permissionsState : PermissionsLib.State,
) {
  /// Suggest the next lot id for a site and date.
  public query func suggestLotId(site : Types.Site, date : Text) : async Types.LotId {
    RegisterLib.suggestLotId(registerState, site, date);
  };

  /// Register a new lot. Signed-in callers with a role that permits the lot
  /// type only.
  public shared ({ caller }) func registerLot(input : Types.NewLotInput) : async Result.Result<Types.LotView, Types.RegisterError> {
    RegisterLib.registerLot(registerState, rolesState, caller, input);
  };

  /// Append a provenance event to a lot. The caller's role must permit the
  /// event kind.
  public shared ({ caller }) func appendEvent(lotId : Types.LotId, input : Types.NewEventInput) : async Result.Result<Types.LotView, Types.RegisterError> {
    RegisterLib.appendEvent(registerState, rolesState, caller, lotId, input);
  };

  /// Record a status change as a new provenance event in the lot's chain. The
  /// caller's role must be permitted to make the transition.
  public shared ({ caller }) func changeStatus(lotId : Types.LotId, input : Types.StatusChangeInput) : async Result.Result<Types.LotView, Types.RegisterError> {
    RegisterLib.changeStatus(registerState, rolesState, caller, lotId, input);
  };

  /// The status-change history for a lot, in provenance order. Public read.
  public query func statusHistory(lotId : Types.LotId) : async [Types.StatusChange] {
    RegisterLib.statusHistory(registerState, lotId);
  };

  /// Split a lot into child lots. Workshop or admin only.
  public shared ({ caller }) func splitLot(input : Types.SplitInput) : async Result.Result<[Types.LotView], Types.RegisterError> {
    RegisterLib.splitLot(registerState, rolesState, caller, input);
  };

  /// Merge a source lot into a destination lot. Workshop or admin only.
  public shared ({ caller }) func mergeLots(input : Types.MergeInput) : async Result.Result<Types.LotView, Types.RegisterError> {
    RegisterLib.mergeLots(registerState, rolesState, caller, input);
  };

  /// Freeze a lot. Admin only.
  public shared ({ caller }) func freezeLot(lotId : Types.LotId) : async Result.Result<Types.LotView, Types.RegisterError> {
    RegisterLib.freezeLot(registerState, rolesState, caller, lotId);
  };

  /// Delete exactly one block, removing its events, hash chain and stored file
  /// references. Requires the `#delete_lot` capability, held by admin by
  /// default; a caller without it is refused with `#notAuthorized`. This is the
  /// register's one explicit destructive action.
  public shared ({ caller }) func deleteLot(lotId : Types.LotId) : async Result.Result<Types.LotId, Types.RegisterError> {
    RegisterLib.deleteLot(registerState, rolesState, permissionsState, caller, lotId);
  };

  /// List every lot in the register. Public read.
  public query func listLots() : async [Types.LotView] {
    RegisterLib.listLots(registerState);
  };

  /// Fetch a single lot by id. Public read.
  public query func getLot(lotId : Types.LotId) : async ?Types.LotView {
    RegisterLib.getLot(registerState, lotId);
  };

  /// Search across lot id, content-hash prefix, seal number and working ref.
  public query func searchLots(term : Text) : async [Types.LotSearchHit] {
    RegisterLib.searchLots(registerState, term);
  };

  /// Aggregate register data for the home-page graph. Public read.
  public query func registerSummary() : async Types.RegisterSummary {
    RegisterLib.registerSummary(registerState);
  };

  /// Canonical lot snapshot JSON, so the frontend can recompute contentHash.
  /// Built through the register's own snapshot path, so it reproduces the
  /// sealed contentHash exactly, including event file content hashes and every
  /// event's payloadHash.
  public query func canonicalSnapshotJson(lotId : Types.LotId) : async ?Text {
    RegisterLib.canonicalSnapshotJson(registerState, lotId);
  };

  /// Canonical event payload JSON, so the frontend can recompute payloadHash.
  public query func canonicalEventJson(kind : Types.EventKind, payload : Text, fileContentHashes : [Types.HashHex]) : async Text {
    Hashing.canonicalEventJson({ kind; payload; fileContentHashes });
  };

  /// SHA-256 of a UTF-8 text as 64 lowercase hex characters.
  public query func sha256Hex(input : Text) : async Types.HashHex {
    Hashing.sha256Hex(input);
  };

  /// SHA-256 of raw file bytes as 64 lowercase hex characters.
  public query func sha256HexOfBlob(input : Blob) : async Types.HashHex {
    Hashing.sha256HexOfBlob(input);
  };
};
