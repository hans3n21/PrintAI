"use client";

import { ImageLightbox, type LightboxItem } from "@/components/gallery/ImageLightbox";
import { AppSurface } from "@/components/ui/appSurface";
import type { ReferenceImageAsset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type ImageGalleryProps = {
  designUrls: string[];
  selectedDesignUrl?: string | null;
  referenceImages?: ReferenceImageAsset[];
  title?: string;
};

type GalleryItem = LightboxItem & {
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
    <AppSurface className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-zinc-500">
          Alles, was in dieser Session entstanden oder hochgeladen wurde.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <figure key={`${item.kind}-${item.url}`} className="space-y-2">
            <button
              type="button"
              aria-label={`${item.label} öffnen`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative aspect-square w-full overflow-hidden rounded-2xl border bg-zinc-950/70 text-left shadow-sm shadow-black/30 transition hover:-translate-y-0.5 hover:border-violet-500/80",
                item.selected ? "border-violet-500 ring-2 ring-violet-500/25" : "border-zinc-700/70"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-200">
                {item.kind === "design" ? "Design" : "Upload"}
              </span>
            </button>
            <figcaption className="line-clamp-2 text-xs text-zinc-400">{item.label}</figcaption>
          </figure>
        ))}
      </div>
      {activeIndex !== null && (
        <ImageLightbox
          items={items}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </AppSurface>
  );
}
