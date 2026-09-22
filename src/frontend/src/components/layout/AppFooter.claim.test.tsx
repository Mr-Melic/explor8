import { AppFooter } from "@/components/layout/AppFooter";
import { useClaimAdmin } from "@/hooks/use-register";
import { Role } from "@/lib/backend";
import { renderWithRouter } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The bootstrap claim's live role transition.
 *
 * The accepted requirement is that after claiming, the user's role updates to
 * administrator without a manual reload, and the footer Admin button appears.
 * `AppFooter.test.tsx` pins the gate's static states; this suite drives the
 * transition through the real `useClaimAdmin` mutation and the real
 * `useMyRole`/`useHasAdmin` queries, so it proves the query invalidation that
 * makes the change visible in place.
 *
 * The actor is a typed local mock whose `getMyRole`/`hasAdmin` answers flip
 * once `claimAdmin` has been called, modelling the register's first-caller-wins
 * rule. This proves the frontend's cache contract, never the canister.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
  return mockCoreInfrastructure({
    actor: holder.actor,
    identity: holder.identity,
  });
});

/**
 * The admin panel's claim card is the real caller of `useClaimAdmin`; this
 * harness exposes the same mutation as a button so the footer and the claim
 * share one query cache, exactly as they do in the app.
 */
function ClaimHarness() {
  const claim = useClaimAdmin();
  return (
    <button type="button" onClick={() => claim.mutate()}>
      Run claim
    </button>
  );
}

describe("App footer claim transition", () => {
  beforeEach(() => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockReset();
    holder.actor.hasAdmin.mockReset();
    holder.actor.claimAdmin.mockReset();
    window.localStorage.clear();

    // Before the claim: a signed-in principal with no role, and a register
    // that still has no administrator.
    holder.actor.getMyRole.mockResolvedValue(null);
    holder.actor.hasAdmin.mockResolvedValue(false);

    // Claiming flips both answers, exactly as the register's first-caller-wins
    // rule does. The mutation's invalidation is what re-reads them.
    holder.actor.claimAdmin.mockImplementation(async () => {
      holder.actor.getMyRole.mockResolvedValue(Role.admin);
      holder.actor.hasAdmin.mockResolvedValue(true);
      return { __kind__: "ok", ok: "admin" };
    });
  });

  it("swaps the claim path for the Admin button after claiming, with no reload", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <AppFooter />
        <ClaimHarness />
      </>,
    );

    // The claim affordance is offered while no administrator exists.
    const claim = await screen.findByTestId("footer.admin_button");
    expect(claim).toHaveTextContent("Claim administrator");

    // Run the real mutation; its `onSuccess` invalidates `my-role` and
    // `has-admin`, so the footer re-reads both without a reload.
    await user.click(screen.getByRole("button", { name: "Run claim" }));

    await waitFor(() => {
      expect(holder.actor.claimAdmin).toHaveBeenCalledTimes(1);
    });

    // The same mounted tree now shows the administrator's Admin button, and
    // the claim wording is gone.
    await waitFor(() => {
      expect(screen.getByTestId("footer.admin_button")).toHaveTextContent(
        "Admin",
      );
    });
    expect(screen.queryByText("Claim administrator")).not.toBeInTheDocument();
  });
});
