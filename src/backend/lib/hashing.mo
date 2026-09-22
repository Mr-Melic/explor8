/// Canonical JSON serialisation and SHA-256 hashing for the register.
/// The frontend recomputes the same values through the exposed hashing API.
import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Nat8 "mo:core/Nat8";
import Sha256 "mo:sha2/Sha256";
import Text "mo:core/Text";
import Types "../types/register";

module {
  /// SHA-256 of a UTF-8 text, rendered as 64 lowercase hex characters.
  public func sha256Hex(input : Text) : Types.HashHex {
    sha256HexOfBlob(input.encodeUtf8());
  };

  /// SHA-256 of raw file bytes, rendered as 64 lowercase hex characters.
  public func sha256HexOfBlob(input : Blob) : Types.HashHex {
    let digest = Sha256.fromBlob(input);
    var out = "";
    for (byte in digest.values()) {
      let n = byte.toNat();
      let hi = n / 16;
      let lo = n % 16;
      out := out # hexDigit(hi) # hexDigit(lo);
    };
    out;
  };

  func hexDigit(n : Nat) : Text {
    switch n {
      case 0 "0";
      case 1 "1";
      case 2 "2";
      case 3 "3";
      case 4 "4";
      case 5 "5";
      case 6 "6";
      case 7 "7";
      case 8 "8";
      case 9 "9";
      case 10 "a";
      case 11 "b";
      case 12 "c";
      case 13 "d";
      case 14 "e";
      case _ "f";
    };
  };

  /// JSON-escape a text value and wrap it in double quotes.
  func jsonString(value : Text) : Text {
    var out = "\"";
    for (c in value.chars()) {
      switch c {
        case '\u{22}' { out := out # "\\\"" };
        case '\u{5C}' { out := out # "\\\\" };
        case '\n' { out := out # "\\n" };
        case '\r' { out := out # "\\r" };
        case '\t' { out := out # "\\t" };
        case _ { out := out # c.toText() };
      };
    };
    out # "\"";
  };

  /// A JSON array of already-encoded JSON values.
  func jsonArray(items : [Text]) : Text {
    "[" # items.values().join(",") # "]";
  };

  /// A JSON array of strings.
  func jsonStringArray(items : [Text]) : Text {
    jsonArray(items.map(func item = jsonString(item)));
  };

  /// The canonical tag text for a lot type.
  public func lotTypeTag(lotType : Types.LotType) : Text {
    switch lotType {
      case (#emerald) "emerald";
      case (#gold) "gold";
    };
  };

  /// The canonical tag text for an event kind.
  public func eventKindTag(kind : Types.EventKind) : Text {
    switch kind {
      case (#extracted) "extracted";
      case (#photo) "photo";
      case (#weighed) "weighed";
      case (#sealed) "sealed";
      case (#moved) "moved";
      case (#assay) "assay";
      case (#split) "split";
      case (#merge) "merge";
      case (#cut) "cut";
      case (#retail) "retail";
      case (#correction) "correction";
      case (#note) "note";
      case (#status_change) "status_change";
    };
  };

  /// Canonical JSON of a lot snapshot: keys sorted alphabetically, no extra
  /// whitespace, every scalar rendered as a string.
  public func canonicalSnapshotJson(snapshot : Types.CanonicalSnapshot) : Text {
    "{" #
    "\"fileContentHashes\":" # jsonStringArray(snapshot.fileContentHashes) # "," #
    "\"gps\":" # jsonString(snapshot.gps) # "," #
    "\"grossG\":" # jsonString(snapshot.grossG) # "," #
    "\"id\":" # jsonString(snapshot.id) # "," #
    "\"licence\":" # jsonString(snapshot.licence) # "," #
    "\"parentIds\":" # jsonStringArray(snapshot.parentIds) # "," #
    "\"project\":" # jsonString(snapshot.project) # "," #
    "\"sealNo\":" # jsonString(snapshot.sealNo) # "," #
    "\"type\":" # jsonString(lotTypeTag(snapshot.lotType)) # "," #
    "\"workingRef\":" # jsonString(snapshot.workingRef) #
    "}";
  };

  /// Canonical JSON of an event payload: keys sorted alphabetically, no extra
  /// whitespace, every scalar rendered as a string.
  public func canonicalEventJson(payload : Types.CanonicalEventPayload) : Text {
    "{" #
    "\"fileContentHashes\":" # jsonStringArray(payload.fileContentHashes) # "," #
    "\"kind\":" # jsonString(eventKindTag(payload.kind)) # "," #
    "\"payload\":" # jsonString(payload.payload) #
    "}";
  };

  /// contentHash = SHA-256 of the canonical lot snapshot JSON.
  public func computeContentHash(snapshot : Types.CanonicalSnapshot) : Types.HashHex {
    sha256Hex(canonicalSnapshotJson(snapshot));
  };

  /// payloadHash = SHA-256 of the canonical event payload JSON.
  public func computePayloadHash(payload : Types.CanonicalEventPayload) : Types.HashHex {
    sha256Hex(canonicalEventJson(payload));
  };

  /// Sorted list of hashes folded into a lot's canonical snapshot: every
  /// per-file content hash ever attached to the lot or its events, plus every
  /// event's payloadHash. Including the payload hashes is what makes an append
  /// that carries no file change the snapshot — and therefore the contentHash —
  /// because each event's payloadHash is derived from its kind and payload.
  public func collectFileContentHashes(
    fileHashes : [Types.FileHash],
    events : [Types.Event],
  ) : [Types.HashHex] {
    let collected = fileHashes.map(func (fh : Types.FileHash) : Types.HashHex = fh.contentHash);
    let eventHashes = events.map(
      func (event : Types.Event) : [Types.HashHex] {
        event.fileIds.map(
          func (fileId : Types.FileId) : Types.HashHex {
            switch (fileHashes.find(func (fh : Types.FileHash) : Bool = fh.fileId == fileId)) {
              case (?fh) fh.contentHash;
              case null sha256Hex(fileId);
            };
          }
        );
      }
    ).flatten();
    let payloadHashes = events.map(func (event : Types.Event) : Types.HashHex = event.payloadHash);
    (collected.concat(eventHashes).concat(payloadHashes)).sort();
  };
};
