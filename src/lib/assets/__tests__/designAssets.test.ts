import { describe, expect, it } from "vitest";
import { createDesignAsset, getDesignUrlList } from "../designAssets";

describe("design assets", () => {
  it("stores preview, mockup, print and source metadata separately", () => {
    const asset = createDesignAsset({
      previewUrl: "https://example.com/preview.png",
      provider: "gemini",
      prompt: "shirt prompt",
      variantIndex: 0,
    });

    expect(asset.preview_url).toBe("https://example.com/preview.png");
    expect(asset.mockup_url).toBeNull();
    expect(asset.print_url).toBeNull();
    expect(asset.source.provider).toBe("gemini");
    expect(asset.post_processing.background_removed).toBe(false);
  });

  it("keeps legacy URL lists available from structured assets", () => {
    const urls = getDesignUrlList([
      createDesignAsset({
        previewUrl: "https://example.com/one.png",
        provider: "openai",
        prompt: "one",
        variantIndex: 0,
      }),
    ]);

    expect(urls).toEqual(["https://example.com/one.png"]);
  });
});
