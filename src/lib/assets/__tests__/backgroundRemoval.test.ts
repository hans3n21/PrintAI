import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeBackgroundFromPng } from "../backgroundRemoval";

describe("removeBackgroundFromPng", () => {
  beforeEach(() => {
    vi.stubEnv("REMOVE_BG_API_KEY", "remove-bg-test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends generated PNG bytes to remove.bg and returns transparent PNG bytes", async () => {
    const transparentPng = Buffer.from("transparent-png");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => transparentPng.buffer.slice(
        transparentPng.byteOffset,
        transparentPng.byteOffset + transparentPng.byteLength
      ),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await removeBackgroundFromPng(Buffer.from("original-png"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.remove.bg/v1.0/removebg",
      expect.objectContaining({
        method: "POST",
        headers: { "X-Api-Key": "remove-bg-test-key" },
      })
    );
    expect(result).toEqual(transparentPng);
  });

  it("returns null when remove.bg is not configured", async () => {
    vi.stubEnv("REMOVE_BG_API_KEY", "");

    await expect(removeBackgroundFromPng(Buffer.from("original-png"))).resolves.toBeNull();
  });
});
