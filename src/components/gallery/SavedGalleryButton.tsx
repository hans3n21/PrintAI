"use client";

import { Button } from "@/components/ui/button";
import {
  deleteSavedGalleryItem,
  readSavedGallery,
  writeSavedGallery,
  type SavedGalleryItem,
} from "@/lib/savedGallery";
import { Images, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImageLightbox } from "./ImageLightbox";

export function SavedGalleryButton() {
  const [items, setItems] = useState<SavedGalleryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readSavedGallery());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const designItems = items.filter((item) => item.kind === "design");
  if (designItems.length === 0) return null;
  const activeItem = activeIndex === null ? null : designItems[activeIndex];
  const activeReferenceItems = activeItem
    ? items.filter(
        (item) => item.kind !== "design" && item.sessionId === activeItem.sessionId
      )
    : [];

  const handleDelete = (id: string) => {
    const remaining = deleteSavedGalleryItem(id);
    const remainingDesigns = remaining.filter((item) => item.kind === "design");
    setItems(remaining);
    setActiveIndex((current) => {
      if (current === null) return null;
      if (remainingDesigns.length === 0) return null;
      return Math.min(current, remainingDesigns.length - 1);
    });
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full border-zinc-700/80 bg-zinc-900/90 text-zinc-200 shadow-lg shadow-black/30 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500 hover:bg-zinc-800"
        onClick={() => setOpen(true)}
      >
        <Images className="mr-2 h-4 w-4" />
        Galerie
      </Button>

      {open && (
        <div
          ref={panelRef}
          data-testid="saved-gallery-panel"
          className="fixed left-1/2 top-1/2 z-50 max-h-[min(88vh,42rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2rem] border border-zinc-700/80 bg-zinc-800/90 p-5 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Gespeicherte Bilder</h2>
              <p className="text-sm text-zinc-500">
                Deine letzten Designs und Uploads. Zum Vergrößern anklicken.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-zinc-700/80 bg-zinc-900/80 p-2 text-zinc-400 shadow-sm shadow-black/30 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
              aria-label="Galerie schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {designItems.map((item, index) => {
              const hasReferenceImages = items.some(
                (candidate) =>
                  candidate.kind !== "design" && candidate.sessionId === item.sessionId
              );
              return (
              <figure
                key={`${item.kind}-${item.url}`}
                className="group space-y-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-950/50 shadow-sm shadow-black/30 transition group-hover:-translate-y-0.5 group-hover:border-violet-500/80 group-hover:shadow-lg group-hover:shadow-violet-950/20">
                  <button
                    type="button"
                    aria-label={`${item.label} öffnen`}
                    onClick={() => setActiveIndex(index)}
                    className="h-full w-full text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-200">
                      {item.kind === "design" ? "Design" : "Upload"}
                    </span>
                    {hasReferenceImages && (
                      <span
                        aria-label="Design enthält Referenzbilder"
                        title="Enthält Referenzbilder"
                        className="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-300/50 bg-black/70 text-violet-100 shadow-sm shadow-black/40 backdrop-blur"
                      >
                        <Images className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`${item.label} löschen`}
                    onClick={() => handleDelete(item.id)}
                    className="absolute right-2 top-2 rounded-full border border-zinc-700/60 bg-zinc-950/80 p-1.5 text-zinc-200 opacity-100 shadow-sm shadow-black/30 backdrop-blur hover:bg-red-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <figcaption
                  className="line-clamp-2 cursor-pointer text-xs text-zinc-400 transition-colors hover:text-white"
                  title="Klicken zum Bearbeiten"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingItemId(item.id);
                    setEditValue(item.sessionTitle ?? item.label);
                  }}
                >
                  {editingItemId === item.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      maxLength={40}
                      className="w-full rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-100 outline-none ring-1 ring-violet-500"
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => {
                        const gallery = readSavedGallery();
                        const trimmed = editValue.trim();
                        const updated = gallery.map((g) =>
                          g.sessionId === item.sessionId
                            ? {
                                ...g,
                                sessionTitle:
                                  trimmed ||
                                  g.sessionTitle ||
                                  g.label,
                              }
                            : g
                        );
                        writeSavedGallery(updated);
                        setItems(updated);
                        setEditingItemId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingItemId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    item.sessionTitle || item.label
                  )}
                </figcaption>
              </figure>
              );
            })}
          </div>
        </div>
      )}
      {activeIndex !== null && (
        <ImageLightbox
          items={designItems.map((i) => ({
            ...i,
            label: i.sessionTitle || i.label,
          }))}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onClose={() => setActiveIndex(null)}
          referenceItems={activeReferenceItems}
          onDelete={(item) => {
            if (item.id) handleDelete(item.id);
          }}
        />
      )}
    </div>
  );
}
