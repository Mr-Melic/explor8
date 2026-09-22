import { EnquirySection } from "@/components/enquiry/EnquirySection";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnquiryView } from "@/lib/backend";
import { fakePrincipal } from "@/test/fixtures";

/**
 * The 'Contact us to make a purchase' fold-out form.
 *
 * The accepted request places the form under the intro text, collapsed by
 * default, and requires sign-in to submit with a consent checkbox to share
 * information until withdrawn. A signed-in submitter can read their own
 * submissions and withdraw permission per submission.
 *
 * The actor is a typed local mock, so this proves the section's own behaviour
 * and its contract with the enquiry endpoints, never the canister.
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

/** Fill the form's required fields and tick consent. */
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("home.enquiry_name_input"), "Ada");
  await user.type(
    screen.getByTestId("home.enquiry_email_input"),
    "ada@example.com",
  );
  await user.type(
    screen.getByTestId("home.enquiry_message_input"),
    "I would like to buy the emerald lot.",
  );
  await user.click(screen.getByTestId("home.enquiry_consent_checkbox"));
}

describe("Purchase enquiry section", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue("guest");
    holder.actor.listMyEnquiries.mockReset();
    holder.actor.listMyEnquiries.mockResolvedValue({ __kind__: "ok", ok: [] });
    holder.actor.submitEnquiry.mockReset();
    holder.actor.submitEnquiry.mockResolvedValue({
      __kind__: "ok",
      ok: enquiry(),
    });
    holder.actor.withdrawEnquiry.mockReset();
    holder.actor.withdrawEnquiry.mockResolvedValue({
      __kind: "ok",
      ok: enquiry({ withdrawn: true }),
    });
    window.localStorage.clear();
  });

  it("is collapsed under the intro text and expands when opened", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EnquirySection />);

    expect(
      screen.getByRole("heading", { name: /Contact us to make a purchase/i }),
    ).toBeInTheDocument();

    const toggle = screen.getByTestId("home.enquiry_toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("home.enquiry_form")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByTestId("home.enquiry_form")).toBeInTheDocument();
  });

  it("blocks a signed-out submitter with a visible sign-in requirement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EnquirySection />);

    await user.click(screen.getByTestId("home.enquiry_toggle"));

    expect(
      await screen.findByTestId("home.enquiry_sign_in_required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Sign in with Internet Identity to submit an enquiry/i),
    ).toBeInTheDocument();

    // Even with every field filled and consent ticked, the submit is disabled.
    await fillForm(user);
    expect(screen.getByTestId("home.enquiry_submit_button")).toBeDisabled();
  });

  it("keeps submit disabled until the consent box is ticked", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    renderWithProviders(<EnquirySection />);

    await user.click(screen.getByTestId("home.enquiry_toggle"));
    await user.type(screen.getByTestId("home.enquiry_name_input"), "Ada");
    await user.type(
      screen.getByTestId("home.enquiry_email_input"),
      "ada@example.com",
    );
    await user.type(
      screen.getByTestId("home.enquiry_message_input"),
      "I would like to buy the emerald lot.",
    );

    expect(screen.getByTestId("home.enquiry_submit_button")).toBeDisabled();
    expect(
      screen.getByText(/Tick the consent box to enable submission/i),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("home.enquiry_consent_checkbox"));
    expect(screen.getByTestId("home.enquiry_submit_button")).toBeEnabled();
  });

  it("submits a signed-in enquiry with consent and reports success", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    renderWithProviders(<EnquirySection />);

    await user.click(screen.getByTestId("home.enquiry_toggle"));
    await fillForm(user);
    await user.click(screen.getByTestId("home.enquiry_submit_button"));

    await waitFor(() => {
      expect(holder.actor.submitEnquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Ada",
          email: "ada@example.com",
          message: "I would like to buy the emerald lot.",
          consent: true,
        }),
      );
    });
    expect(
      await screen.findByTestId("home.enquiry_success_state"),
    ).toBeInTheDocument();
  });

  it("lists the submitter's own enquiries and withdraws one", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    holder.actor.listMyEnquiries.mockResolvedValue({
      __kind__: "ok",
      ok: [enquiry()],
    });
    renderWithProviders(<EnquirySection />);

    await user.click(screen.getByTestId("home.enquiry_toggle"));

    const list = await screen.findByTestId("home.enquiry_mine_list");
    expect(list).toBeInTheDocument();
    expect(
      screen.getByText("I would like to buy the emerald lot."),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("home.enquiry_withdraw_button.1"));

    await waitFor(() => {
      expect(holder.actor.withdrawEnquiry).toHaveBeenCalledWith("enq-1");
    });
  });

  it("marks an already-withdrawn enquiry and offers no withdraw control", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    holder.actor.listMyEnquiries.mockResolvedValue({
      __kind__: "ok",
      ok: [enquiry({ withdrawn: true })],
    });
    renderWithProviders(<EnquirySection />);

    await user.click(screen.getByTestId("home.enquiry_toggle"));

    await screen.findByTestId("home.enquiry_mine_list");
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(
      screen.queryByTestId("home.enquiry_withdraw_button.1"),
    ).not.toBeInTheDocument();
  });
});
