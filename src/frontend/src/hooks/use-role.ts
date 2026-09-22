import { createActor } from "@/lib/backend";
import type { Capability, Role } from "@/lib/backend";
import { type RoleCapabilities, resolveCapabilities } from "@/lib/permissions";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";

/**
 * The signed-in principal's role in the register.
 *
 * `getMyRole` returns `guest` for anonymous callers, so the hook only trusts
 * the answer once an identity is present; otherwise the role is `null` and the
 * UI shows the signed-out state.
 *
 * The backend's `getMyCapabilities` is the authority for what the caller may
 * do — it already folds in role defaults and any per-principal override — so
 * the hook exposes it alongside the role. `capabilities` keeps the local
 * role-derived shape for the surfaces that only need a role, while
 * `effectiveCapabilities` is the backend's answer and is what permission
 * gates should read.
 */
export function useMyRole() {
  const { actor, isFetching } = useActor(createActor);
  const { isAuthenticated, identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;

  const query = useQuery<Role | null>({
    queryKey: ["my-role", principal],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyRole();
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  const capabilitiesQuery = useQuery<Capability[]>({
    queryKey: ["my-capabilities", principal],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMyCapabilities();
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  const capabilities: RoleCapabilities = resolveCapabilities(
    isAuthenticated ? (query.data ?? null) : null,
    isAuthenticated,
  );

  return {
    ...query,
    capabilities,
    effectiveCapabilities: capabilitiesQuery.data ?? [],
    principal,
  };
}
