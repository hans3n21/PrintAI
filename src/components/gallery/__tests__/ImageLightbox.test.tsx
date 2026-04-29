import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageLightbox } from "../ImageLightbox";

describe("ImageLightbox", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles zoom when the active image is clicked", () => {
    render(
      <ImageLightbox
        items={[
          {
            url: "https://example.com/design.png",
            label: "Design 1",
            kind: "design",
          },
        ]}
        activeIndex={0}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const zoomButton = screen.getByRole("button", { name: "Design 1 vergrößern" });
    expect(zoomButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(zoomButton);

    expect(zoomButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.25)",
    });
    expect(screen.getByText("Klick: zurücksetzen · Mausrad: Zoom · Ziehen: verschieben")).toBeInTheDocument();

    fireEvent.click(zoomButton);

    expect(zoomButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1)",
    });
  });

  it("adjusts zoom with the mouse wheel", () => {
    render(
      <ImageLightbox
        items={[
          {
            url: "https://example.com/design.png",
            label: "Design 1",
            kind: "design",
          },
        ]}
        activeIndex={0}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const zoomButton = screen.getByRole("button", { name: "Design 1 vergrößern" });
    fireEvent.click(zoomButton);
    fireEvent.wheel(zoomButton, { deltaY: -100 });

    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.35)",
    });
  });

  it("keeps dragged zoomed images inside the visible frame", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(
      <ImageLightbox
        items={[
          {
            url: "https://example.com/design.png",
            label: "Design 1",
            kind: "design",
          },
        ]}
        activeIndex={0}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const zoomButton = screen.getByRole("button", { name: "Design 1 vergrößern" });
    fireEvent.click(zoomButton);
    fireEvent.mouseDown(zoomButton, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(zoomButton, { clientX: 1000, clientY: 1000 });

    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(50px, 37.5px) scale(1.25)",
    });
  });
});
