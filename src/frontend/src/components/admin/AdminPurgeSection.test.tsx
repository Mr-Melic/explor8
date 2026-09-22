import { AdminPurgeSection } from "@/components/admin/AdminPurgeSection";
import { PURGE_PHRASE } from "@/components/admin/PurgeConfirmDialog";
import type { PurgeOutcome, PurgeRequestView } from "@/lib/backend";
import { fakePrincipal } from "@/test/fixtures";
import type { MockActor } from "@/test/mock-actor";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin-only "Purge all register data" workflow.
 *
 * The register is append-only, so the purge is the one irreversible action.
 * These tests drive the section's own contract with the register: it is offered
 * only to an administrator, its dialog refuses to submit until the exact phrase
 * is typed, an open request shows how many administrators have confirmed, and a
 * completed purge reports what was removed.
 *
 * The actor is a typed local mock, so this proves the frontend's contract with
 * the register, never the canister's own multi-admin threshold.
 */

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as MockActor,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
  return mockCoreInfrastructure({ actor: holder.actor });
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

const REQUESTED_AT = 1_758_153_600_000_000_000n;

function pendingRequest(
  overrides: Partial<PurgeRequestView> = {},
): PurgeRequestView {
  return {
    id: "purge-0",
    confirmedBy: [fakePrincipal("aaaaa-aa")],
    totalAdmins: 3n,
    confirmedCount: 1n,
    requiredConfirmations: 2n,
    requestedAt: REQUESTED_AT,
    requestedBy: fakePrincipal("aaaaa-aa"),
    ...overrides,
  };
}

function executedOutcome(): PurgeOutcome {
  return {
    __kind__: "executed",
    executed: {
      purgedAt: REQUESTED_AT,
      purgedBy: fakePrincipal("aaaaa-aa"),
      eventsRemoved: 7n,
      lotsRemoved: 3n,
      filesRemoved: 0n,
    },
  };
}

describe("Admin purge section", () => {
  beforeEach(() => {
    holder.actor.getPurgeRequest.mockReset();
    holder.actor.getPurgeRequest.mockResolvedValue({
      __kind__: "ok",
      ok: null,
    });
    holder.actor.requestPurge.mockReset();
    holder.actor.requestPurge.mockResolvedValue({
      __kind__: "ok",
      ok: { __kind__: "pending", pending: pendingRequest() },
    });
    holder.actor.confirmPurge.mockReset();
    holder.actor.confirmPurge.mockResolvedValue({
      __kind__: "ok",
      ok: executedOutcome(),
    });
  });

  it("locks the purge action for a caller who is not an administrator", async () => {
    renderWithProviders(<AdminPurgeSection canAdminister={false} />);

    expect(
      await screen.findByTestId("admin.purge_locked_state"),
    ).toBeInTheDocument();
    // The destructive control is not offered at all.
    expect(
      screen.queryByTestId("admin.purge_open_modal_button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin.purge_panel")).not.toBeInTheDocument();
  });

  it("offers the purge action to an administrator with no open request", async () => {
    renderWithProviders(<AdminPurgeSection canAdminister />);

    expect(
      await screen.findByTestId("admin.purge_idle_state"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("admin.purge_open_modal_button"),
    ).toHaveTextContent(/Purge all register data/i);
  });

  it("keeps the confirm button disabled until the exact phrase is typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminPurgeSection canAdminister />);

    await user.click(
      await screen.findByTestId("admin.purge_open_modal_button"),
    );
    const dialog = await screen.findByTestId("admin.purge_confirm_dialog");
    const confirm = screen.getByTestId("admin.purge_confirm_button");

    // Nothing typed yet: the action is disabled.
    expect(confirm).toBeDisabled();

    // A near-miss phrase — wrong case — is still refused.
    const input = screen.getByTestId("admin.purge_phrase_input");
    await user.type(input, "delete all data");
    expect(confirm).toBeDisabled();
    expect(screen.getByTestId("admin.purge_phrase_hint")).toHaveTextContent(
      /does not match/i,
    );

    // The exact, case-sensitive phrase enables the action.
    await user.clear(input);
    await user.type(input, PURGE_PHRASE);
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    expect(dialog).toBeInTheDocument();
  });

  it("opens a purge request with the typed phrase and shows the pending state", async () => {
    const user = userEvent.setup();
    // The first read finds no open request; the request mutation invalidates
    // the purge query, so the refetch returns the newly-open request and the
    // pending panel appears.
    holder.actor.getPurgeRequest
      .mockResolvedValueOnce({ __kind__: "ok", ok: null })
      .mockResolvedValue({ __kind__: "ok", ok: pendingRequest() });
    renderWithProviders(<AdminPurgeSection canAdminister />);

    await user.click(
      await screen.findByTestId("admin.purge_open_modal_button"),
    );
    await user.type(
      await screen.findByTestId("admin.purge_phrase_input"),
      PURGE_PHRASE,
    );
    await user.click(screen.getByTestId("admin.purge_confirm_button"));

    await waitFor(() => {
      expect(holder.actor.requestPurge).toHaveBeenCalledWith(PURGE_PHRASE);
    });

    // The pending panel names how many administrators have confirmed and how
    // many are required.
    const pending = await screen.findByTestId("admin.purge_pending_state");
    expect(pending).toBeInTheDocument();
    expect(screen.getByTestId("admin.purge_confirmed_count")).toHaveTextContent(
      "1 of 2 required",
    );
    expect(screen.getByTestId("admin.purge_total_admins")).toHaveTextContent(
      "3",
    );
  });

  it("shows an already-open request's confirmation progress on load", async () => {
    holder.actor.getPurgeRequest.mockResolvedValue({
      __kind__: "ok",
      ok: pendingRequest({ confirmedCount: 2n, requiredConfirmations: 3n }),
    });

    renderWithProviders(<AdminPurgeSection canAdminister />);

    const pending = await screen.findByTestId("admin.purge_pending_state");
    expect(pending).toBeInTheDocument();
    expect(screen.getByTestId("admin.purge_confirmed_count")).toHaveTextContent(
      "2 of 3 required",
    );
    // The idle "start a purge" control is replaced by the pending panel.
    expect(
      screen.queryByTestId("admin.purge_open_modal_button"),
    ).not.toBeInTheDocument();
  });

  it("reports the completed purge once the threshold is met", async () => {
    const user = userEvent.setup();
    holder.actor.getPurgeRequest.mockResolvedValue({
      __kind__: "ok",
      ok: pendingRequest({ confirmedCount: 1n, requiredConfirmations: 2n }),
    });
    renderWithProviders(<AdminPurgeSection canAdminister />);

    await user.click(
      await screen.findByTestId("admin.purge_confirm_request_button"),
    );

    await waitFor(() => {
      expect(holder.actor.confirmPurge).toHaveBeenCalledTimes(1);
    });

    const success = await screen.findByTestId("admin.purge_success_state");
    expect(success).toHaveTextContent(/register has been purged/i);
    expect(screen.getByTestId("admin.purge_lots_removed")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("admin.purge_events_removed")).toHaveTextContent(
      "7",
    );
  });
});
