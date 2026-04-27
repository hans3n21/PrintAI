import { afterEach, describe, expect, it, vi } from "vitest";

const generateDesignImageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gemini", () => ({
  generateDesignImage: generateDesignImageMock,
}));

import { getImageProvider, resolveImageProviderName } from "../index";

describe("resolveImageProviderName", () => {
  it("uses configured provider names without leaking concrete APIs into callers", () => {
    expect(resolveImageProviderName("ideogram")).toBe("ideogram");
    expect(resolveImageProviderName("openai")).toBe("openai");
    expect(resolveImageProviderName("gemini")).toBe("gemini");
  });

  it("falls back to openai when no provider is configured but an OpenAI key exists", () => {
    expect(resolveImageProviderName(undefined, "sk-test")).toBe("openai");
  });
});

describe("getImageProvider", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.IMAGE_PROVIDER;
  });

  it("passes reference images to the concrete image generator", async () => {
    process.env.IMAGE_PROVIDER = "gemini";
    generateDesignImageMock.mockResolvedValueOnce("base64");
    const referenceImages = [
      {
        url: "https://example.com/ref.png",
        storage_path: "session/ref.png",
        mime: "image/png",
        uploaded_at: "2026-04-27T00:00:00.000Z",
        description: null,
      },
    ];

    await getImageProvider().generateDesign({
      prompt: "prompt",
      variantIndex: 0,
      referenceImages,
    });

    expect(generateDesignImageMock).toHaveBeenCalledWith("prompt", 0, referenceImages);
  });
});
