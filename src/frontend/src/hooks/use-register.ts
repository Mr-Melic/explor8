import { createActor } from "@/lib/backend";
import type {
  LotId,
  LotSearchHit,
  LotView,
  MergeInput,
  NewEventInput,
  NewLotInput,
  RegisterSummary,
  Role,
  Site,
  SplitInput,
  StatusChange,
  StatusChangeInput,
} from "@/lib/backend";
import { sha256Hex } from "@/lib/hashing";
import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const registerKeys = {
  lots: ["lots"] as const,
  lot: (id: LotId) => ["lot", id] as const,
  search: (term: string) => ["search", term] as const,
  summary: ["register-summary"] as const,
  actors: ["actors"] as const,
  hasAdmin: ["has-admin"] as const,
  statusHistory: (id: LotId) => ["status-history", id] as const,
};

/** Every lot in the register. Public read. */
export function useLots() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<LotView[]>({
    queryKey: registerKeys.lots,
    queryFn: async () => {
      if (!actor) return [];
      return actor.listLots();
    },
    enabled: !!actor && !isFetching,
  });
}

/** A single lot by id. Public read. */
export function useLot(lotId: LotId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<LotView | null>({
    queryKey: registerKeys.lot(lotId ?? ""),
    queryFn: async () => {
      if (!actor || !lotId) return null;
      return actor.getLot(lotId);
    },
    enabled: !!actor && !isFetching && !!lotId,
  });
}

/** The outcome of recomputing a lot's sealed content hash. */
export type LotSnapshotVerification =
  | { kind: "match"; recomputed: string; sealed: string }
  | { kind: "mismatch"; recomputed: string; sealed: string }
  | { kind: "unavailable"; message: string };

/**
 * Recompute a lot's content hash from the register's own canonical snapshot.
 *
 * The backend's `canonicalSnapshotJson` is the authority: we hash the exact
 * bytes it returns rather than rebuilding the snapshot client-side, so the
 * comparison is against what the register actually sealed. A missing snapshot
 * or a hashing failure is reported as `unavailable` — never as a match.
 */
export function useVerifyLotSnapshot() {
  const { actor } = useActor(createActor);
  return useMutation({
    mutationFn: async (lot: LotView): Promise<LotSnapshotVerification> => {
      if (!actor) {
        return {
          kind: "unavailable",
          message: "The register is not reachable from this browser.",
        };
      }

      let canonical: string | null;
      try {
        canonical = await actor.canonicalSnapshotJson(lot.id);
      } catch {
        return {
          kind: "unavailable",
          message: "The canonical snapshot could not be fetched.",
        };
      }

      if (canonical === null) {
        return {
          kind: "unavailable",
          message: "The register holds no canonical snapshot for this lot.",
        };
      }

      let recomputed: string;
      try {
        recomputed = await sha256Hex(canonical);
      } catch {
        return {
          kind: "unavailable",
          message: "The snapshot could not be hashed in this browser.",
        };
      }

      return recomputed === lot.contentHash
        ? { kind: "match", recomputed, sealed: lot.contentHash }
        : { kind: "mismatch", recomputed, sealed: lot.contentHash };
    },
  });
}

/** Search across lot id, content-hash prefix, seal number and working ref. */
export function useSearchLots(term: string) {
  const { actor, isFetching } = useActor(createActor);
  const trimmed = term.trim();
  return useQuery<LotSearchHit[]>({
    queryKey: registerKeys.search(trimmed),
    queryFn: async () => {
      if (!actor) return [];
      return actor.searchLots(trimmed);
    },
    enabled: !!actor && !isFetching && trimmed.length > 0,
  });
}

/** Aggregate register data for the home-page graph. Public read. */
export function useRegisterSummary() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<RegisterSummary>({
    queryKey: registerKeys.summary,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.registerSummary();
    },
    enabled: !!actor && !isFetching,
  });
}

/**
 * Whether the register already has an administrator.
 *
 * `hasAdmin` is a public query, so this is deliberately not gated on any role:
 * a signed-in principal with no role must be able to ask before the claim path
 * is offered. The query is only enabled once an identity is present, because
 * the claim affordance itself is only meaningful to a signed-in caller.
 */
export function useHasAdmin(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<boolean>({
    queryKey: registerKeys.hasAdmin,
    queryFn: async () => {
      if (!actor) return false;
      return actor.hasAdmin();
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Every actor with its principal and role. Admin only. */
export function useActors(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: registerKeys.actors,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.listActors();
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Suggest the next lot id for a site and date. */
export function useSuggestLotId(site: Site | string, date: string) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<LotId>({
    queryKey: ["suggest-lot-id", site, date],
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.suggestLotId(site as Site, date);
    },
    enabled: !!actor && !isFetching && !!date,
  });
}

function useInvalidateRegister() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: registerKeys.lots });
    void queryClient.invalidateQueries({ queryKey: registerKeys.summary });
    void queryClient.invalidateQueries({ queryKey: ["search"] });
    void queryClient.invalidateQueries({ queryKey: ["lot"] });
  };
}

/** Register a new lot. Signed-in callers with a writing role only. */
export function useRegisterLot() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRegister();
  return useMutation({
    mutationFn: async (input: NewLotInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.registerLot(input);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Append a Precious Material Origin History event to a lot. */
export function useAppendEvent() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRegister();
  return useMutation({
    mutationFn: async (args: { lotId: LotId; input: NewEventInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.appendEvent(args.lotId, args.input);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/**
 * The status-change history for a lot, in Precious Material Origin History
 * order. Public read.
 *
 * The lot view already carries `statusHistory`, but this reads the register's
 * own ordered history directly so a long chain can be stepped through without
 * depending on the lot payload.
 */
export function useStatusHistory(lotId: LotId | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<StatusChange[]>({
    queryKey: registerKeys.statusHistory(lotId ?? ""),
    queryFn: async () => {
      if (!actor || !lotId) return [];
      return actor.statusHistory(lotId);
    },
    enabled: !!actor && !isFetching && !!lotId,
  });
}

/**
 * Record a status change as a new Precious Material Origin History event in
 * the lot's chain.
 *
 * The register is append-only: this appends a `status_change` event and moves
 * the lot's current status. Both the lot and the lot list are invalidated so
 * every surface reflects the new status and its history.
 */
export function useChangeStatus() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRegister();
  return useMutation({
    mutationFn: async (args: { lotId: LotId; input: StatusChangeInput }) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.changeStatus(args.lotId, args.input);
      if (result.__kind__ === "err") {
        throw new Error(statusChangeErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Human-readable message for a `RegisterError` raised by a status change. */
function statusChangeErrorMessage(kind: string): string {
  switch (kind) {
    case "notAuthorized":
      return "Your role may not make that status change.";
    case "notAuthenticated":
      return "Sign in to change a lot's status.";
    case "unknownLot":
      return "That lot no longer exists. Reload the register.";
    case "lotFrozen":
      return "This lot is sealed. Its status can no longer change.";
    case "invalidInput":
      return "That status change is not allowed from the lot's current status.";
    default:
      return "The status change could not be recorded.";
  }
}

/** Split a lot into child lots. */
export function useSplitLot() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRegister();
  return useMutation({
    mutationFn: async (input: SplitInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.splitLot(input);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Merge a source lot into a destination lot. */
export function useMergeLots() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRegister();
  return useMutation({
    mutationFn: async (input: MergeInput) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.mergeLots(input);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/** Freeze a lot. Admin only. */
export function useFreezeLot() {
  const { actor } = useActor(createActor);
  const invalidate = useInvalidateRegister();
  return useMutation({
    mutationFn: async (lotId: LotId) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.freezeLot(lotId);
    },
    onSuccess: () => {
      invalidate();
    },
  });
}

/**
 * Delete a single block from the register. Admin only.
 *
 * The register is append-only for Precious Material Origin History, so
 * deletion is the one
 * destructive operation on a block and the backend re-checks the caller's
 * `delete_lot` capability. On success every surface that counts or lists
 * blocks is invalidated — the register explorer, the register summary and the
 * admin analytics — so the removal shows without a manual reload.
 */
export function useDeleteLot() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lotId: LotId) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.deleteLot(lotId);
      if (result.__kind__ === "err") {
        throw new Error(deleteLotErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registerKeys.lots });
      void queryClient.invalidateQueries({ queryKey: registerKeys.summary });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
      void queryClient.invalidateQueries({ queryKey: ["lot"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
  });
}

/** Human-readable message for a `RegisterError` raised by a block deletion. */
function deleteLotErrorMessage(kind: string): string {
  switch (kind) {
    case "notAuthorized":
      return "Only an administrator may delete a block.";
    case "notAuthenticated":
      return "Sign in as an administrator to delete a block.";
    case "unknownLot":
      return "That block no longer exists. Reload the register.";
    case "lotFrozen":
      return "This block is sealed and cannot be deleted.";
    case "invalidInput":
      return "That block could not be deleted.";
    default:
      return "The block could not be deleted.";
  }
}

/** The first identity that claims admin becomes admin. */
export function useClaimAdmin() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.claimAdmin();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-role"] });
      void queryClient.invalidateQueries({ queryKey: registerKeys.actors });
      void queryClient.invalidateQueries({ queryKey: registerKeys.hasAdmin });
    },
  });
}

/** Assign a role to a principal. Admin only. */
export function useAssignRole() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { target: Principal; role: Role }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.assignRole(args.target, args.role);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registerKeys.actors });
    },
  });
}
