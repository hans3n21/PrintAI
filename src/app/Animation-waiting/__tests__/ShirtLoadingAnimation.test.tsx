import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ShirtLoadingAnimation from "../ShirtLoadingAnimation";

describe("ShirtLoadingAnimation", () => {
  it("communicates when multiple design variants are being generated", () => {
    render(<ShirtLoadingAnimation variantCount={3} />);

    expect(screen.getByText("Deine 3 Designvorschläge werden vorbereitet…")).toBeInTheDocument();
  });
});
