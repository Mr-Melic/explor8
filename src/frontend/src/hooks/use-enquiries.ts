import { createActor } from "@/lib/backend";
import type { EnquiryView, NewEnquiryInput } from "@/lib/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Query keys for the purchase-enquiry surfaces.
 *
 * The submitter's own list and the admin inbox are separate keys so a
 * withdrawal invalidates both: the submitter sees the enquiry marked withdrawn,
 * and the admin inbox drops it entirely.
 */
export const enquiryKeys = {
  mine: ["my-enquiries"] as const,
  inbox: ["admin-enquiries"] as const,
};

/** Human-readable message for an `EnquiryError` variant. */
export function enquiryErrorMessage(kind: string, detail?: string): string {
  switch (kind) {
    case "notAuthenticated":
      return "Sign in with Internet Identity to submit or withdraw an enquiry.";
    case "notAuthorized":
      return "Only an administrator can read the enquiry inbox.";
    case "unknownEnquiry":
      return "That enquiry is no longer in the register.";
    case "invalidInput":
      return detail && detail.trim().length > 0
        ? detail
        : "The enquiry is incomplete. Fill in every required field.";
    default:
      return "The register rejected this enquiry request.";
  }
}

/**
 * The signed-in caller's own enquiries, newest first.
 *
 * `listMyEnquiries` is a public query that returns only the caller's own
 * submissions, so it is enabled only once an identity is present. In demo mode
 * the register is never read — the caller's list is empty, matching the rest of
 * the app's browser-only demo behaviour.
 */
export function useMyEnquiries(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<EnquiryView[]>({
    queryKey: enquiryKeys.mine,
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.listMyEnquiries();
      if (result.__kind__ === "err") {
        throw new Error(
          enquiryErrorMessage(
            result.err.__kind__,
            enquiryErrorDetail(result.err),
          ),
        );
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/**
 * Every non-withdrawn enquiry, newest first. Admin only.
 *
 * The backend re-checks the caller's administrator role, so this is enabled
 * only for a caller the UI already believes is an administrator. In demo mode
 * the register is never read.
 */
export function useAdminEnquiries(enabled: boolean) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<EnquiryView[]>({
    queryKey: enquiryKeys.inbox,
    queryFn: async () => {
      if (!actor) return [];
      const result = await actor.listEnquiries();
      if (result.__kind__ === "err") {
        throw new Error(
          enquiryErrorMessage(
            result.err.__kind__,
            enquiryErrorDetail(result.err),
          ),
        );
      }
      return result.ok;
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

/**
 * Submit a purchase enquiry. Signed-in callers only; consent is required.
 *
 * Both the submitter's own list and the admin inbox are invalidated on success
 * so a new enquiry appears everywhere it belongs without a manual reload.
 */
export function useSubmitEnquiry() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewEnquiryInput) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.submitEnquiry(input);
      if (result.__kind__ === "err") {
        throw new Error(
          enquiryErrorMessage(
            result.err.__kind__,
            enquiryErrorDetail(result.err),
          ),
        );
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: enquiryKeys.mine });
      void queryClient.invalidateQueries({ queryKey: enquiryKeys.inbox });
    },
  });
}

/**
 * Withdraw the caller's own enquiry.
 *
 * A withdrawal removes the enquiry from the admin inbox, so both keys are
 * invalidated: the submitter's list keeps the record marked withdrawn, while the
 * inbox drops it.
 */
export function useWithdrawEnquiry() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Backend is not ready");
      const result = await actor.withdrawEnquiry(id);
      if (result.__kind__ === "err") {
        throw new Error(
          enquiryErrorMessage(
            result.err.__kind__,
            enquiryErrorDetail(result.err),
          ),
        );
      }
      return result.ok;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: enquiryKeys.mine });
      void queryClient.invalidateQueries({ queryKey: enquiryKeys.inbox });
    },
  });
}

/** The `invalidInput` detail carried by an `EnquiryError`, when present. */
function enquiryErrorDetail(error: {
  __kind__: string;
  [key: string]: unknown;
}): string | undefined {
  return error.__kind__ === "invalidInput"
    ? String(error.invalidInput)
    : undefined;
}
