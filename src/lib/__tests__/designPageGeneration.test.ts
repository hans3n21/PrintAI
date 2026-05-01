import { describe, expect, it } from "vitest";
import {
  collectDisplayDesignUrls,
  getDesignPageGenerationState,
  resolvePrintDesignUrl,
} from "../designPageGeneration";

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

  it("collects all displayable designs from urls and structured assets", () => {
    expect(
      collectDisplayDesignUrls({
        design_urls: ["https://example.com/legacy.png"],
        design_assets: [
          { preview_url: "https://example.com/asset-1.png" },
          { mockup_url: "https://example.com/mockup.png" },
          { print_url: "https://example.com/print.png" },
          { preview_url: "https://example.com/legacy.png" },
        ],
      })
    ).toEqual([
      "https://example.com/legacy.png",
      "https://example.com/asset-1.png",
      "https://example.com/mockup.png",
      "https://example.com/print.png",
    ]);
  });

  it("allows showing designs when only structured assets exist", () => {
    const state = getDesignPageGenerationState({
      status: "designing",
      design_urls: [],
      design_assets: [{ preview_url: "https://example.com/asset-only.png" }],
      slogans: [],
    });

    expect(state.canShowDesigns).toBe(true);
    expect(state.shouldRequestDesigns).toBe(false);
  });

  it("does not treat empty legacy design url entries as displayable designs", () => {
    const state = getDesignPageGenerationState({
      status: "designing",
      design_urls: ["", "   "],
      design_assets: [],
      slogans: [],
    });

    expect(state.canShowDesigns).toBe(false);
    expect(state.shouldRequestDesigns).toBe(true);
  });

  it("resolves a selected preview URL to the background-removed print URL", () => {
    expect(
      resolvePrintDesignUrl(
        {
          design_assets: [
            {
              preview_url: "https://example.com/preview.png",
              print_url: "https://example.com/print.png",
            },
          ],
        },
        "https://example.com/preview.png"
      )
    ).toBe("https://example.com/print.png");
  });
});
