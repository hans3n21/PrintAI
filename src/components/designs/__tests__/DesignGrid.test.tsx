import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignGrid } from "../DesignGrid";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    sizes,
    className,
    style,
  }: {
    src: string;
    alt: string;
    sizes?: string;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-sizes={sizes} className={className} style={style} />
  ),
}));

describe("DesignGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders generated mockup image full-bleed with image sizes", () => {
    render(
      <DesignGrid
        urls={["https://example.com/design.png"]}
        selectedUrl="https://example.com/design.png"
        onSelect={vi.fn()}
        productColor="grey"
      />
    );

    expect(screen.getByLabelText("Generiertes T-Shirt-Mockup")).toBeInTheDocument();
    expect(screen.getByAltText("Design 1")).toHaveAttribute(
      "data-sizes",
      "(max-width: 768px) 100vw, 576px"
    );
    expect(screen.getByAltText("Design 1")).toHaveClass("object-cover");
  });

  it("selects a design and zooms it in place on click", () => {
    const onSelect = vi.fn();
    render(
      <DesignGrid
        urls={[
          "https://example.com/design-1.png",
          "https://example.com/design-2.png",
        ]}
        selectedUrl={null}
        onSelect={onSelect}
      />
    );

    const designButton = screen.getByRole("button", { name: "Design 2 vergrößern" });
    fireEvent.click(designButton);

    expect(onSelect).toHaveBeenCalledWith("https://example.com/design-2.png");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(designButton).toHaveAttribute("aria-pressed", "true");
    expect(designButton).toHaveClass("cursor-grab");
    expect(screen.getByAltText("Design 2")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.25)",
    });

    fireEvent.click(designButton);

    expect(designButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByAltText("Design 2")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1)",
    });
  });

  it("lets a zoomed design be dragged inside its tile", () => {
    render(
      <DesignGrid
        urls={["https://example.com/design.png"]}
        selectedUrl={null}
        onSelect={vi.fn()}
      />
    );

    const designButton = screen.getByRole("button", { name: "Design 1 vergrößern" });
    fireEvent.click(designButton);
    fireEvent.mouseDown(designButton, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(designButton, { clientX: 130, clientY: 85 });
    fireEvent.mouseUp(designButton);

    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(30px, -15px) scale(1.25)",
    });
  });

  it("adjusts a zoomed design with the mouse wheel", () => {
    render(
      <DesignGrid
        urls={["https://example.com/design.png"]}
        selectedUrl={null}
        onSelect={vi.fn()}
      />
    );

    const designButton = screen.getByRole("button", { name: "Design 1 vergrößern" });
    fireEvent.click(designButton);
    fireEvent.wheel(designButton, { deltaY: -100 });

    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.35)",
    });
  });

  it("keeps dragged zoomed designs inside the tile frame", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(
      <DesignGrid
        urls={["https://example.com/design.png"]}
        selectedUrl={null}
        onSelect={vi.fn()}
      />
    );

    const designButton = screen.getByRole("button", { name: "Design 1 vergrößern" });
    fireEvent.click(designButton);
    fireEvent.mouseDown(designButton, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(designButton, { clientX: -1000, clientY: 1000 });

    expect(screen.getByAltText("Design 1")).toHaveStyle({
      transform: "translate(-50px, 50px) scale(1.25)",
    });
  });
});
