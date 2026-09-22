import { AppHeader } from "@/components/layout/AppHeader";
import { HomePage } from "@/pages/HomePage";
import { renderWithProviders } from "@/test/render";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({
  actor: undefined as unknown as ReturnType<
    typeof import("@/test/mock-actor").createMockActor
  >,
}));

vi.mock("@caffeineai/core-infrastructure", async () => {
  const { createMockActor } = await import("@/test/mock-actor");
  const { seedLots, seedReferenceByKind, seedSummary } = await import(
    "@/test/fixtures"
  );
  const { mockCoreInfrastructure } = await import("@/test/render");
  holder.actor = createMockActor({
    lots: seedLots(),
    summary: seedSummary(),
    referenceEntries: seedReferenceByKind(),
  });
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

function resetUrl() {
  window.history.replaceState(null, "", "/");
}

describe("Library home page", () => {
  beforeEach(() => {
    resetUrl();
    window.localStorage.clear();
    holder.actor.listLots.mockClear();
    holder.actor.registerSummary.mockClear();
    holder.actor.searchLots.mockClear();
  });

  it("renders the Library for a logged-out guest without a blank screen", async () => {
    renderWithProviders(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: /Explor8 Precious Material Origin History register/i,
      }),
    ).toBeInTheDocument();
    // The accepted request renamed the section heading to
    // 'Asset Registry Explorer'.
    expect(
      screen.getByRole("heading", { name: /Asset Registry Explorer/i }),
    ).toBeInTheDocument();

    // The three seed lots are listed for a guest who never signed in.
    await waitFor(() => {
      expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    });
    expect(screen.getByText("JOA-MFB-20260918-0048")).toBeInTheDocument();
    expect(screen.getByText("JOA-LUS-20260912-0003")).toBeInTheDocument();
  });

  it("shows the shortened content hash on a collapsed block", async () => {
    renderWithProviders(<HomePage />);

    const block = await screen.findByTestId("lot.item.1");
    // The collapsed card shows the shortened hash, not the full 64 characters.
    const shortened = within(block).getByText(/^3f9a1c2b…/);
    expect(shortened).toBeInTheDocument();
    expect(shortened.textContent?.length).toBeLessThan(64);
  });

  it("expands a seed lot on click and reveals the full 64-character hash", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    const openButton = await screen.findByTestId("lot.open_button.1");
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    await user.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    const fullHash = await screen.findByText(
      "3f9a1c2b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8",
    );
    expect(fullHash).toBeInTheDocument();
    expect(fullHash.textContent).toHaveLength(64);
  });

  it("expands the lot named by a ?lot= deep link for a guest", async () => {
    window.history.replaceState(null, "", "/?lot=JOA-LUS-20260912-0003");
    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("lot.open_button.3")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });
    // The expanded panel shows the lot's own facts.
    expect(screen.getByText("Lusaka workshop")).toBeInTheDocument();
  });

  it("renders the register graph from the register's own summary data", async () => {
    renderWithProviders(<HomePage />);

    // The activity view plots the summary's own day buckets.
    const chart = await screen.findByRole("img", {
      name: /Events appended per day across the register/i,
    });
    expect(chart).toBeInTheDocument();
    expect(screen.getByText(/Peak 5 events/)).toBeInTheDocument();
  });

  it("filters by kind chip and reflects the state in the URL", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("register.filter.type.emerald"));

    await waitFor(() => {
      expect(window.location.search).toContain("type=emerald");
    });
    expect(screen.getByText("JOA-LUS-20260912-0003")).toBeInTheDocument();
    expect(screen.queryByText("JOA-MFB-20260918-0047")).not.toBeInTheDocument();
  });

  it("narrows the library by search term and reports the visible count", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.type(screen.getByLabelText(/Search the register/i), "TYV-88355");

    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        "1 of 3 lots shown",
      );
    });
    expect(screen.getByText("JOA-MFB-20260918-0048")).toBeInTheDocument();
    expect(screen.queryByText("JOA-MFB-20260918-0047")).not.toBeInTheDocument();
  });

  it("narrows the library to the selected site's lots", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.click(screen.getByTestId("register.filter.site.MFB"));

    // The two MFB lots remain; the LUS lot is filtered out.
    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        "2 of 3 lots shown",
      );
    });
    expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    expect(screen.getByText("JOA-MFB-20260918-0048")).toBeInTheDocument();
    expect(screen.queryByText("JOA-LUS-20260912-0003")).not.toBeInTheDocument();
    expect(window.location.search).toContain("site=MFB");
  });

  it("narrows the library to the selected status's lots", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    // Only the third seed lot is retailed.
    await user.click(screen.getByTestId("register.filter.status.retailed"));

    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        "1 of 3 lots shown",
      );
    });
    expect(screen.getByText("JOA-LUS-20260912-0003")).toBeInTheDocument();
    expect(screen.queryByText("JOA-MFB-20260918-0047")).not.toBeInTheDocument();
    expect(window.location.search).toContain("status=retailed");
  });

  it("clears an active chip when it is clicked a second time", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    const chip = screen.getByTestId("register.filter.type.emerald");
    await user.click(chip);
    await waitFor(() => {
      expect(chip).toHaveAttribute("aria-pressed", "true");
    });

    // A repeat click on the active value returns the filter to "all".
    await user.click(chip);
    await waitFor(() => {
      expect(chip).toHaveAttribute("aria-pressed", "false");
    });
    expect(screen.getByTestId("register.result_count")).toHaveTextContent(
      "3 of 3 lots shown",
    );
    expect(window.location.search).not.toContain("type=");
  });

  it("clears the search and every filter from the empty state", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    // KFB has no seed lots, so the site chip narrows to nothing.
    await user.click(screen.getByTestId("register.filter.site.KFB"));
    await screen.findByTestId("register.empty_state");

    // The toolbar and the empty state both offer a clear control; the empty
    // state's is the one that names the action in full.
    await user.click(
      screen.getByRole("button", { name: /Clear search and filters/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        "3 of 3 lots shown",
      );
    });
    expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    expect(window.location.search).not.toContain("site=");
  });

  it("shows the empty state when a site filter matches no lots", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    // KFB has no seed lots, so the site chip narrows to nothing.
    await user.click(screen.getByTestId("register.filter.site.KFB"));

    await waitFor(() => {
      expect(screen.getByTestId("register.empty_state")).toBeInTheDocument();
    });
    expect(screen.getByText(/No lots match this view/i)).toBeInTheDocument();
  });

  it("matches a lot by content-hash prefix", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    // The first eight characters of the third seed lot's sealed hash.
    await user.type(screen.getByLabelText(/Search the register/i), "b4c5d6e7");

    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        "1 of 3 lots shown",
      );
    });
    expect(screen.getByText("JOA-LUS-20260912-0003")).toBeInTheDocument();
    expect(screen.queryByText("JOA-MFB-20260918-0047")).not.toBeInTheDocument();
  });

  it("matches a lot by its id", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await screen.findByText("JOA-MFB-20260918-0047");
    await user.type(
      screen.getByLabelText(/Search the register/i),
      "JOA-LUS-20260912-0003",
    );

    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        "1 of 3 lots shown",
      );
    });
    expect(screen.getByText("JOA-LUS-20260912-0003")).toBeInTheDocument();
  });

  it("shows the hash chain in the expanded block", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByTestId("lot.open_button.1"));
    await user.click(screen.getByTestId("lot.hash_chain_toggle"));

    // The seed lot's chain has two links, each carrying its own hash.
    const chain = await screen.findByTestId("lot.hash_chain");
    expect(within(chain).getAllByTestId("lot.chain_row.1")).toHaveLength(1);
    expect(within(chain).getByTestId("lot.chain_row.2")).toBeInTheDocument();
  });

  it("never renders a control that edits or deletes an old event", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByTestId("lot.open_button.1"));

    // The expanded block exposes no edit/delete/undo/save-over affordance.
    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /undo/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save/i }),
    ).not.toBeInTheDocument();
  });

  it("does not use trading or crypto vocabulary in the library", async () => {
    renderWithProviders(<HomePage />);
    await screen.findByText("JOA-MFB-20260918-0047");

    const body = document.body.textContent?.toLowerCase() ?? "";
    for (const word of ["nft", "mint", "wallet", "coin"]) {
      expect(body).not.toContain(word);
    }
  });

  it("keeps the expanded block in the URL so a filtered view is shareable", async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);

    await user.click(await screen.findByTestId("lot.open_button.2"));

    await waitFor(() => {
      expect(window.location.search).toContain("lot=JOA-MFB-20260918-0048");
    });
  });

  it("shows a clean empty state in Real-time mode when the register holds no lots", async () => {
    holder.actor.listLots.mockResolvedValue([]);
    holder.actor.registerSummary.mockResolvedValue({
      totalLots: 0n,
      totalEvents: 0n,
      byType: [],
      byStatus: [],
      bySite: [],
      activity: [],
    });

    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(screen.getByTestId("register.empty_state")).toBeInTheDocument();
    });
    // No sample or placeholder lot is invented to fill the empty register.
    expect(screen.queryByText(/JOA-MFB-20260918-0047/)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("register.demo_notice"),
    ).not.toBeInTheDocument();
  });

  it("renders a large randomly generated dataset in Demo-data mode", async () => {
    window.localStorage.setItem("explor8-data-mode", "demo");
    renderWithProviders(<HomePage />);

    // The demo notice marks the view as generated, not sealed.
    expect(
      await screen.findByTestId("register.demo_notice"),
    ).toBeInTheDocument();

    // The demo register is large: far more than the three live seed lots.
    await waitFor(() => {
      expect(screen.getByTestId("register.result_count")).toHaveTextContent(
        /of 48 lots shown/,
      );
    });
    // None of the live register's own lots leak into the demo view.
    expect(screen.queryByText("JOA-MFB-20260918-0047")).not.toBeInTheDocument();
  });

  it("withholds every write affordance in Demo-data mode", async () => {
    window.localStorage.setItem("explor8-data-mode", "demo");
    renderWithProviders(<HomePage />);

    await screen.findByTestId("register.demo_notice");
    // Open the first demo block; no append form is offered for generated data.
    const openButton = await screen.findByTestId("lot.open_button.1");
    await userEvent.setup().click(openButton);

    expect(screen.queryByTestId("event.panel")).not.toBeInTheDocument();
  });

  it("regenerates a different random dataset on each switch into Demo-data mode", async () => {
    const user = userEvent.setup();
    // The mode switch lives in the header, so render the shell the app uses.
    renderWithProviders(
      <>
        <AppHeader />
        <HomePage />
      </>,
    );

    // The rendered lot ids are the dataset's own identity: positional ocids
    // repeat across datasets, so compare the ids the blocks actually print.
    const renderedIds = () =>
      screen
        .getAllByTestId(/^lot\.item\./)
        .map((node) => node.textContent ?? "");

    // Switch into demo, capture the first generated dataset.
    await user.click(screen.getByTestId("header.demo_button"));
    await screen.findByTestId("register.demo_notice");
    const firstIds = await waitFor(() => {
      const ids = renderedIds();
      expect(ids.length).toBeGreaterThan(0);
      return ids;
    });

    // Back to live, then into demo again: a fresh dataset is generated.
    await user.click(screen.getByTestId("header.realtime_button"));
    await user.click(screen.getByTestId("header.demo_button"));
    await screen.findByTestId("register.demo_notice");

    await waitFor(() => {
      const secondIds = renderedIds();
      expect(secondIds.length).toBeGreaterThan(0);
      expect(secondIds).not.toEqual(firstIds);
    });
  });

  it("does not persist demo data: a refresh in Real-time mode reads only the register", async () => {
    window.localStorage.setItem("explor8-data-mode", "demo");
    const { unmount } = renderWithProviders(<HomePage />);
    await screen.findByTestId("register.demo_notice");
    unmount();

    // A refresh returns to Real-time mode with the live register's own lots.
    window.localStorage.setItem("explor8-data-mode", "live");
    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("JOA-MFB-20260918-0047")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("register.demo_notice"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("register.result_count")).toHaveTextContent(
      "3 of 3 lots shown",
    );
  });
});
