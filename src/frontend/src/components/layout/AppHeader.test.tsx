import { AppHeader } from "@/components/layout/AppHeader";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
  identity: { principal: null as string | null },
  login: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor();
  return mockCoreInfrastructure({
    actor: holder.actor,
    identity: holder.identity,
    login: holder.login,
    clear: holder.clear,
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

describe("App header", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.login.mockClear();
    holder.clear.mockClear();
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("shows the Explor8 title with its Jewel of Africa subtitle and no Gold Book wording", () => {
    const { container } = renderWithProviders(<AppHeader />);

    expect(screen.getByText("Explor8")).toBeInTheDocument();
    // The subtitle is split into a muted lead and an accent brand span so
    // 'JEWEL OF AFRICA' can be highlighted; assert both halves of the line.
    const subtitle = container.querySelector(".header-subtitle");
    expect(subtitle).not.toBeNull();
    expect(
      subtitle?.querySelector("span:not(.subtitle-brand)")?.textContent,
    ).toBe("A product of");
    expect(subtitle?.querySelector(".subtitle-brand")?.textContent).toBe(
      "Jewel of Africa",
    );
    // The retired 'Gold Book' identity must not appear anywhere in the header.
    expect(screen.queryByText(/Gold Book/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Licence reminder: every lot must carry a valid JOA licence reference/i,
      ),
    ).toBeInTheDocument();
  });

  it("offers Real-time and Demo data buttons with Real-time active by default", () => {
    renderWithProviders(<AppHeader />);

    const realtime = screen.getByTestId("header.realtime_button");
    const demo = screen.getByTestId("header.demo_button");
    expect(realtime).toHaveTextContent("Real-time");
    expect(demo).toHaveTextContent("Demo data");
    // The active mode is exposed to assistive technology, not only by colour.
    expect(realtime).toHaveAttribute("aria-pressed", "true");
    expect(demo).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the active mode to Demo data and persists the choice", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    await user.click(screen.getByTestId("header.demo_button"));

    expect(screen.getByTestId("header.demo_button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("header.realtime_button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(window.localStorage.getItem("explor8-data-mode")).toBe("demo");
  });

  it("restores the persisted Demo data mode on a fresh mount", () => {
    window.localStorage.setItem("explor8-data-mode", "demo");
    renderWithProviders(<AppHeader />);

    expect(screen.getByTestId("header.demo_button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("header.realtime_button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders the chain mark as a decorative, non-focusable graphic", () => {
    const { container } = renderWithProviders(<AppHeader />);

    // The mark is the header's only SVG; `chain-pulse` is the animated group
    // inside it, not a class on the root element.
    const mark = container.querySelector("svg");
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveAttribute("focusable", "false");
    // The draw-on animation is a CSS class; the reduced-motion override lives
    // in the stylesheet and is not exercised by this jsdom run.
    expect(mark?.querySelectorAll("path.chain-draw").length).toBe(2);
    expect(mark?.querySelector("g.chain-pulse")).not.toBeNull();
  });

  it("defaults to the dark theme and toggles to light, persisting the choice", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    const toggle = screen.getByTestId("theme.toggle");
    // Dark is the register's base palette on `:root`, so the default needs no
    // class; the toggle reports the active theme through `aria-pressed`.
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName("Switch to light theme");
    expect(document.documentElement.classList.contains("light")).toBe(false);

    await user.click(toggle);

    await waitFor(() => {
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Switch to dark theme");
    expect(window.localStorage.getItem("explor8-theme")).toBe("light");
  });

  it("offers Internet Identity sign-in to a guest and no register action", () => {
    renderWithProviders(<AppHeader />);

    expect(screen.getByTestId("header.sign_in_button")).toBeInTheDocument();
    expect(
      screen.queryByTestId("header.register_lot_button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("header.sign_out_button"),
    ).not.toBeInTheDocument();
  });

  it("shows the signed-in principal and a sign-out control", () => {
    holder.identity.principal = "aaaaa-aa";
    renderWithProviders(<AppHeader />);

    expect(screen.getByTestId("header.sign_out_button")).toBeInTheDocument();
    expect(screen.getByTestId("header.principal")).toHaveTextContent(
      "aaaaa-aa",
    );
    expect(
      screen.queryByTestId("header.sign_in_button"),
    ).not.toBeInTheDocument();
  });

  it("invokes the identity login when a guest signs in", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    await user.click(screen.getByTestId("header.sign_in_button"));

    expect(holder.login).toHaveBeenCalledTimes(1);
  });

  it("invokes the identity clear when a signed-in principal signs out", async () => {
    const user = userEvent.setup();
    holder.identity.principal = "aaaaa-aa";
    renderWithProviders(<AppHeader />);

    await user.click(screen.getByTestId("header.sign_out_button"));

    expect(holder.clear).toHaveBeenCalledTimes(1);
  });

  it("offers the register-lot action only to a writing role", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.field_officer);
    renderWithProviders(<AppHeader />);

    expect(
      await screen.findByTestId("header.register_lot_button"),
    ).toBeInTheDocument();
  });

  it("hides the register-lot action from a signed-in reader with no writing role", async () => {
    holder.identity.principal = "aaaaa-aa";
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    renderWithProviders(<AppHeader />);

    // Wait for the role query to settle before asserting the absence.
    await waitFor(() => {
      expect(screen.getByTestId("header.principal")).toHaveTextContent(
        "aaaaa-aa",
      );
    });
    expect(
      screen.queryByTestId("header.register_lot_button"),
    ).not.toBeInTheDocument();
  });
});
