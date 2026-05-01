import { PNG } from "pngjs";

function alphaAt(png: PNG, x: number, y: number) {
  return png.data[((png.width * y + x) << 2) + 3];
}

export function trimTransparentPng(input: Buffer): Buffer {
  let source: PNG;
  try {
    source = PNG.sync.read(input);
  } catch {
    return input;
  }
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (alphaAt(source, x, y) === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return input;

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width === source.width && height === source.height) return input;

  const target = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceIndex = (source.width * (minY + y) + (minX + x)) << 2;
      const targetIndex = (width * y + x) << 2;
      source.data.copy(target.data, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }

  return PNG.sync.write(target);
}
