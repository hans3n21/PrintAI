"use client";

import type { ReferenceImageAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type ImageGalleryProps = {
  designUrls: string[];
  selectedDesignUrl?: string | null;
  referenceImages?: ReferenceImageAsset[];
  title?: string;
};

type GalleryItem = {
  url: string;
  label: string;
  kind: "design" | "reference";
  selected?: boolean;
};

export function ImageGallery({
  designUrls,
  selectedDesignUrl,
  referenceImages = [],
  title = "Deine Galerie",
}: ImageGalleryProps) {
  const items: GalleryItem[] = [
    ...designUrls.map((url, index) => ({
      url,
      label: selectedDesignUrl === url ? "Gewähltes Design" : `Design ${index + 1}`,
      kind: "design" as const,
      selected: selectedDesignUrl === url,
    })),
    ...referenceImages.map((image, index) => ({
      url: image.url,
      label: image.description?.trim() || `Hochgeladenes Bild ${index + 1}`,
      kind: "reference" as const,
      selected: false,
    })),
  ];

  if (items.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-zinc-500">
          Alles, was in dieser Session entstanden oder hochgeladen wurde.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <figure key={`${item.kind}-${item.url}`} className="space-y-2">
            <div
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border bg-zinc-950",
                item.selected ? "border-violet-500" : "border-zinc-800"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-200">
                {item.kind === "design" ? "Design" : "Upload"}
              </span>
            </div>
            <figcaption className="line-clamp-2 text-xs text-zinc-400">{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
