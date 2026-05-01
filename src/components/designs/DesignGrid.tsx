"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

interface DesignGridProps {
  urls: string[];
  selectedUrl: string | null;
  loading?: boolean;
  productColor?: string;
  /** Platzhalter-Slots im Ladezustand (z. B. aus getDesignVariantCount()). */
  skeletonCount?: number;
}

const CLICK_ZOOM_SCALE = 1.25;
const MAX_ZOOM_SCALE = 2;
const WHEEL_ZOOM_STEP = 0.1;

function clampZoomScale(scale: number) {
  return Math.min(MAX_ZOOM_SCALE, Math.max(1, Number(scale.toFixed(2))));
}

function clampPanOffset(
  offset: { x: number; y: number },
  scale: number,
  boundsElement: HTMLElement
) {
  const bounds = boundsElement.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return offset;
  const maxX = (bounds.width * (scale - 1)) / 2;
  const maxY = (bounds.height * (scale - 1)) / 2;
  return {
    x: Number(Math.min(maxX, Math.max(-maxX, offset.x)).toFixed(2)),
    y: Number(Math.min(maxY, Math.max(-maxY, offset.y)).toFixed(2)),
  };
}

export function DesignGrid({
  urls,
  selectedUrl,
  loading,
  skeletonCount = 4,
}: DesignGridProps) {
  const [zoomScales, setZoomScales] = useState<Record<string, number>>({});
  const [panOffsets, setPanOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{
    url: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const slots = Math.min(4, Math.max(1, skeletonCount));
  const colsClass = (n: number) =>
    n <= 1 ? "grid-cols-1" : "grid-cols-2";

  const toggleZoom = (url: string) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.url === url && drag.moved) return;

    setZoomScales((previous) => {
      const current = previous[url] ?? 1;
      if (current > 1) {
        setPanOffsets((previous) => ({
          ...previous,
          [url]: { x: 0, y: 0 },
        }));
        return { ...previous, [url]: 1 };
      }
      return { ...previous, [url]: CLICK_ZOOM_SCALE };
    });
  };

  const adjustZoomWithWheel = (
    url: string,
    deltaY: number,
    boundsElement: HTMLElement
  ) => {
    setZoomScales((previous) => {
      const current = previous[url] ?? 1;
      const next = clampZoomScale(
        current + (deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP)
      );
      if (next <= 1) {
        setPanOffsets((previousPan) => ({
          ...previousPan,
          [url]: { x: 0, y: 0 },
        }));
        return { ...previous, [url]: 1 };
      }
      setPanOffsets((previousPan) => ({
        ...previousPan,
        [url]: clampPanOffset(previousPan[url] ?? { x: 0, y: 0 }, next, boundsElement),
      }));
      return { ...previous, [url]: next };
    });
  };

  const startDrag = (url: string, clientX: number, clientY: number) => {
    if ((zoomScales[url] ?? 1) <= 1) return;
    const offset = panOffsets[url] ?? { x: 0, y: 0 };
    dragRef.current = {
      url,
      startX: clientX,
      startY: clientY,
      originX: offset.x,
      originY: offset.y,
      moved: false,
    };
  };

  const updateDrag = (
    url: string,
    clientX: number,
    clientY: number,
    boundsElement: HTMLElement
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.url !== url) return;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }
    setPanOffsets((previous) => ({
      ...previous,
      [url]: clampPanOffset(
        {
          x: drag.originX + dx,
          y: drag.originY + dy,
        },
        zoomScales[url] ?? 1,
        boundsElement
      ),
    }));
  };

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
    <>
      <div className={cn("grid gap-4", colsClass(urls.length))}>
        {urls.map((url, i) => {
          const zoomScale = zoomScales[url] ?? 1;
          const isZoomed = zoomScale > 1;
          const offset = panOffsets[url] ?? { x: 0, y: 0 };

          return (
            <button
              key={url}
              type="button"
              aria-label={`Design ${i + 1} ${isZoomed ? "verkleinern" : "vergrößern"}`}
              aria-pressed={isZoomed}
              onClick={() => toggleZoom(url)}
              onWheel={(event) => {
                event.preventDefault();
                adjustZoomWithWheel(url, event.deltaY, event.currentTarget);
              }}
              onMouseDown={(event) => startDrag(url, event.clientX, event.clientY)}
              onMouseMove={(event) =>
                updateDrag(url, event.clientX, event.clientY, event.currentTarget)
              }
              onMouseLeave={() => {
                if (dragRef.current?.url === url) dragRef.current = null;
              }}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-[1.75rem] border transition-all shadow-lg shadow-black/20",
                isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
                selectedUrl === url
                  ? "border-violet-500 ring-2 ring-violet-500/30"
                  : "border-zinc-700/70 hover:-translate-y-0.5 hover:border-zinc-500"
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
                  draggable={false}
                  className="object-cover transition-transform duration-300 ease-out"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomScale})`,
                  }}
                />
              </div>
              {selectedUrl === url && (
                <div className="absolute bottom-3 right-3 flex items-center justify-center rounded-full border border-violet-300/40 bg-violet-600/80 p-1 text-white shadow-lg shadow-violet-950/30 backdrop-blur">
                  <div className="text-sm leading-none">✓</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
