import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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
      ])
    );
  });

  it("closes the gallery popup when clicking outside it", async () => {
    render(<SavedGalleryButton />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Galerie" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Galerie" }));
    expect(screen.getByText("Gespeicherte Bilder")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText("Gespeicherte Bilder")).not.toBeInTheDocument();
  });
});
