import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSessionOverview } from "../AdminSessionOverview";

const summaryResponse = {
  sessions: [
    {
      id: "latest-session",
      created_at: "2026-04-29T00:00:00.000Z",
      updated_at: "2026-04-29T00:05:00.000Z",
      status: "generating",
      product: "tshirt",
      product_color: "navy",
      quantity: 12,
      event_type: "verein",
      style: "modern",
      summary: "Teamshirt mit Logo vorne",
      thumbnail_url: null,
      design_count: 0,
      has_designs: false,
      has_chat: true,
      slogan_count: 0,
    },
    {
      id: "older-session",
      created_at: "2026-04-28T22:00:00.000Z",
      updated_at: "2026-04-28T22:10:00.000Z",
      status: "designing",
      product: "tshirt",
      product_color: "black",
      quantity: 1,
      event_type: "sonstiges",
      style: "cartoon",
      summary: "Fuchs im Cartoonstyle",
      thumbnail_url: "https://example.com/fuchs.png",
      design_count: 2,
      has_designs: true,
      has_chat: true,
      reference_count: 1,
      slogan_count: 3,
    },
    {
      id: "third-session",
      created_at: "2026-04-28T21:00:00.000Z",
      updated_at: "2026-04-28T21:10:00.000Z",
      status: "designing",
      product: "hoodie",
      product_color: "grey",
      quantity: 3,
      event_type: "firma",
      style: "modern",
      summary: "Logo Hoodie",
      thumbnail_url: "https://example.com/hoodie.png",
      design_count: 1,
      has_designs: true,
      has_chat: true,
      reference_count: 0,
      slogan_count: 1,
    },
  ],
};

const latestDetail = {
  session: {
    ...summaryResponse.sessions[0],
    conversation_history: [{ role: "user", content: "Logo vorne, Nummer hinten" }],
    creative_brief: { source_summary: "Teamshirt mit Logo vorne" },
    prompt_data: { prompt: "prompt" },
    design_urls: [],
    design_assets: [],
    reference_images: [],
    slogans: [],
    config: {},
  },
};

const olderDetail = {
  session: {
    ...summaryResponse.sessions[1],
    conversation_history: [{ role: "user", content: "Cooler Fuchs" }],
    creative_brief: { source_summary: "Fuchs im Cartoonstyle" },
    prompt_data: { prompt: "prompt" },
    design_urls: ["https://example.com/fuchs.png", "https://example.com/fuchs-2.png"],
    design_assets: [],
    reference_images: [
      {
        url: "https://example.com/reference.png",
        storage_path: "older-session/reference.png",
        mime: "image/png",
        uploaded_at: "2026-04-28T22:00:00.000Z",
        description: "Referenzbild Fuchs",
      },
    ],
    slogans: [{ main_text: "Fuchs Power", sub_text: null, placement: "top", note: "" }],
    config: {},
  },
};

const thirdDetail = {
  session: {
    ...summaryResponse.sessions[2],
    conversation_history: [{ role: "user", content: "Hoodie mit Logo" }],
    creative_brief: { source_summary: "Logo Hoodie" },
    prompt_data: { prompt: "hoodie prompt" },
    design_urls: ["https://example.com/hoodie.png"],
    design_assets: [],
    reference_images: [],
    slogans: [{ main_text: "Logo Power", sub_text: null, placement: "top", note: "" }],
    config: {},
  },
};

describe("AdminSessionOverview", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("id=latest-session")) {
        return Response.json(latestDetail);
      }
      if (url.includes("id=older-session") && init?.method === "DELETE") {
        return Response.json({ ok: true, deleted_storage_files: 3 });
      }
      if (url.includes("id=older-session")) {
        return Response.json(olderDetail);
      }
      if (url.includes("id=third-session")) {
        return Response.json(thirdDetail);
      }
      return Response.json(summaryResponse);
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads sessions as a compact two-column overview", async () => {
    render(<AdminSessionOverview />);

    expect(await screen.findByText("Teamshirt mit Logo vorne")).toBeInTheDocument();
    expect(screen.getAllByText("Noch keine Vorschaubilder bereit").length).toBeGreaterThan(0);
    expect(screen.getByTestId("admin-session-grid")).toHaveClass("lg:grid-cols-2");
    expect(screen.queryByRole("button", { name: "Nähere Informationen" })).not.toBeInTheDocument();
    expect(screen.queryByText("Eintrag löschen")).not.toBeInTheDocument();
  });

  it("loads details for older sessions when opening the preview", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    expect(screen.queryByText("Cooler Fuchs")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    await waitFor(() => expect(screen.getByRole("dialog", { name: "Medienvorschau" })).toBeInTheDocument());
    expect(screen.getByText("Cooler Fuchs")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/sessions?id=older-session&include=details",
      { cache: "no-store" }
    );
  });

  it("marks admin preview thumbnails that include reference photos", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");

    expect(screen.getByLabelText("Session enthält Referenzbilder")).toBeInTheDocument();
  });

  it("opens a lightbox from generated designs and navigates between images", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs.png"
    );
    expect(within(dialog).getByAltText("Referenzbild Fuchs")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Design 2 anzeigen" }));

    expect(screen.getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs-2.png"
    );
  });

  it("zooms admin design previews to cover the preview frame before dragging", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.dataset.testid === "admin-media-preview-frame") {
        return {
          width: 400,
          height: 300,
          top: 0,
          left: 0,
          right: 400,
          bottom: 300,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      }
      if (this.alt === "Medienvorschau") {
        return {
          width: 260,
          height: 300,
          top: 0,
          left: 70,
          right: 330,
          bottom: 300,
          x: 70,
          y: 0,
          toJSON: () => ({}),
        };
      }
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });

    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    const previewButton = within(dialog).getByRole("button", {
      name: "Medienvorschau vergrößern",
    });
    expect(within(dialog).getByTestId("admin-media-preview-frame")).toBe(previewButton);

    fireEvent.click(previewButton);
    expect(previewButton).toHaveAttribute("aria-pressed", "true");
    expect(previewButton).toHaveClass("cursor-grab");
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.54)",
    });

    fireEvent.wheel(previewButton, { deltaY: -100 });
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.64)",
    });

    fireEvent.mouseDown(previewButton, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(previewButton, { clientX: 1000, clientY: -1000 });

    expect(within(dialog).getByAltText("Medienvorschau")).toHaveStyle({
      transform: "translate(128px, -96px) scale(1.64)",
    });
  });

  it("uses the natural image ratio so one click makes square designs touch the frame edges", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.dataset.testid === "admin-media-preview-frame") {
        return {
          width: 731,
          height: 437,
          top: 0,
          left: 0,
          right: 731,
          bottom: 437,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      }
      if (this.alt === "Medienvorschau") {
        return {
          width: 731,
          height: 437,
          top: 0,
          left: 0,
          right: 731,
          bottom: 437,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      }
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1024);
    vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(1024);

    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Medienvorschau vergrößern" }));

    expect(within(dialog).getByAltText("Medienvorschau")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.67)",
    });
  });

  it("opens the same design variant as the session thumbnail", async () => {
    const selectedThumbnailSummary = {
      sessions: [
        {
          ...summaryResponse.sessions[1],
          thumbnail_url: "https://example.com/fuchs-2.png",
        },
      ],
    };
    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("id=older-session")) {
        return Response.json({
          session: {
            ...olderDetail.session,
            selected_design_url: "https://example.com/fuchs-2.png",
          },
        });
      }
      return Response.json(selectedThumbnailSummary);
    });

    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getByAltText("Session Vorschau"));

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs-2.png"
    );
    expect(within(dialog).getByText("2 von 2 Bildvarianten")).toBeInTheDocument();
  });

  it("includes structured design assets in the admin lightbox variants", async () => {
    const assetSummary = {
      sessions: [
        {
          ...summaryResponse.sessions[2],
          design_count: 2,
        },
      ],
    };
    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("id=third-session")) {
        return Response.json({
          session: {
            ...thirdDetail.session,
            design_urls: ["https://example.com/hoodie.png"],
            design_assets: [
              { preview_url: "https://example.com/hoodie-asset.png" },
            ],
          },
        });
      }
      return Response.json(assetSummary);
    });

    render(<AdminSessionOverview />);

    await screen.findByText("Logo Hoodie");
    fireEvent.click(screen.getByAltText("Session Vorschau"));

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByText("1 von 2 Bildvarianten")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Design 2 anzeigen" }));

    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/hoodie-asset.png"
    );
  });

  it("supports swiping through lightbox images", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    fireEvent.touchStart(dialog, { touches: [{ clientX: 280 }] });
    fireEvent.touchEnd(dialog, { changedTouches: [{ clientX: 40 }] });

    expect(screen.getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs-2.png"
    );
  });

  it("keeps chat and design context inside the lightbox", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByText("Chatverlauf")).toBeInTheDocument();
    expect(within(dialog).getByText("Cooler Fuchs")).toBeInTheDocument();
    expect(within(dialog).getByText("Endergebnis")).toBeInTheDocument();
    expect(within(dialog).getByText("Referenzbilder")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs.png"
    );
  });

  it("uses right-side tabs and explicit design switching in the lightbox", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByRole("tab", { name: "Chat" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(dialog).getByText("Cooler Fuchs")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Design 2 anzeigen" }));
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs-2.png"
    );

    fireEvent.click(within(dialog).getByRole("tab", { name: "Slogans" }));
    expect(within(dialog).getByRole("tab", { name: "Slogans" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(dialog).getByText("Fuchs Power")).toBeInTheDocument();
    expect(within(dialog).queryByText("Cooler Fuchs")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("tab", { name: "Infos" }));
    expect(
      within(dialog).getByText("Fuchs im Cartoonstyle · generiertes Design 2")
    ).toBeInTheDocument();
  });

  it("opens the lightbox from a session thumbnail and carousels designs only", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByText("1 von 2 Bildvarianten")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs.png"
    );
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveClass("max-h-[48vh]");

    fireEvent.click(within(dialog).getByRole("button", { name: "Design 2 anzeigen" }));
    expect(within(dialog).getByText("2 von 2 Bildvarianten")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs-2.png"
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Design 1 anzeigen" }));
    expect(within(dialog).getByText("1 von 2 Bildvarianten")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/fuchs.png"
    );
  });

  it("switches between generated session designs with their own chat context", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByText("Cooler Fuchs")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Nächstes Design" }));

    await waitFor(() =>
      expect(within(dialog).getByText("Hoodie mit Logo")).toBeInTheDocument()
    );
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/hoodie.png"
    );
    expect(within(dialog).queryByText("Cooler Fuchs")).not.toBeInTheDocument();
  });

  it("places generated design navigation prominently in the lightbox header", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    const navigation = within(dialog).getByRole("group", { name: "Design wechseln" });

    expect(within(navigation).getByRole("button", { name: "Vorheriges Design" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Nächstes Design" })).toBeInTheDocument();
    expect(navigation).toHaveClass("rounded-full");
  });

  it("keeps generated design navigation in a stable top toolbar", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    const toolbar = within(dialog).getByRole("toolbar", { name: "Design-Navigation" });
    const navigation = within(toolbar).getByRole("group", { name: "Design wechseln" });

    expect(toolbar).toHaveClass("sticky");
    expect(within(navigation).getByRole("button", { name: "Vorheriges Design" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Nächstes Design" })).toBeInTheDocument();
  });

  it("keeps the media preview position stable by truncating long summaries above it", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    const summary = within(dialog).getByTestId("admin-media-preview-summary");

    expect(summary).toHaveClass("truncate");
    expect(summary).toHaveClass("h-6");

    fireEvent.click(within(dialog).getByRole("tab", { name: "Infos" }));
    expect(within(dialog).getAllByText("Fuchs im Cartoonstyle").length).toBeGreaterThan(1);
  });

  it("keeps reference images constrained as thumbnails in the lightbox", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    const referenceImage = within(dialog).getByAltText("Referenzbild Fuchs");

    expect(referenceImage).toHaveClass("h-full");
    expect(referenceImage).toHaveClass("w-full");
    expect(referenceImage.closest("button")).toHaveClass("h-16");
    expect(referenceImage.closest("button")).toHaveClass("w-16");
  });

  it("does not show separate image-variant navigation buttons", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });

    expect(
      within(dialog).queryByRole("button", { name: "Vorherige Bildvariante" })
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Nächste Bildvariante" })
    ).not.toBeInTheDocument();
  });

  it("closes the lightbox when clicking outside the dialog content", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    fireEvent.click(dialog);

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Medienvorschau" })).not.toBeInTheDocument()
    );
  });

  it("keeps the desktop lightbox fixed while only the chat panel scrolls", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    const shell = within(dialog).getByTestId("lightbox-shell");
    const chatPanel = within(dialog).getByTestId("lightbox-chat-scroll");

    expect(shell).toHaveClass("lg:h-[calc(100vh-2rem)]");
    expect(shell).toHaveClass("lg:overflow-hidden");
    expect(chatPanel).toHaveClass("overflow-y-auto");
  });

  it("switches generated session designs with arrow keys", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getAllByAltText("Session Vorschau")[0]);

    const dialog = await screen.findByRole("dialog", { name: "Medienvorschau" });
    expect(within(dialog).getByText("Cooler Fuchs")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "ArrowRight" });

    await waitFor(() =>
      expect(within(dialog).getByText("Hoodie mit Logo")).toBeInTheDocument()
    );
    expect(within(dialog).getByAltText("Medienvorschau")).toHaveAttribute(
      "src",
      "https://example.com/hoodie.png"
    );

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });

    await waitFor(() =>
      expect(within(dialog).getByText("Cooler Fuchs")).toBeInTheDocument()
    );
  });

  it("can delete a session entry from the admin list", async () => {
    render(<AdminSessionOverview />);

    await screen.findByText("Fuchs im Cartoonstyle");
    fireEvent.click(screen.getByRole("button", { name: "Fuchs im Cartoonstyle löschen" }));

    await waitFor(() =>
      expect(screen.queryByText("Fuchs im Cartoonstyle")).not.toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/sessions?id=older-session", {
      method: "DELETE",
    });
  });
});
