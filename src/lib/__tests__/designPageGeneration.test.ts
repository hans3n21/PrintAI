import { describe, expect, it } from "vitest";
import { getDesignPageGenerationState } from "../designPageGeneration";

describe("getDesignPageGenerationState", () => {
  it("requests design generation when a generating session has no design urls", () => {
    const state = getDesignPageGenerationState({
      status: "generating",
      design_urls: [],
      slogans: [{ main_text: "A" }],
    });

    expect(state.shouldRequestDesigns).toBe(true);
    expect(state.canShowDesigns).toBe(false);
  });

  it("allows showing designs even when slogans are still missing", () => {
    const state = getDesignPageGenerationState({
      status: "designing",
      design_urls: ["https://example.com/design.png"],
      slogans: [],
    });

    expect(state.canShowDesigns).toBe(true);
    expect(state.shouldRequestSlogans).toBe(true);
  });
});
