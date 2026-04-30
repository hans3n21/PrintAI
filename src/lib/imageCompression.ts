const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_JPEG_QUALITY = 0.72;

type CompressImageOptions = {
  maxDimension?: number;
  quality?: number;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Bild konnte nicht als Data-URL gelesen werden."));
    };
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = dataUrl;
  });
}

export async function compressImageFileToDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const originalDataUrl = await readFileAsDataUrl(file);

  if (typeof document === "undefined") {
    return originalDataUrl;
  }

  const image = await loadImage(originalDataUrl);
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const largestSide = Math.max(image.width, image.height);
  if (!largestSide || largestSide <= maxDimension) {
    return originalDataUrl;
  }

  const scale = maxDimension / largestSide;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", options.quality ?? DEFAULT_JPEG_QUALITY);
}
