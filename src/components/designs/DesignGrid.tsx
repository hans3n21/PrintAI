"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface DesignGridProps {
  urls: string[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  loading?: boolean;
  productColor?: string;
  /** Platzhalter-Slots im Ladezustand (z. B. aus getDesignVariantCount()). */
  skeletonCount?: number;
}

export function DesignGrid({
  urls,
  selectedUrl,
  onSelect,
  loading,
  skeletonCount = 4,
}: DesignGridProps) {
  const slots = Math.min(4, Math.max(1, skeletonCount));
  const colsClass = (n: number) =>
    n <= 1 ? "grid-cols-1" : "grid-cols-2";

  if (loading) {
    return (
      <div className={cn("grid gap-4", colsClass(slots))}>
        {Array.from({ length: slots }, (_, i) => (
          <div
            key={i}
            className="aspect-square max-w-md animate-pulse rounded-2xl bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4", colsClass(urls.length))}>
      {urls.map((url, i) => (
        <button
          key={url}
          onClick={() => onSelect(url)}
          className={cn(
            "group relative aspect-square overflow-hidden rounded-2xl border-2 transition-all",
            selectedUrl === url
              ? "border-violet-500 ring-2 ring-violet-500/30"
              : "border-zinc-700 hover:border-zinc-500"
          )}
        >
          <div
            className="absolute inset-0 bg-zinc-950"
            aria-label="Generiertes T-Shirt-Mockup"
          >
            <Image
              src={url}
              alt={`Design ${i + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 576px"
              className="object-cover"
            />
          </div>
          {selectedUrl === url && (
            <div className="absolute bottom-0 right-0 flex items-center justify-center bg-violet-600/20">
              <div className="rounded-full bg-violet-500 p-1 text-white">✓</div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
