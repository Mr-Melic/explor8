import { AdminEnquirySection } from "@/components/admin/AdminEnquirySection";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefKind, Role } from "@/lib/backend";
import type { EnquiryView, RefEntryView } from "@/lib/backend";
import { fakePrincipal } from "@/test/fixtures";

/**
 * The admin panel's purchase-enquiry inbox.
 *
 * The accepted request adds an inbox listing every non-withdrawn enquiry, with
 * an optional destination email stored as reference data. When no address is
 * set, no email is sent and the section says so in plain language.
 *
 * The actor is a typed local mock, so this proves the panel's own behaviour and
 * its contract with the enquiry and reference-data endpoints, never the
 * canister.
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

function enquiry(overrides: Partial<EnquiryView> = {}): EnquiryView {
  return {
    id: "enq-1",
    consent: true,
    name: "Ada",
    submittedAt: 1_758_153_600_000_000_000n,
    submittedBy: fakePrincipal(),
    email: "ada@example.com",
    message: "I would like to buy the emerald lot.",
    phone: "",
    withdrawn: false,
    ...overrides,
  };
}

function destinationEntry(value: string): RefEntryView {
  return {
    id: "ref-dest",
    kind: RefKind.enquiry_destination,
    key: "enquiry_destination",
    displayName: "Enquiry destination",
    value,
    sortOrder: 1n,
    active: true,
  };
}

describe("Admin enquiry inbox", () => {
  beforeEach(() => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.admin);
    holder.actor.listEnquiries.mockReset();
    holder.actor.listEnquiries.mockResolvedValue({ __kind__: "ok", ok: [] });
    holder.actor.listAllReferenceEntries.mockReset();
    holder.actor.listAllReferenceEntries.mockResolvedValue({
      __kind__: "ok",
      ok: [],
    });
    window.localStorage.clear();
  });

  it("locks the inbox for a caller who is not an administrator", async () => {
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    renderWithProviders(<AdminEnquirySection />);

    expect(
      await screen.findByTestId("admin.enquiries_locked_state"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin.enquiries_panel"),
    ).not.toBeInTheDocument();
  });

  it("lists every non-withdrawn enquiry for an admin", async () => {
    holder.actor.listEnquiries.mockResolvedValue({
      __kind__: "ok",
      ok: [enquiry()],
    });
    renderWithProviders(<AdminEnquirySection />);

    const list = await screen.findByTestId("admin.enquiries_list");
    expect(list).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("I would like to buy the emerald lot."),
    ).toBeInTheDocument();
  });

  it("shows an empty state when the register holds no open enquiries", async () => {
    renderWithProviders(<AdminEnquirySection />);

    expect(
      await screen.findByTestId("admin.enquiries_empty_state"),
    ).toBeInTheDocument();
  });

  it("notes the missing destination email and sends nothing when none is set", async () => {
    renderWithProviders(<AdminEnquirySection />);

    const notice = await screen.findByTestId(
      "admin.enquiries_destination_unset",
    );
    expect(notice).toHaveTextContent(/No destination email is set/i);
    expect(notice).toHaveTextContent(/No enquiry email is sent/i);
  });

  it("reports the configured destination email when one is stored", async () => {
    holder.actor.listAllReferenceEntries.mockResolvedValue({
      __kind__: "ok",
      ok: [destinationEntry("purchases@jewelofafrica.example")],
    });
    renderWithProviders(<AdminEnquirySection />);

    const notice = await screen.findByTestId("admin.enquiries_destination_set");
    expect(notice).toHaveTextContent(
      /Enquiries are directed to purchases@jewelofafrica.example/i,
    );
  });

  it("does not read the inbox in demo mode", async () => {
    window.localStorage.setItem("explor8-data-mode", "demo");
    renderWithProviders(<AdminEnquirySection />);

    expect(
      await screen.findByTestId("admin.enquiries_demo_notice"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(holder.actor.listEnquiries).not.toHaveBeenCalled();
    });
  });
});
