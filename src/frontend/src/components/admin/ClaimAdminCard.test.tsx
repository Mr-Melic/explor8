import { ClaimAdminCard } from "@/components/admin/ClaimAdminCard";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The bootstrap claim's mutation contract.
 *
 * The accepted requirement is that a signed-in principal with no role can
 * *reach* the admin panel and see the 'Claim administrator' action while the
 * register has no administrator. The reachability fix lives in the shell's
 * navigation; the claim mechanism itself is adjacent behavior that must keep
 * working, so this suite pins it: the card explains the bootstrap, the button
 * calls the register's `claimAdmin`, and a rejected claim surfaces the
 * already-held explanation rather than failing silently.
 *
 * The actor is a typed local mock, so this proves the frontend's contract with
 * the register, never the canister's own first-caller-wins rule.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
  return mockCoreInfrastructure({ actor: holder.actor });
});

describe("Claim administrator card", () => {
  beforeEach(() => {
    holder.actor.claimAdmin.mockReset();
    holder.actor.claimAdmin.mockResolvedValue({ __kind__: "ok", ok: "admin" });
  });

  it("explains the bootstrap and offers the claim action", () => {
    renderWithProviders(<ClaimAdminCard />);

    expect(screen.getByTestId("admin.claim_card")).toBeInTheDocument();
    expect(screen.getByText("No administrator yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        /first identity to claim the role becomes the administrator/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("admin.claim_admin_button")).toHaveTextContent(
      "Claim administrator",
    );
  });

  it("calls the register's claimAdmin when the action is pressed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClaimAdminCard />);

    await user.click(screen.getByTestId("admin.claim_admin_button"));

    await waitFor(() => {
      expect(holder.actor.claimAdmin).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces the already-held explanation when the claim is rejected", async () => {
    const user = userEvent.setup();
    holder.actor.claimAdmin.mockRejectedValue(new Error("already claimed"));
    renderWithProviders(<ClaimAdminCard />);

    await user.click(screen.getByTestId("admin.claim_admin_button"));

    expect(
      await screen.findByTestId("admin.claim_error_state"),
    ).toHaveTextContent(/already held by another principal/i);
  });
});
