import type { ReferenceImageAsset } from "@/lib/types";

export type SavedGalleryItem = {
  id: string;
  url: string;
  label: string;
  kind: "design" | "upload";
  sessionId: string;
  selected?: boolean;
  savedAt: string;
  /** KI- oder Nutzer-Titel für die gesamte Session (Galerie). */
  sessionTitle?: string;
};

export const SAVED_GALLERY_KEY = "printai_saved_gallery_v1";

export type SaveSessionImagesInput = {
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

export function saveSessionImagesToGallery(
  input: SaveSessionImagesInput,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage
) {
  const existing = readSavedGallery(storage);
  const existingTitle = existing.find((i) => i.sessionId === input.sessionId)?.sessionTitle;

  const incoming = buildGalleryItems(input).map((item) => ({
    ...item,
    sessionTitle: existingTitle,
  }));

  if (incoming.length === 0) return existing;
  const merged = mergeGalleryItems(existing, incoming);
  writeSavedGallery(merged, storage);
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
