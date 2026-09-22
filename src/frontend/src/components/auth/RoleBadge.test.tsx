import { RoleBadge } from "@/components/auth/RoleBadge";
import { Role } from "@/lib/backend";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * The role stamp's display terms.
 *
 * The accepted request renamed the `assayer` role to 'Quality Tester' and the
 * `workshop` role to 'Custom Role'. The register stores the stable role tags,
 * so the badge must render the renamed terms and never the retired ones.
 */
describe("Role badge", () => {
  it("renders the assayer role as 'Quality Tester'", () => {
    render(<RoleBadge userRole={Role.assayer} />);

    expect(screen.getByTestId("auth.role_badge")).toHaveTextContent(
      "Quality Tester",
    );
    expect(screen.queryByText(/Assayer/i)).not.toBeInTheDocument();
  });

  it("renders the workshop role as 'Custom Role'", () => {
    render(<RoleBadge userRole={Role.workshop} />);

    expect(screen.getByTestId("auth.role_badge")).toHaveTextContent(
      "Custom Role",
    );
    expect(screen.queryByText(/Workshop/i)).not.toBeInTheDocument();
  });

  it("renders the awaiting-role state for a principal with no role", () => {
    render(<RoleBadge userRole={null} awaitingRole />);

    expect(screen.getByTestId("auth.role_badge")).toHaveTextContent(
      "Awaiting role",
    );
  });
});
