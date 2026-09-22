import { AppHeader } from "@/components/layout/AppHeader";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/backend";

/**
 * The header's site-wide text-size control.
 *
 * The accepted request adds an 'A-a' stepped control with plus, minus and
 * zero-reset actions that scales all text site-wide and remembers the choice.
 * The register's type scale is expressed in `rem`, so the control works by
 * setting the root font size; jsdom has no layout engine, so these tests assert
 * the observable contract: the root font size changes, the step is persisted to
 * `localStorage`, and a fresh mount restores it.
 *
 * The actor is a typed local mock, so this proves the header's own behaviour,
 * never the canister.
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

const STORAGE_KEY = "explor8-text-size";

describe("Header text-size control", () => {
  beforeEach(() => {
    holder.identity.principal = null;
    holder.actor.getMyRole.mockReset();
    holder.actor.getMyRole.mockResolvedValue(Role.guest);
    window.localStorage.clear();
    document.documentElement.style.fontSize = "";
  });

  it("renders the A-a control with plus, minus and reset actions", () => {
    renderWithProviders(<AppHeader />);

    expect(screen.getByTestId("header.text_size_control")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increase text size/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /decrease text size/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reset text size to default/i }),
    ).toHaveTextContent("A-a");
  });

  it("increases the root font size on plus and persists the step", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    // The default step is 100%.
    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("100%");
    });

    await user.click(
      screen.getByRole("button", { name: /increase text size/i }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("112.5%");
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("2");
  });

  it("decreases the root font size on minus", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    await user.click(
      screen.getByRole("button", { name: /decrease text size/i }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("87.5%");
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
  });

  it("restores the default on the zero-reset action after a change", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    await user.click(
      screen.getByRole("button", { name: /increase text size/i }),
    );
    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("112.5%");
    });

    await user.click(
      screen.getByRole("button", { name: /reset text size to default/i }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("100%");
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("restores the persisted step on a fresh mount", async () => {
    window.localStorage.setItem(STORAGE_KEY, "3");

    renderWithProviders(<AppHeader />);

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("125%");
    });
  });

  it("disables an action at its bound rather than wrapping", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppHeader />);

    // Walk down to the smallest step; the decrease action is then disabled.
    const decrease = screen.getByRole("button", {
      name: /decrease text size/i,
    });
    await user.click(decrease);
    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("87.5%");
    });
    expect(decrease).toBeDisabled();

    // Walk up to the largest step; the increase action is then disabled.
    const increase = screen.getByRole("button", {
      name: /increase text size/i,
    });
    for (let i = 0; i < 4; i += 1) {
      await user.click(increase);
    }
    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("137.5%");
    });
    expect(increase).toBeDisabled();
  });
});
