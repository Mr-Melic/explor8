import { StatusChangeControl } from "@/components/lot/StatusChangeControl";
import { StatusHistoryPanel } from "@/components/lot/StatusHistoryPanel";
import type { LotView, StatusChange } from "@/lib/backend";
import { Capability, LotStatus, Role } from "@/lib/backend";
import { fakePrincipal, seedLots, seedReferenceByKind } from "@/test/fixtures";
import type { MockActor } from "@/test/mock-actor";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Status changes as provenance.
 *
 * The accepted request records every status change as a new event in the
 * block's chain and exposes the ordered history. These tests drive the two
 * surfaces that carry that contract: the control that offers only the
 * transitions the caller's role may make, and the panel that reads the
 * register's own ordered history and steps through it.
 *
 * The actor is a typed local mock, so this proves the frontend's contract with
 * the register, never the canister's own transition rules.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as MockActor,
  identity: { principal: "aaaaa-aa" as string | null },
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  const { seedReferenceByKind } = await import("@/test/fixtures");
  holder.actor = createMockActor({
    referenceEntries: seedReferenceByKind(),
  });
  return mockCoreInfrastructure({
    actor: holder.actor,
    identity: holder.identity,
  });
});

vi.mock("@caffeineai/object-storage", () => ({
  StorageClient: class {
    putFile = vi.fn(async () => ({ hash: "file-hash" }));
  },
  ExternalBlob: {
    fromBytes: () => ({
      withUploadProgress: () => ({ getBytes: async () => new Uint8Array() }),
      getBytes: async () => new Uint8Array(),
      contentType: "image/png",
      filename: "photo.png",
    }),
  },
}));

/** The seed lot that is still open, so a status change is available. */
function openLot(): LotView {
  const lot = seedLots().find(
    (candidate) => candidate.status === LotStatus.open,
  );
  if (!lot) throw new Error("fixture is missing an open seed lot");
  return lot;
}

function historyChange(
  seq: number,
  from: LotStatus,
  to: LotStatus,
): StatusChange {
  return {
    seq: BigInt(seq),
    from,
    to,
    at: 1_758_153_600_000_000_000n + BigInt(seq) * 3_600_000_000_000n,
    by: fakePrincipal("bbbbb-bb"),
  };
}

describe("Status change control", () => {
  beforeEach(() => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    holder.actor.getMyCapabilities.mockReset();
    holder.actor.getMyCapabilities.mockResolvedValue([
      Capability.change_status,
    ]);
    holder.actor.changeStatus.mockReset();
    holder.actor.changeStatus.mockResolvedValue({
      __kind__: "ok",
      ok: openLot(),
    });
  });

  it("offers only the transitions an administrator may make from the current status", async () => {
    renderWithProviders(<StatusChangeControl lot={openLot()} />);

    const select = await screen.findByTestId("lot.status_change_select");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    // The placeholder plus every move an admin may make from `open`: the
    // accepted request keeps admin able to perform any transition, so all five
    // other statuses are offered.
    expect(options).toEqual([
      "Choose a status…",
      "Testing Quality",
      "In transit",
      "Applied for crafting",
      "Retailed",
      "Confiscated by Authorities",
    ]);
  });

  it("offers a Quality Tester only the move to Testing Quality from Recently Mined", async () => {
    holder.actor.getMyRole.mockResolvedValue(Role.assayer);
    // The backend grants `change_status` only to an admin by default, so the
    // Quality Tester's control must open on the role's own transition matrix.
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    renderWithProviders(<StatusChangeControl lot={openLot()} />);

    const select = await screen.findByTestId("lot.status_change_select");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    // Exactly one transition: Recently Mined → Testing Quality. No other
    // status is offered, and the no-transition notice is not shown.
    expect(options).toEqual(["Choose a status…", "Testing Quality"]);
    expect(
      screen.queryByTestId("lot.status_change_no_transition_notice"),
    ).not.toBeInTheDocument();
  });

  it("lets a Quality Tester move an In Transit block to Testing Quality", async () => {
    const user = userEvent.setup();
    holder.actor.getMyRole.mockResolvedValue(Role.assayer);
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    const inTransit = { ...openLot(), status: LotStatus.in_transit };
    renderWithProviders(<StatusChangeControl lot={inTransit} />);

    await user.selectOptions(
      await screen.findByTestId("lot.status_change_select"),
      LotStatus.assayed,
    );
    await user.click(screen.getByTestId("lot.status_change_submit_button"));

    await waitFor(() => {
      expect(holder.actor.changeStatus).toHaveBeenCalledWith(inTransit.id, {
        to: LotStatus.assayed,
        payload: "",
      });
    });
  });

  it("offers a Custom Role the three moves out of Testing Quality", async () => {
    holder.actor.getMyRole.mockResolvedValue(Role.workshop);
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    const assayed = { ...openLot(), status: LotStatus.assayed };
    renderWithProviders(<StatusChangeControl lot={assayed} />);

    const select = await screen.findByTestId("lot.status_change_select");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    // Applied for crafting, Retailed or Confiscated by Authorities — and
    // nothing else, so the Custom Role cannot move a block back to Testing
    // Quality or on to In transit.
    expect(options).toEqual([
      "Choose a status…",
      "Applied for crafting",
      "Retailed",
      "Confiscated by Authorities",
    ]);
  });

  it("records a Custom Role's move from Testing Quality to Applied for crafting", async () => {
    const user = userEvent.setup();
    holder.actor.getMyRole.mockResolvedValue(Role.workshop);
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    const assayed = { ...openLot(), status: LotStatus.assayed };
    renderWithProviders(<StatusChangeControl lot={assayed} />);

    await user.selectOptions(
      await screen.findByTestId("lot.status_change_select"),
      LotStatus.closed,
    );
    await user.click(screen.getByTestId("lot.status_change_submit_button"));

    await waitFor(() => {
      expect(holder.actor.changeStatus).toHaveBeenCalledWith(assayed.id, {
        to: LotStatus.closed,
        payload: "",
      });
    });
  });

  it("shows the no-transition notice to a role with no move from the current status", async () => {
    // A Custom Role may only move out of Testing Quality, so from Recently
    // Mined it has no transition. The caller still holds `change_status`, so
    // the control opens and explains the empty matrix rather than offering a
    // dead action.
    holder.actor.getMyRole.mockResolvedValue(Role.workshop);
    holder.actor.getMyCapabilities.mockResolvedValue([
      Capability.change_status,
    ]);
    renderWithProviders(<StatusChangeControl lot={openLot()} />);

    expect(
      await screen.findByTestId("lot.status_change_no_transition_notice"),
    ).toHaveTextContent(/no status change is available/i);
    expect(
      screen.queryByTestId("lot.status_change_select"),
    ).not.toBeInTheDocument();
  });

  it("records the chosen transition and confirms it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatusChangeControl lot={openLot()} />);

    await user.selectOptions(
      await screen.findByTestId("lot.status_change_select"),
      LotStatus.assayed,
    );
    await user.type(
      screen.getByTestId("lot.status_change_note_input"),
      "Assay complete",
    );
    await user.click(screen.getByTestId("lot.status_change_submit_button"));

    await waitFor(() => {
      expect(holder.actor.changeStatus).toHaveBeenCalledWith(openLot().id, {
        to: LotStatus.assayed,
        payload: "Assay complete",
      });
    });
    expect(
      await screen.findByTestId("lot.status_change_success_state"),
    ).toHaveTextContent(`Status recorded for ${openLot().id}.`);
  });

  it("explains that a sealed block's status can no longer change", async () => {
    renderWithProviders(
      <StatusChangeControl lot={{ ...openLot(), frozen: true }} />,
    );

    expect(
      await screen.findByTestId("lot.status_change_frozen_notice"),
    ).toHaveTextContent(/sealed/i);
    expect(
      screen.queryByTestId("lot.status_change_select"),
    ).not.toBeInTheDocument();
  });

  it("tells a caller without the capability that their role may not change a status", async () => {
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    holder.actor.getMyCapabilities.mockResolvedValue([]);
    renderWithProviders(<StatusChangeControl lot={openLot()} />);

    expect(
      await screen.findByTestId("lot.status_change_permission_notice"),
    ).toHaveTextContent(/may not change a block's status/i);
    expect(
      screen.queryByTestId("lot.status_change_select"),
    ).not.toBeInTheDocument();
  });
});

describe("Status history panel", () => {
  beforeEach(() => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    holder.actor.getMyCapabilities.mockResolvedValue([
      Capability.change_status,
    ]);
    holder.actor.statusHistory.mockReset();
  });

  it("shows the empty state when no status change has been recorded", async () => {
    holder.actor.statusHistory.mockResolvedValue([]);
    renderWithProviders(<StatusHistoryPanel lot={openLot()} />);

    // The panel first shows its loading copy, then the resolved empty state.
    expect(
      await screen.findByText(/no status changes have been recorded/i),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("lot.status_history_empty_state"),
    ).toBeInTheDocument();
  });

  it("renders the register's ordered history oldest first", async () => {
    holder.actor.statusHistory.mockResolvedValue([
      historyChange(2, LotStatus.open, LotStatus.assayed),
      historyChange(5, LotStatus.assayed, LotStatus.closed),
    ]);
    renderWithProviders(<StatusHistoryPanel lot={openLot()} />);

    const panel = await screen.findByTestId("lot.status_history");
    // The register's own history wins over the lot view's fallback.
    expect(holder.actor.statusHistory).toHaveBeenCalledWith(openLot().id);

    const rows = within(panel).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // Oldest first: the open → assayed change precedes assayed → closed.
    expect(rows[0]).toHaveTextContent("#2");
    expect(rows[0]).toHaveTextContent("Recently Mined");
    expect(rows[0]).toHaveTextContent("Testing Quality");
    expect(rows[1]).toHaveTextContent("#5");
    expect(rows[1]).toHaveTextContent("Applied for crafting");
  });

  it("steps through a long chain with in-block arrow navigation", async () => {
    const user = userEvent.setup();
    holder.actor.statusHistory.mockResolvedValue([
      historyChange(2, LotStatus.open, LotStatus.assayed),
      historyChange(5, LotStatus.assayed, LotStatus.closed),
    ]);
    renderWithProviders(<StatusHistoryPanel lot={openLot()} />);

    const panel = await screen.findByTestId("lot.status_history");
    // The reader opens on the newest entry.
    expect(panel).toHaveTextContent("Status change 2 of 2");

    await user.click(screen.getByTestId("lot.status_history_prev"));
    expect(panel).toHaveTextContent("Status change 1 of 2");

    // The first entry is the oldest, so the previous arrow is now disabled.
    expect(screen.getByTestId("lot.status_history_prev")).toBeDisabled();

    await user.click(screen.getByTestId("lot.status_history_next"));
    expect(panel).toHaveTextContent("Status change 2 of 2");
    expect(screen.getByTestId("lot.status_history_next")).toBeDisabled();
  });
});
