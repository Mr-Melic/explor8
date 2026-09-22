import { createActor } from "@/lib/backend";
import type {
  AnalysisDocumentView,
  Capability,
  NewAnalysisDocumentInput,
  NewRefEntryInput,
  PermissionsView,
  PrincipalOverride,
  PurgeOutcome,
  PurgeRequestView,
  RefEntryView,
  RefKind,
  RegisterAnalytics,
  RolePermissions,
  SetPrincipalOverrideInput,
  UpdateRefEntryInput,
  UpdateRolePermissionsInput,
} from "@/lib/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Query keys for the admin-only surfaces. Kept in one place so a mutation can
 * invalidate exactly the panels it changed.
 */
export const adminKeys = {
  analytics: ["admin-analytics"] as const,
  documents: ["admin-documents"] as const,
  reference: ["admin-reference"] as const,
  permissions: ["admin-permissions"] as const,
  purge: ["admin-purge"] as const,
};

/** The register's own live analytics. Admin only. */
export function useRegisterAnalytics(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<RegisterAnalytics>({
    queryKey: adminKeys.analytics,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.registerAnalytics();
      if (result.__kind__ === "err") {
        throw new Error("The register analytics could not be read.");
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Every stored analysis document, newest first. Admin only. */
export function useAnalysisDocuments(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<AnalysisDocumentView[]>({
    queryKey: adminKeys.documents,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.listAnalysisDocuments();
      if (result.__kind__ === "err") {
        throw new Error("The analysis documents could not be read.");
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Store an analysis document. Admin only. */
export function useAddAnalysisDocument() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewAnalysisDocumentInput) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.addAnalysisDocument(input);
      if (result.__kind__ === "err") {
        throw new Error("The document could not be stored.");
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.documents });
    },
  });
}

/** Remove an analysis document. Admin only. */
export function useRemoveAnalysisDocument() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.removeAnalysisDocument(id);
      if (result.__kind__ === "err") {
        throw new Error("The document could not be removed.");
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.documents });
    },
  });
}

/** Every reference entry, including inactive ones. Admin only. */
export function useAllReferenceEntries(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<RefEntryView[]>({
    queryKey: adminKeys.reference,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.listAllReferenceEntries();
      if (result.__kind__ === "err") {
        throw new Error("The reference data could not be read.");
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Add a reference entry. Admin only. */
export function useAddReferenceEntry() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewRefEntryInput) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.addReferenceEntry(input);
      if (result.__kind__ === "err") {
        throw new Error(referenceErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.reference });
    },
  });
}

/** Edit a reference entry. Admin only. */
export function useUpdateReferenceEntry() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRefEntryInput) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.updateReferenceEntry(input);
      if (result.__kind__ === "err") {
        throw new Error(referenceErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.reference });
    },
  });
}

/** Remove a reference entry. Admin only. */
export function useRemoveReferenceEntry() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.removeReferenceEntry(id);
      if (result.__kind__ === "err") {
        throw new Error(referenceErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.reference });
    },
  });
}

/** Human-readable message for a `ReferenceError` variant. */
function referenceErrorMessage(kind: string): string {
  switch (kind) {
    case "notAuthorized":
      return "Only an administrator may change reference data.";
    case "notAuthenticated":
      return "Sign in as an administrator to change reference data.";
    case "duplicateEntry":
      return "An entry with that key already exists for this block.";
    case "unknownEntry":
      return "That entry no longer exists. Reload the panel.";
    case "unknownDocument":
      return "That document no longer exists. Reload the panel.";
    case "invalidInput":
      return "The entry is incomplete. Fill in every field.";
    default:
      return "The reference data could not be saved.";
  }
}

/** Human-readable message for a `PermissionsError` variant. */
function permissionsErrorMessage(kind: string): string {
  switch (kind) {
    case "notAuthorized":
      return "Only an administrator may change permissions.";
    case "notAuthenticated":
      return "Sign in as an administrator to change permissions.";
    case "unknownPrincipal":
      return "That principal is not known to the register.";
    case "invalidInput":
      return "The permission change is incomplete.";
    default:
      return "The permissions could not be saved.";
  }
}

/** Human-readable message for a `PurgeError` variant. */
function purgeErrorMessage(kind: string): string {
  switch (kind) {
    case "notAuthorized":
      return "Only an administrator may purge the register.";
    case "notAuthenticated":
      return "Sign in as an administrator to purge the register.";
    case "invalidPhrase":
      return "The confirmation phrase did not match. Type it exactly.";
    case "alreadyRequested":
      return "A purge request is already open.";
    case "alreadyConfirmed":
      return "You have already confirmed this purge request.";
    case "noPendingRequest":
      return "There is no open purge request to confirm.";
    default:
      return "The purge request could not be processed.";
  }
}

/** The full Permissions section: role defaults, capabilities and overrides. */
export function usePermissions(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<PermissionsView>({
    queryKey: adminKeys.permissions,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.getPermissions();
      if (result.__kind__ === "err") {
        throw new Error(permissionsErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/**
 * The calling principal's effective capabilities.
 *
 * This is the authority for what the signed-in caller may do — it already
 * folds in role defaults and any per-principal override — so the UI gates on
 * this rather than re-deriving permissions from the role alone.
 */
export function useMyCapabilities(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<Capability[]>({
    queryKey: ["my-capabilities"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMyCapabilities();
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Replace the default capability set for a role. Admin only. */
export function useUpdateRolePermissions() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRolePermissionsInput) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.updateRolePermissions(input);
      if (result.__kind__ === "err") {
        throw new Error(permissionsErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.permissions });
      void queryClient.invalidateQueries({ queryKey: ["my-capabilities"] });
    },
  });
}

/** Set a per-principal capability override. Admin only. */
export function useSetPrincipalOverride() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetPrincipalOverrideInput) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.setPrincipalOverride(input);
      if (result.__kind__ === "err") {
        throw new Error(permissionsErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.permissions });
      void queryClient.invalidateQueries({ queryKey: ["my-capabilities"] });
    },
  });
}

/** Remove a per-principal capability override. Admin only. */
export function useRemovePrincipalOverride() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (target: Principal) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.removePrincipalOverride(target);
      if (result.__kind__ === "err") {
        throw new Error(permissionsErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.permissions });
      void queryClient.invalidateQueries({ queryKey: ["my-capabilities"] });
    },
  });
}

/** The open purge request and its confirmation progress, if any. Admin only. */
export function usePurgeRequest(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<PurgeRequestView | null>({
    queryKey: adminKeys.purge,
    queryFn: async () => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.getPurgeRequest();
      if (result.__kind__ === "err") {
        throw new Error(purgeErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/** Open a purge request. The phrase must be typed verbatim. Admin only. */
export function useRequestPurge() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phrase: string) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.requestPurge(phrase);
      if (result.__kind__ === "err") {
        throw new Error(purgeErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.purge });
    },
  });
}

/**
 * Confirm the open purge request. Executes automatically once more than half
 * of the currently-assigned admins have confirmed. Admin only.
 */
export function useConfirmPurge() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<PurgeOutcome> => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.confirmPurge();
      if (result.__kind__ === "err") {
        throw new Error(purgeErrorMessage(result.err.__kind__));
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.purge });
      void queryClient.invalidateQueries({ queryKey: ["lots"] });
      void queryClient.invalidateQueries({ queryKey: ["lot"] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
      void queryClient.invalidateQueries({ queryKey: ["register-summary"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.analytics });
    },
  });
}

/** Re-exported so a consumer can type a role's default capability set. */
export type { RolePermissions, PrincipalOverride };

/** The reference blocks the admin panel edits, in display order. */
export const REFERENCE_KINDS: { kind: RefKind; label: string; hint: string }[] =
  [
    {
      kind: "lot_kind" as RefKind,
      label: "Lot kinds",
      hint: "The kinds a lot can be registered as.",
    },
    {
      kind: "site" as RefKind,
      label: "Mining Site names",
      hint: "Mining sites that drive the lot id prefix.",
    },
    {
      kind: "status" as RefKind,
      label: "Statuses",
      hint: "The lifecycle states a lot moves through.",
    },
    {
      kind: "event_kind" as RefKind,
      label: "Event kinds",
      hint: "The events an officer can append.",
    },
    {
      kind: "caption" as RefKind,
      label: "Labels",
      hint: "Display labels used across the register.",
    },
    {
      kind: "form_default" as RefKind,
      label: "Form defaults",
      hint: "Values prefilled when a lot is registered.",
    },
    {
      kind: "status_explanation" as RefKind,
      label: "Status explanations",
      hint: "The explanation shown for each status in the home page's status information section.",
    },
    {
      kind: "enquiry_destination" as RefKind,
      label: "Enquiry destination",
      hint: "The optional email address that receives purchase enquiries.",
    },
  ];
