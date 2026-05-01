import { beforeEach, describe, expect, it, vi } from "vitest";

const { storageFromMock, uploadMock, getPublicUrlMock, providerGenerateMock } = vi.hoisted(() => ({
  storageFromMock: vi.fn(),
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  providerGenerateMock: vi.fn(),
}));

vi.mock("@/lib/designVariantCount", () => ({
  getDesignVariantCount: () => 1,
}));

vi.mock("@/lib/imageProviders", () => ({
  getImageProvider: () => ({
    name: "openai",
    generateDesign: providerGenerateMock,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: storageFromMock,
    },
  },
}));

import { generateDesigns } from "../generate";

describe("generateDesigns post-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("REMOVE_BG_API_KEY", "remove-bg-test-key");
    uploadMock.mockResolvedValue({ error: null });
    storageFromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    });
    getPublicUrlMock.mockImplementation((path: string) => ({
      data: { publicUrl: `https://storage.example.com/${path}` },
    }));
    providerGenerateMock.mockResolvedValue({
      base64: Buffer.from("original-png").toString("base64"),
      provider: "openai",
      seed: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => {
          const buffer = Buffer.from("transparent-png");
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        },
      })
    );
  });

  it("stores a background-removed print URL when remove.bg succeeds", async () => {
    const result = await generateDesigns("session-1", "isolated print art");

    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("design_1_print_"),
      Buffer.from("transparent-png"),
      { contentType: "image/png", upsert: true }
    );
    expect(result.assets[0]).toMatchObject({
      preview_url: expect.stringContaining("design_1_"),
      print_url: expect.stringContaining("design_1_print_"),
      post_processing: {
        background_removed: true,
        print_ready: true,
        warnings: [],
      },
    });
  });
});
