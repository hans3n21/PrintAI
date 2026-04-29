import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockupPreview } from "../MockupPreview";

describe("MockupPreview", () => {
  it("renders the selected design across the full product mockup frame", () => {
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
