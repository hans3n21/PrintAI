import { afterEach, describe, it, expect, vi } from "vitest";
import {
  generateDesignImage,
  STYLE_VARIANTS,
} from "../gemini";

const generateMock = vi.hoisted(() => vi.fn());
const editMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/openai", () => ({
  openai: {
    images: {
      generate: generateMock,
      edit: editMock,
    },
  },
}));

describe("STYLE_VARIANTS", () => {
  it("has exactly 4 variants", () => {
    expect(STYLE_VARIANTS).toHaveLength(4);
  });

  it("first variant is empty string", () => {
    expect(STYLE_VARIANTS[0]).toBe("");
  });

  it("remaining variants are non-empty strings", () => {
    expect(STYLE_VARIANTS[1].length).toBeGreaterThan(0);
    expect(STYLE_VARIANTS[2].length).toBeGreaterThan(0);
    expect(STYLE_VARIANTS[3].length).toBeGreaterThan(0);
  });
});

describe("generateDesignImage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.IMAGE_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_SIZE;
  });

  it("requests a real transparent background for OpenAI GPT image models", async () => {
    process.env.IMAGE_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-1";
    generateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("png").toString("base64") }],
    });

    await generateDesignImage("centered print motif, transparent background", 0);

    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-1",
        background: "transparent",
      })
    );
  });

  it("does not request transparent background for gpt-image-2 because the API rejects it", async () => {
    process.env.IMAGE_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2";
    generateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("png").toString("base64") }],
    });

    await generateDesignImage("centered print motif", 0);

    expect(generateMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        background: "transparent",
      })
    );
  });

  it("uses OpenAI image edits for reference images when OpenAI is configured", async () => {
    process.env.IMAGE_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_IMAGE_MODEL = "gpt-image-2";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from("ref").buffer,
      })
    );
    editMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("edited").toString("base64") }],
    });

    await generateDesignImage("use this reference", 0, [
      {
        url: "https://example.com/ref.png",
        storage_path: "session/ref.png",
        mime: "image/png",
        uploaded_at: "2026-04-27T00:00:00.000Z",
        description: null,
      },
    ]);

    expect(editMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-2",
        prompt: expect.stringContaining("use this reference"),
      })
    );
    expect(generateMock).not.toHaveBeenCalled();
  });
});
