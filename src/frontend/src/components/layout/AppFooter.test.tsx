import { AppFooter } from "@/components/layout/AppFooter";
import { Role } from "@/lib/backend";
import { renderWithProviders, renderWithRouter } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedSummary } = await import("@/test/fixtures");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor({ summary: seedSummary() });
  return mockCoreInfrastructure({
    actor: holder.actor,
    identity: holder.identity,
  });
});

describe("App footer", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.registerSummary.mockClear();
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.hasAdmin.mockReset();
    holder.actor.hasAdmin.mockResolvedValue(false);
    window.localStorage.clear();
  });

  it("keeps the append-only disclaimer and the JOA Lusaka line", async () => {
    renderWithProviders(<AppFooter />);

    expect(
      screen.getByText(
        /Public register of sealed lots\. Records are append-only\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /not an offer of securities, and not a gold-backed token/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Jewel of Africa Limited · Lusaka, Zambia"),
    ).toBeInTheDocument();
  });

  it("reports the register's own live lot and event totals", async () => {
    renderWithProviders(<AppFooter />);

    await waitFor(() => {
      expect(screen.getByTestId("footer.lot_count")).toHaveTextContent(
        "3 lots sealed",
      );
    });
    expect(screen.getByTestId("footer.event_count")).toHaveTextContent(
      "7 events recorded",
    );
  });

  it("credits Le Royalties Sergio Melicio with the auto-advancing year range", () => {
    renderWithProviders(<AppFooter />);

    // The range opens at 2026 and closes on the current year plus one, so it
    // advances on its own every January.
    const endYear = new Date().getFullYear() + 1;
    expect(
      screen.getByText(
        `© 2026 – ${endYear}. Built with love by Le Royalties Sergio Melicio for Jewel of Africa`,
      ),
    ).toBeInTheDocument();
  });

  it("hides the Admin button from a signed-out visitor", () => {
    renderWithProviders(<AppFooter />);

    expect(screen.queryByTestId("footer.admin_button")).not.toBeInTheDocument();
  });

  it("hides the Admin button from a signed-in non-admin", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.field_officer);
    renderWithProviders(<AppFooter />);

    // Wait for the role query to settle before asserting the absence.
    await waitFor(() => {
      expect(holder.actor.getMyRole).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("footer.admin_button")).not.toBeInTheDocument();
  });

  it("shows the Admin button to a signed-in administrator and links to the panel", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    // The Admin control is a router `<Link>`, so it needs a router context.
    renderWithRouter(<AppFooter />);

    const admin = await screen.findByTestId("footer.admin_button");
    expect(admin).toHaveTextContent("Admin");
    expect(admin).toHaveAttribute("href", "/admin");
  });

  it("offers the claim path to a signed-in principal with no role while no admin exists", async () => {
    holder.identity.principal = "aaaaa-aa";
    // A signed-in principal the register has not assigned a role yet.
    holder.actor.getMyRole.mockResolvedValue(null);
    holder.actor.hasAdmin.mockResolvedValue(false);
    renderWithRouter(<AppFooter />);

    const claim = await screen.findByTestId("footer.admin_button");
    expect(claim).toHaveTextContent("Claim administrator");
    expect(claim).toHaveAttribute("href", "/admin");
  });

  it("offers the claim path to a signed-in guest-role identity while no admin exists", async () => {
    // `getMyRole` answers `guest` for a roleless principal, so the gate must
    // key on `hasAdmin` rather than on `awaitingRole`.
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.hasAdmin.mockResolvedValue(false);
    renderWithRouter(<AppFooter />);

    const claim = await screen.findByTestId("footer.admin_button");
    expect(claim).toHaveTextContent("Claim administrator");
    expect(claim).toHaveAttribute("href", "/admin");
  });

  it("withdraws the claim path from a guest-role identity once an administrator exists", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.hasAdmin.mockResolvedValue(true);
    renderWithRouter(<AppFooter />);

    // Wait for the role and hasAdmin queries to settle before asserting absence.
    await waitFor(() => {
      expect(holder.actor.hasAdmin).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("footer.admin_button")).not.toBeInTheDocument();
  });

  it("withdraws the claim path once an administrator exists", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(null);
    holder.actor.hasAdmin.mockResolvedValue(true);
    renderWithRouter(<AppFooter />);

    // Wait for the role and hasAdmin queries to settle before asserting absence.
    await waitFor(() => {
      expect(holder.actor.hasAdmin).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("footer.admin_button")).not.toBeInTheDocument();
  });
});
