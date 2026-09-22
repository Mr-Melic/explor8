import type { FileHash } from "@/lib/backend";
import { sha256HexOfFile } from "@/lib/hashing";
import { loadConfig } from "@caffeineai/core-infrastructure";
import { ExternalBlob, StorageClient } from "@caffeineai/object-storage";
import { HttpAgent } from "@icp-sdk/core/agent";
import { useCallback, useState } from "react";

/** A file the operator has attached but not yet sealed into the register. */
export interface StagedFile {
  /** Stable client-side key for React lists. */
  key: string;
  file: File;
  /** SHA-256 of the raw bytes, computed in the browser before upload. */
  contentHash: string;
  /** Upload progress, 0–100. */
  progress: number;
  /** The gateway file id once the upload completes. */
  fileId: string | null;
  /** Set when hashing or uploading this file failed. */
  error: string | null;
}

/** The sealed result for one file, ready for `NewLotInput` / `NewEventInput`. */
export interface UploadedFile {
  fileId: string;
  contentHash: string;
  filename: string;
  contentType: string;
}

let stagedFileCounter = 0;

function nextStagedKey(): string {
  stagedFileCounter += 1;
  return `staged-${stagedFileCounter}`;
}

/**
 * Stage, hash and upload files for a lot or event.
 *
 * Bytes are hashed with Web Crypto *before* the upload, so the register always
 * records a content hash the operator can recompute. Filenames and gateway URLs
 * are never hashed — only the raw bytes.
 */
export function useFileUpload() {
  const [files, setFiles] = useState<StagedFile[]>([]);

  const addFiles = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return;

    const staged: StagedFile[] = incoming.map((file) => ({
      key: nextStagedKey(),
      file,
      contentHash: "",
      progress: 0,
      fileId: null,
      error: null,
    }));

    setFiles((current) => [...current, ...staged]);

    await Promise.all(
      staged.map(async (entry) => {
        try {
          const contentHash = await sha256HexOfFile(entry.file);
          setFiles((current) =>
            current.map((item) =>
              item.key === entry.key ? { ...item, contentHash } : item,
            ),
          );
        } catch {
          setFiles((current) =>
            current.map((item) =>
              item.key === entry.key
                ? { ...item, error: "Could not hash this file's bytes." }
                : item,
            ),
          );
        }
      }),
    );
  }, []);

  const removeFile = useCallback((key: string) => {
    setFiles((current) => current.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
  }, []);

  /**
   * Upload every staged file to platform storage and return the sealed
   * `fileId` + `contentHash` pairs. Throws if any file failed to hash, so the
   * caller can refuse to save a lot whose bytes were never sealed.
   */
  const uploadAll = useCallback(async (): Promise<UploadedFile[]> => {
    const pending = files;
    if (pending.length === 0) return [];

    const unhashed = pending.find((item) => !item.contentHash);
    if (unhashed) {
      throw new Error(
        `“${unhashed.file.name}” could not be hashed. Remove it and try again.`,
      );
    }

    const results = await Promise.all(
      pending.map(async (entry) => {
        try {
          const bytes = new Uint8Array(await entry.file.arrayBuffer());
          const blob = ExternalBlob.fromBytes(
            bytes,
            entry.file.type,
            entry.file.name,
          ).withUploadProgress((percentage) => {
            setFiles((current) =>
              current.map((item) =>
                item.key === entry.key
                  ? { ...item, progress: percentage }
                  : item,
              ),
            );
          });

          const fileId = await uploadBlob(blob);
          setFiles((current) =>
            current.map((item) =>
              item.key === entry.key
                ? { ...item, fileId, progress: 100 }
                : item,
            ),
          );

          return {
            fileId,
            contentHash: entry.contentHash,
            filename: entry.file.name,
            contentType: entry.file.type || "application/octet-stream",
          } satisfies UploadedFile;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload failed.";
          setFiles((current) =>
            current.map((item) =>
              item.key === entry.key ? { ...item, error: message } : item,
            ),
          );
          throw new Error(`“${entry.file.name}” failed to upload: ${message}`);
        }
      }),
    );

    return results;
  }, [files]);

  const hashing = files.some((item) => !item.contentHash && !item.error);
  const uploading = files.some(
    (item) => item.contentHash && !item.fileId && !item.error,
  );
  const hasError = files.some((item) => item.error !== null);

  return {
    files,
    addFiles,
    removeFile,
    clear,
    uploadAll,
    hashing,
    uploading,
    hasError,
  };
}

/**
 * Push a blob to the platform storage gateway and return its content-addressed
 * file id.
 *
 * The register stores file ids as text, so the gateway hash is the id recorded
 * next to the per-file content hash. The gateway is reached through the
 * platform `StorageClient`, which certifies the upload against the backend
 * canister that will hold the reference.
 */
async function uploadBlob(blob: ExternalBlob): Promise<string> {
  const client = await getStorageClient();
  const { hash } = await client.putFile(
    await blob.getBytes(),
    blob.onProgress,
    blob.contentType,
    blob.filename,
  );
  return hash;
}

let storageClient: StorageClient | null = null;

/**
 * Build the storage client once from the deploy-time config.
 *
 * The storage gateway is a separate host from the backend canister, so the
 * client gets its own agent built from the same runtime configuration.
 */
async function getStorageClient(): Promise<StorageClient> {
  if (storageClient) return storageClient;

  const config = await loadConfig();

  const agent = new HttpAgent({ host: config.backend_host });
  if (config.backend_host?.includes("localhost")) {
    await agent.fetchRootKey().catch(() => undefined);
  }

  storageClient = new StorageClient(
    config.bucket_name,
    config.storage_gateway_url,
    config.backend_canister_id,
    config.project_id,
    agent,
  );
  return storageClient;
}

/** Convert uploaded files into the backend's `FileHash` shape. */
export function toFileHashes(uploaded: UploadedFile[]): FileHash[] {
  return uploaded.map((item) => ({
    fileId: item.fileId,
    contentHash: item.contentHash,
  }));
}
