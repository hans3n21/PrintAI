import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { trimTransparentPng } from "../trimTransparentPng";

function createFixturePng() {
  const png = new PNG({ width: 5, height: 4 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 0;
      png.data[index + 1] = 0;
      png.data[index + 2] = 0;
      png.data[index + 3] = 0;
    }
  }

  for (let y = 1; y <= 2; y++) {
    for (let x = 2; x <= 3; x++) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 255;
      png.data[index + 1] = 128;
      png.data[index + 2] = 64;
      png.data[index + 3] = 255;
    }
  }

  return PNG.sync.write(png);
}

describe("trimTransparentPng", () => {
  it("crops fully transparent rows and columns around visible pixels", () => {
    const trimmed = PNG.sync.read(trimTransparentPng(createFixturePng()));

    expect(trimmed.width).toBe(2);
    expect(trimmed.height).toBe(2);
    expect(trimmed.data[3]).toBe(255);
  });

  it("keeps fully transparent PNGs unchanged", () => {
    const transparent = new PNG({ width: 3, height: 2 });
    const result = PNG.sync.read(trimTransparentPng(PNG.sync.write(transparent)));

    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
  });
});
