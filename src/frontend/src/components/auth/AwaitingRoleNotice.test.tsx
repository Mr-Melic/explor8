import { AwaitingRoleNotice } from "@/components/auth/AwaitingRoleNotice";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  return mockCoreInfrastructure({ actor: createMockActor() });
});

/**
 * The signed-out / awaiting-role notice carries the Explor8 identity. The
 * accepted request renamed the product away from 'Gold Book', so this guards
 * the copy the notice shows a reader who has not signed in.
 */
describe("Awaiting role notice", () => {
  it("names Explor8 and never the retired Gold Book identity", () => {
    renderWithProviders(<AwaitingRoleNotice isAuthenticated={false} />);

    expect(
      screen.getByText(/Reading the Explor8 register is open to everyone/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Gold Book/i)).not.toBeInTheDocument();
  });

  it("tells a signed-in principal with no role that access is read-only", () => {
    renderWithProviders(<AwaitingRoleNotice isAuthenticated />);

    expect(
      screen.getByText(/Waiting for an administrator to assign a role/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/read-only access to the register/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Gold Book/i)).not.toBeInTheDocument();
  });
});
