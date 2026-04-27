"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

export type LightboxItem = {
  id?: string;
  url: string;
  label: string;
  kind: "design" | "upload" | "reference";
};

type ImageLightboxProps = {
  items: LightboxItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  onDelete?: (item: LightboxItem) => void;
};

export function ImageLightbox({
  items,
  activeIndex,
  onSelect,
  onClose,
  onDelete,
}: ImageLightboxProps) {
  const item = items[activeIndex];
  if (!item) return null;

  const canMove = items.length > 1;
  const previousIndex = (activeIndex - 1 + items.length) % items.length;
  const nextIndex = (activeIndex + 1) % items.length;

  return (
    <div
      role="dialog"
      aria-label={item.label}
      aria-modal="true"
      data-testid="image-lightbox-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-[2rem] border border-zinc-700/80 bg-zinc-800/90 shadow-2xl shadow-black/50 ring-1 ring-white/5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-700/60 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {item.kind === "design" ? "Design" : "Upload"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && item.id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(item)}
                className="rounded-full border-red-500/40 bg-zinc-900/70 text-red-200 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-700/80 bg-zinc-900/80 p-2 text-zinc-400 shadow-sm shadow-black/30 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
              aria-label="Lightbox schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center p-5">
          {canMove && (
            <button
              type="button"
              onClick={() => onSelect(previousIndex)}
              className="absolute left-4 z-10 rounded-full border border-zinc-700/70 bg-zinc-950/70 p-2 text-white shadow-lg shadow-black/40 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500/70 hover:bg-zinc-900"
              aria-label="Vorheriges Bild"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.label}
            className="max-h-[70vh] w-full rounded-3xl bg-zinc-950/50 object-contain shadow-inner"
          />
          {canMove && (
            <button
              type="button"
              onClick={() => onSelect(nextIndex)}
              className="absolute right-4 z-10 rounded-full border border-zinc-700/70 bg-zinc-950/70 p-2 text-white shadow-lg shadow-black/40 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-500/70 hover:bg-zinc-900"
              aria-label="Nächstes Bild"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {canMove && (
          <div className="border-t border-zinc-700/60 px-4 py-3 text-center text-xs text-zinc-500">
            Bild {activeIndex + 1} von {items.length}
          </div>
        )}
      </div>
    </div>
  );
}
