/**
 * Client-side mirror of the backend canonical hashing.
 *
 * The register seals every lot with a SHA-256 content hash. This module
 * reproduces the backend's canonical JSON byte-for-byte so a reader can
 * recompute a hash locally and compare it with the sealed value:
 *
 * - keys sorted alphabetically, no extra whitespace
 * - every scalar rendered as a string
 * - `fileContentHashes` is the sorted list of per-file SHA-256 hex strings
 * - SHA-256 via Web Crypto, returned as 64 lowercase hex characters
 */

/** SHA-256 of a UTF-8 string as 64 lowercase hex characters. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  return sha256HexOfBytes(bytes);
}

/** SHA-256 of raw bytes as 64 lowercase hex characters. */
export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return toHex(new Uint8Array(digest));
}

/** SHA-256 of a `File` / `Blob` as 64 lowercase hex characters. */
export async function sha256HexOfFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sha256HexOfBytes(new Uint8Array(buffer));
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Canonical JSON: keys sorted alphabetically, no whitespace, scalars as
 * strings. Mirrors the backend's `canonicalSnapshotJson` / `canonicalEventJson`.
 */
export function canonicalJson(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => {
    const entry = value[key];
    if (Array.isArray(entry)) {
      const items = entry.map((item) => JSON.stringify(String(item)));
      return `${JSON.stringify(key)}:[${items.join(",")}]`;
    }
    return `${JSON.stringify(key)}:${JSON.stringify(String(entry ?? ""))}`;
  });
  return `{${parts.join(",")}}`;
}

/**
 * The scalar fields that make up a lot's sealed snapshot.
 *
 * Mirrors the backend's `Types.CanonicalSnapshot` exactly: the canonical
 * payload carries only these ten keys, with the lot type under `type`.
 */
export interface LotSnapshotFields {
  id: string;
  type: string;
  project: string;
  workingRef: string;
  sealNo: string;
  licence: string;
  gps: string;
  grossG: string;
  parentIds: string[];
  fileContentHashes: string[];
}

/** Canonical lot snapshot JSON, ready to be hashed. */
export function canonicalLotSnapshot(fields: LotSnapshotFields): string {
  return canonicalJson({
    fileContentHashes: [...fields.fileContentHashes].sort(),
    gps: fields.gps,
    grossG: fields.grossG,
    id: fields.id,
    licence: fields.licence,
    parentIds: fields.parentIds,
    project: fields.project,
    sealNo: fields.sealNo,
    type: fields.type,
    workingRef: fields.workingRef,
  });
}

/** Recompute a lot's content hash from its sealed fields. */
export async function computeLotContentHash(
  fields: LotSnapshotFields,
): Promise<string> {
  return sha256Hex(canonicalLotSnapshot(fields));
}

/** Canonical event payload JSON, ready to be hashed. */
export function canonicalEventPayload(
  kind: string,
  payload: string,
  fileContentHashes: string[],
): string {
  return canonicalJson({
    fileContentHashes: [...fileContentHashes].sort(),
    kind,
    payload,
  });
}

/** Recompute an event's payload hash from its sealed fields. */
export async function computeEventPayloadHash(
  kind: string,
  payload: string,
  fileContentHashes: string[],
): Promise<string> {
  return sha256Hex(canonicalEventPayload(kind, payload, fileContentHashes));
}
