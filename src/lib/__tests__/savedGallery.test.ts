import { describe, expect, it } from "vitest";
import {
  buildGalleryItems,
  deleteSavedGalleryItem,
  mergeGalleryItems,
  readSavedGallery,
  SAVED_GALLERY_KEY,
  saveSessionImagesToGallery,
  writeSavedGallery,
} from "../savedGallery";

describe("savedGallery", () => {
  it("builds gallery items for generated designs and uploads", () => {
    const items = buildGalleryItems({
      sessionId: "session-1",
      designUrls: ["https://example.com/design.png"],
      selectedDesignUrl: "https://example.com/design.png",
      referenceImages: [
        {
          url: "https://example.com/upload.jpg",
          storage_path: "session/upload.jpg",
          mime: "image/jpeg",
          uploaded_at: "2026-04-27T00:00:00.000Z",
          description: "Mein Upload",
        },
      ],
      savedAt: "2026-04-27T00:00:00.000Z",
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "design", label: "Gewähltes Design", selected: true }),
        expect.objectContaining({ kind: "upload", label: "Mein Upload" }),
      ])
    );
  });

  it("deduplicates by url with incoming items first", () => {
    const merged = mergeGalleryItems(
      [
        {
          id: "old",
          url: "https://example.com/a.png",
          label: "Alt",
          kind: "design",
          sessionId: "old",
          savedAt: "old",
        },
      ],
      [
        {
          id: "new",
          url: "https://example.com/a.png",
          label: "Neu",
          kind: "design",
          sessionId: "new",
          savedAt: "new",
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe("Neu");
  });

  it("returns an empty gallery for invalid storage data", () => {
    const storage = {
      getItem: (key: string) => (key === SAVED_GALLERY_KEY ? "not-json" : null),
    };

    expect(readSavedGallery(storage)).toEqual([]);
  });

  it("deletes one saved gallery item by id", () => {
    let stored = JSON.stringify([
      {
        id: "keep",
        url: "https://example.com/keep.png",
        label: "Bleibt",
        kind: "design",
        sessionId: "session",
        savedAt: "now",
      },
      {
        id: "remove",
        url: "https://example.com/remove.png",
        label: "Weg",
        kind: "upload",
        sessionId: "session",
        savedAt: "now",
      },
    ]);
    const storage = {
      getItem: (key: string) => (key === SAVED_GALLERY_KEY ? stored : null),
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    };

    const remaining = deleteSavedGalleryItem("remove", storage);

    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("keep");
    expect(JSON.parse(stored)).toHaveLength(1);
  });

  it("preserves sessionTitle when saving new gallery items for the same session", () => {
    let stored = JSON.stringify([]);
    const storage = {
      getItem: (key: string) => (key === SAVED_GALLERY_KEY ? stored : null),
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    };

    saveSessionImagesToGallery(
      {
        sessionId: "s1",
        designUrls: ["https://example.com/a.png"],
        savedAt: "t1",
      },
      storage
    );
    const first = JSON.parse(stored) as { sessionTitle?: string }[];
    expect(first[0]?.sessionTitle).toBeUndefined();

    const withTitle = (JSON.parse(stored) as typeof first).map((item) => ({
      ...item,
      sessionTitle: "Mein Motiv",
    }));
    writeSavedGallery(withTitle, storage);

    saveSessionImagesToGallery(
      {
        sessionId: "s1",
        designUrls: ["https://example.com/a.png", "https://example.com/b.png"],
        savedAt: "t2",
      },
      storage
    );

    const merged = JSON.parse(stored);
    expect(merged.every((i: { sessionTitle?: string }) => i.sessionTitle === "Mein Motiv")).toBe(
      true
    );
  });
});
