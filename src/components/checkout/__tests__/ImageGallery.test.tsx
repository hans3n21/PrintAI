import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageGallery } from "../ImageGallery";

describe("ImageGallery", () => {
  it("renders generated designs and uploaded reference images", () => {
    render(
      <ImageGallery
        designUrls={["https://example.com/design-1.png", "https://example.com/design-2.png"]}
        selectedDesignUrl="https://example.com/design-2.png"
        referenceImages={[
          {
            url: "https://example.com/upload.png",
            storage_path: "session/upload.png",
            mime: "image/png",
            uploaded_at: "2026-04-27T00:00:00.000Z",
            description: "Foto vom Lieblingsmotiv",
          },
        ]}
      />
    );

    expect(screen.getByText("Deine Galerie")).toBeInTheDocument();
    expect(screen.getByAltText("Design 1")).toBeInTheDocument();
    expect(screen.getByAltText("Gewähltes Design")).toBeInTheDocument();
    expect(screen.getByAltText("Foto vom Lieblingsmotiv")).toBeInTheDocument();
    expect(screen.getAllByText("Design")).toHaveLength(2);
    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  it("renders nothing when there are no images", () => {
    const { container } = render(<ImageGallery designUrls={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens images in a lightbox and switches between them", () => {
    render(
      <ImageGallery
        designUrls={["https://example.com/design-1.png", "https://example.com/design-2.png"]}
        referenceImages={[
          {
            url: "https://example.com/upload.png",
            storage_path: "session/upload.png",
            mime: "image/png",
            uploaded_at: "2026-04-27T00:00:00.000Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Design 1 öffnen/i }));
    expect(screen.getByRole("dialog", { name: "Design 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nächstes Bild/i }));
    expect(screen.getByRole("dialog", { name: "Design 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Vorheriges Bild/i }));
    expect(screen.getByRole("dialog", { name: "Design 1" })).toBeInTheDocument();
  });

  it("closes the lightbox when clicking outside the image panel", () => {
    render(<ImageGallery designUrls={["https://example.com/design-1.png"]} />);

    fireEvent.click(screen.getByRole("button", { name: /Design 1 öffnen/i }));
    expect(screen.getByRole("dialog", { name: "Design 1" })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("image-lightbox-backdrop"));

    expect(screen.queryByRole("dialog", { name: "Design 1" })).not.toBeInTheDocument();
  });
});
