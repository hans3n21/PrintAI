import { describe, expect, it } from "vitest";
import { createDesignAsset } from "../designAssets";
import { markPostProcessingPending } from "../postProcessing";

describe("markPostProcessingPending", () => {
  it("marks generated previews as not print-ready until background removal is done", () => {
    const asset = createDesignAsset({
      previewUrl: "https://example.com/design.png",
      provider: "gemini",
      prompt: "prompt",
      variantIndex: 0,
    });

    const result = markPostProcessingPending(asset);

    expect(result.post_processing.print_ready).toBe(false);
    expect(result.post_processing.background_removed).toBe(false);
    expect(result.post_processing.warnings).toContain("Hintergrundentfernung ausstehend");
  });
});
