import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignGrid } from "../DesignGrid";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    sizes,
    className,
  }: {
    src: string;
    alt: string;
    sizes?: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-sizes={sizes} className={className} />
  ),
}));

describe("DesignGrid", () => {
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
});
