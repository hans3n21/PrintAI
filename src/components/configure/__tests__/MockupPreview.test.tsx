import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockupPreview } from "../MockupPreview";

describe("MockupPreview", () => {
  it("renders a generated Printful mockup for the selected color", () => {
    render(
      <MockupPreview
        designUrl="https://example.com/design.png"
        productColor="white"
        printArea="front"
        mockups={[
          {
            variant_id: 4011,
            color: "black",
            mockup_url: "https://example.com/black-mockup.png",
          },
          {
            variant_id: 4012,
            color: "white",
            mockup_url: "https://example.com/white-mockup.png",
          },
        ]}
      />
    );

    expect(screen.getByAltText("Printful Mockup")).toHaveAttribute(
      "src",
      "https://example.com/white-mockup.png"
    );
    expect(screen.queryByAltText("Design preview")).not.toBeInTheDocument();
  });

  it("falls back to the old SVG preview when no generated mockup is available", () => {
    render(
      <MockupPreview
        designUrl="https://example.com/design.png"
        productColor="black"
        printArea="front"
      />
    );

    const image = screen.getByAltText("Design preview");
    expect(image.parentElement).toHaveClass("absolute");
    expect(image.parentElement).toHaveClass("inset-0");
  });
});
