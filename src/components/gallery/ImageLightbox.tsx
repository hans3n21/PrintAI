"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

export function ImageLightbox({
  items,
  activeIndex,
  onSelect,
  onClose,
  onDelete,
}: ImageLightboxProps) {
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const item = items[activeIndex];

  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    dragRef.current = null;
  }, [activeIndex]);

  if (!item) return null;

  const canMove = items.length > 1;
  const previousIndex = (activeIndex - 1 + items.length) % items.length;
  const nextIndex = (activeIndex + 1) % items.length;
  const isZoomed = zoomScale > 1;
  const toggleZoom = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) return;

    setZoomScale((current) => {
      if (current > 1) {
        setPanOffset({ x: 0, y: 0 });
        return 1;
      }
      return CLICK_ZOOM_SCALE;
    });
  };
  const adjustZoomWithWheel = (deltaY: number) => {
    setZoomScale((current) => {
      const next = clampZoomScale(
        current + (deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP)
      );
      if (next <= 1) {
        setPanOffset({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };
  const startDrag = (clientX: number, clientY: number) => {
    if (!isZoomed) return;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      originX: panOffset.x,
      originY: panOffset.y,
      moved: false,
    };
  };
  const updateDrag = (
    clientX: number,
    clientY: number,
    boundsElement: HTMLElement
  ) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }
    setPanOffset(
      clampPanOffset(
        {
          x: drag.originX + dx,
          y: drag.originY + dy,
        },
        zoomScale,
        boundsElement
      )
    );
  };

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
          <button
            type="button"
            aria-label={`${item.label} ${isZoomed ? "verkleinern" : "vergrößern"}`}
            aria-pressed={isZoomed}
            onClick={toggleZoom}
            onWheel={(event) => {
              event.preventDefault();
              adjustZoomWithWheel(event.deltaY);
            }}
            onMouseDown={(event) => startDrag(event.clientX, event.clientY)}
            onMouseMove={(event) =>
              updateDrag(event.clientX, event.clientY, event.currentTarget)
            }
            onMouseLeave={() => {
              dragRef.current = null;
            }}
            className={cn(
              "group flex max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-3xl bg-zinc-950/50 shadow-inner outline-none ring-violet-400/50 transition focus-visible:ring-2",
              isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.label}
              draggable={false}
              className="max-h-[70vh] w-full select-none object-contain transition-transform duration-300 ease-out"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              }}
            />
          </button>
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
        <div className="border-t border-zinc-700/60 px-4 py-3 text-center text-xs text-zinc-500">
          Klick: zurücksetzen · Mausrad: Zoom · Ziehen: verschieben
        </div>
      </div>
    </div>
  );
}
