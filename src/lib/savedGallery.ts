import type { ReferenceImageAsset } from "@/lib/types";

export type SavedGalleryItem = {
  id: string;
  url: string;
  label: string;
  kind: "design" | "upload";
  sessionId: string;
  selected?: boolean;
  savedAt: string;
};

export const SAVED_GALLERY_KEY = "printai_saved_gallery_v1";

type SaveSessionImagesInput = {
  sessionId: string;
  designUrls: string[];
  referenceImages?: ReferenceImageAsset[];
  selectedDesignUrl?: string | null;
  savedAt?: string;
};

export function buildGalleryItems({
  sessionId,
  designUrls,
  referenceImages = [],
  selectedDesignUrl,
  savedAt = new Date().toISOString(),
}: SaveSessionImagesInput): SavedGalleryItem[] {
  return [
    ...designUrls.map((url, index) => ({
      id: `${sessionId}:design:${index}:${url}`,
      url,
      label: selectedDesignUrl === url ? "Gewähltes Design" : `Design ${index + 1}`,
      kind: "design" as const,
      sessionId,
      selected: selectedDesignUrl === url,
      savedAt,
    })),
    ...referenceImages.map((image, index) => ({
      id: `${sessionId}:upload:${index}:${image.url}`,
      url: image.url,
      label: image.description?.trim() || `Hochgeladenes Bild ${index + 1}`,
      kind: "upload" as const,
      sessionId,
      selected: false,
      savedAt,
    })),
  ];
}

export function mergeGalleryItems(
  existing: SavedGalleryItem[],
  incoming: SavedGalleryItem[]
) {
  const byUrl = new Map<string, SavedGalleryItem>();
  for (const item of [...incoming, ...existing]) {
    if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  }
  return [...byUrl.values()].slice(0, 80);
}

export function readSavedGallery(storage: Pick<Storage, "getItem"> = localStorage) {
  try {
    const raw = storage.getItem(SAVED_GALLERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedGalleryItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.url) : [];
  } catch {
    return [];
  }
}

export function writeSavedGallery(
  items: SavedGalleryItem[],
  storage: Pick<Storage, "setItem"> = localStorage
) {
  storage.setItem(SAVED_GALLERY_KEY, JSON.stringify(items));
}

export function saveSessionImagesToGallery(input: SaveSessionImagesInput) {
  const incoming = buildGalleryItems(input);
  if (incoming.length === 0) return readSavedGallery();
  const merged = mergeGalleryItems(readSavedGallery(), incoming);
  writeSavedGallery(merged);
  return merged;
}

export function deleteSavedGalleryItem(
  id: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage
) {
  const remaining = readSavedGallery(storage).filter((item) => item.id !== id);
  writeSavedGallery(remaining, storage);
  return remaining;
}
