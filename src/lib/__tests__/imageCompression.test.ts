import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImageFileToDataUrl } from "../imageCompression";

describe("compressImageFileToDataUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downscales large phone photos before returning a data URL", async () => {
    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        this.result = "data:image/jpeg;base64,original";
        this.onload?.();
      }
    }

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 4000;
      height = 2000;

      set src(_value: string) {
        this.onload?.();
      }
    }

    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/jpeg;base64,compressed");
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL,
    };

    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("Image", MockImage);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") {
        return canvas as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    });

    const result = await compressImageFileToDataUrl(
      new File(["photo"], "photo.jpg", { type: "image/jpeg" })
    );

    expect(result).toBe("data:image/jpeg;base64,compressed");
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(640);
    expect(drawImage).toHaveBeenCalled();
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.72);
  });
});
