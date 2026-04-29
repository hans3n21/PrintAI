import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAVED_GALLERY_KEY } from "@/lib/savedGallery";
import { SavedGalleryButton } from "../SavedGalleryButton";

describe("SavedGalleryButton", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      SAVED_GALLERY_KEY,
      JSON.stringify([
        {
          id: "design-1",
          url: "https://example.com/design-1.png",
          label: "Design 1",
          kind: "design",
          sessionId: "session-1",
          savedAt: "2026-04-27T00:00:00.000Z",
        },
        {
          id: "upload-1",
          url: "https://example.com/reference-1.png",
          label: "Nutzerreferenz 1 zum Wunsch",
          kind: "upload",
          sessionId: "session-1",
          savedAt: "2026-04-27T00:00:00.000Z",
        },
      ])
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the gallery popup when clicking outside it", async () => {
    render(<SavedGalleryButton />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Galerie" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Galerie" }));
    expect(screen.getByText("Gespeicherte Bilder")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText("Gespeicherte Bilder")).not.toBeInTheDocument();
  });

  it("centers the saved gallery popup on the screen", async () => {
    render(<SavedGalleryButton />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Galerie" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Galerie" }));

    const panel = screen.getByTestId("saved-gallery-panel");
    expect(panel).toHaveClass("fixed");
    expect(panel).toHaveClass("left-1/2");
    expect(panel).toHaveClass("top-1/2");
    expect(panel).toHaveClass("-translate-x-1/2");
    expect(panel).toHaveClass("-translate-y-1/2");
    expect(panel).not.toHaveClass("bottom-16");
  });

  it("keeps uploads out of the gallery grid and shows them in the design lightbox", async () => {
    render(<SavedGalleryButton />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Galerie" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Galerie" }));

    expect(screen.getByText("Design 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Design enthält Referenzbilder")).toBeInTheDocument();
    expect(screen.queryByText("Nutzerreferenz 1 zum Wunsch")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Design 1 öffnen" }));

    expect(screen.getByTestId("image-lightbox-header-references")).toBeInTheDocument();
    expect(screen.getByAltText("Nutzerreferenz 1 zum Wunsch")).toBeInTheDocument();
  });

  it("does not show the gallery button when only uploads are saved", async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      SAVED_GALLERY_KEY,
      JSON.stringify([
        {
          id: "upload-1",
          url: "https://example.com/reference-1.png",
          label: "Nutzerreferenz 1 zum Wunsch",
          kind: "upload",
          sessionId: "session-1",
          savedAt: "2026-04-27T00:00:00.000Z",
        },
      ])
    );

    render(<SavedGalleryButton />);
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByRole("button", { name: "Galerie" })).not.toBeInTheDocument();
  });
});
