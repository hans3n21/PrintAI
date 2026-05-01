"use client";

import { Button } from "@/components/ui/button";
import {
  AppNotice,
  AppSurface,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

type Placement = {
  placement: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

type PrintfulVariant = {
  variant_id: number;
  color?: string | null;
  color_hex?: string | null;
};

type MockupTemplate = {
  placement?: string | null;
  catalog_variant_ids?: number[] | null;
  image_url?: string | null;
  background_url?: string | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_left?: number | null;
  print_area_top?: number | null;
  template_width?: number | null;
  template_height?: number | null;
};

type PrintfulProduct = {
  id: string;
  title: string;
  variants: PrintfulVariant[] | null;
  print_area: {
    placement?: string | null;
    area_width?: number | null;
    area_height?: number | null;
  } | null;
  mockup_templates: MockupTemplate[] | null;
};

type SessionConfigWithPlacement = Record<string, unknown> & {
  product_color?: string;
  placement?: Partial<Placement>;
};

type DragMode = "move" | "resize";

const COLOR_OPTIONS = ["Black", "White"] as const;
const FALLBACK_PRINT_AREA_STYLE = {
  left: "54px",
  top: "133px",
  width: "68%",
  height: "58%",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(value: string | undefined) {
  return value?.trim().toLowerCase() === "white" ? "white" : "black";
}

function defaultPlacement(areaWidth: number, areaHeight: number, placement: string): Placement {
  return {
    placement,
    left: Math.round(areaWidth * 0.15),
    top: Math.round(areaHeight * 0.15),
    width: Math.round(areaWidth * 0.7),
    height: Math.round(areaHeight * 0.7),
  };
}

function buildPlacement(
  config: SessionConfigWithPlacement,
  areaWidth: number,
  areaHeight: number,
  placement: string
): Placement {
  const existing = config.placement;
  if (
    existing &&
    typeof existing.left === "number" &&
    typeof existing.top === "number" &&
    typeof existing.width === "number" &&
    typeof existing.height === "number"
  ) {
    return {
      placement: typeof existing.placement === "string" ? existing.placement : placement,
      left: existing.left,
      top: existing.top,
      width: existing.width,
      height: existing.height,
    };
  }
  return defaultPlacement(areaWidth, areaHeight, placement);
}

function resizePlacementProportionally(
  origin: Placement,
  dx: number,
  dy: number,
  areaWidth: number,
  areaHeight: number
): Placement {
  const widthDelta = dx / origin.width;
  const heightDelta = dy / origin.height;
  const rawScale =
    Math.abs(widthDelta) >= Math.abs(heightDelta)
      ? (origin.width + dx) / origin.width
      : (origin.height + dy) / origin.height;
  const minScale = Math.max(80 / origin.width, 80 / origin.height);
  const maxScale = Math.min(
    (areaWidth - origin.left) / origin.width,
    (areaHeight - origin.top) / origin.height
  );
  const scale = clamp(rawScale, minScale, maxScale);

  return {
    ...origin,
    width: Math.round(origin.width * scale),
    height: Math.round(origin.height * scale),
  };
}

function getTemplateImage(template: MockupTemplate | undefined) {
  return template?.image_url ?? template?.background_url ?? null;
}

function chooseTemplateImage(
  templates: MockupTemplate[],
  variants: PrintfulVariant[],
  color: string,
  placement: string
) {
  const renderableTemplate = chooseTemplate(
    templates.filter((template) => getTemplateImage(template)),
    variants,
    color,
    placement
  );
  return getTemplateImage(renderableTemplate);
}

function hasTemplatePrintArea(template: MockupTemplate | undefined) {
  return (
    template?.template_width != null &&
    template.template_height != null &&
    template.print_area_left != null &&
    template.print_area_top != null &&
    template.print_area_width != null &&
    template.print_area_height != null
  );
}

function templateMatchesColor(template: MockupTemplate, variants: PrintfulVariant[], color: string) {
  const ids = template.catalog_variant_ids ?? [];
  if (ids.length === 0) return false;
  return variants.some(
    (variant) =>
      ids.includes(variant.variant_id) &&
      variant.color?.trim().toLowerCase() === color.toLowerCase()
  );
}

function chooseTemplate(
  templates: MockupTemplate[],
  variants: PrintfulVariant[],
  color: string,
  placement: string
) {
  return (
    templates.find(
      (template) =>
        template.placement === placement && templateMatchesColor(template, variants, color)
    ) ??
    templates.find((template) => templateMatchesColor(template, variants, color)) ??
    templates.find((template) => template.placement === placement) ??
    templates[0]
  );
}

function printAreaStyle(template: MockupTemplate | undefined) {
  if (!hasTemplatePrintArea(template)) {
    return FALLBACK_PRINT_AREA_STYLE;
  }
  const templateWidth = template?.template_width ?? 560;
  const templateHeight = template?.template_height ?? 760;
  return {
    left: `${(((template?.print_area_left ?? 0) / templateWidth) * 100).toFixed(4)}%`,
    top: `${(((template?.print_area_top ?? 0) / templateHeight) * 100).toFixed(4)}%`,
    width: `${(((template?.print_area_width ?? templateWidth) / templateWidth) * 100).toFixed(4)}%`,
    height: `${(((template?.print_area_height ?? templateHeight) / templateHeight) * 100).toFixed(4)}%`,
  };
}

function FallbackShirtMockup({ color }: { color: string }) {
  const isWhite = color === "white";
  const shirtFill = isWhite ? "#f4f4f5" : "#111113";
  const shirtStroke = isWhite ? "#d4d4d8" : "#27272a";
  const collarFill = isWhite ? "#e4e4e7" : "#050505";

  return (
    <div
      data-testid="fallback-shirt-mockup"
      className="aspect-[14/19] bg-gradient-to-b from-zinc-800 to-zinc-950"
    >
      <svg
        viewBox="0 0 560 760"
        role="img"
        aria-label="Neutrales Shirt Mockup"
        className="h-full w-full"
      >
        <rect width="560" height="760" fill="transparent" />
        <path
          d="M182 170 L236 132 H324 L378 170 L470 232 L420 318 L372 292 V632 H188 V292 L140 318 L90 232 Z"
          fill={shirtFill}
          stroke={shirtStroke}
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M226 143 C238 179 258 198 280 198 C302 198 322 179 334 143"
          fill="none"
          stroke={collarFill}
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d="M226 143 C242 165 260 176 280 176 C300 176 318 165 334 143"
          fill="none"
          stroke={shirtStroke}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M188 292 C226 312 334 312 372 292"
          fill="none"
          stroke={isWhite ? "#e4e4e7" : "#18181b"}
          strokeWidth="5"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

export function PlacementEditor({
  sessionId,
  designUrl,
  initialConfig,
  product,
}: {
  sessionId: string;
  designUrl: string;
  initialConfig: SessionConfigWithPlacement;
  product: PrintfulProduct;
}) {
  const router = useRouter();
  const placementName = product.print_area?.placement ?? "front_large";
  const areaWidth = product.print_area?.area_width ?? 1800;
  const areaHeight = product.print_area?.area_height ?? 2400;
  const [color, setColor] = useState(normalizeColor(initialConfig.product_color));
  const [placement, setPlacement] = useState(() =>
    buildPlacement(initialConfig, areaWidth, areaHeight, placementName)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    mode: DragMode;
    startX: number;
    startY: number;
    origin: Placement;
  } | null>(null);

  const activeTemplate = useMemo(
    () =>
      chooseTemplate(
        product.mockup_templates ?? [],
        product.variants ?? [],
        color,
        placementName
      ),
    [color, placementName, product.mockup_templates, product.variants]
  );
  const mockupImage =
    getTemplateImage(activeTemplate) ??
    chooseTemplateImage(product.mockup_templates ?? [], product.variants ?? [], color, placementName);

  function updatePlacementFromPointer(clientX: number, clientY: number) {
    const drag = dragRef.current;
    const printAreaElement = printAreaRef.current;
    if (!drag || !printAreaElement) return;
    const bounds = printAreaElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const dx = ((clientX - drag.startX) / bounds.width) * areaWidth;
    const dy = ((clientY - drag.startY) / bounds.height) * areaHeight;

    setPlacement(() => {
      if (drag.mode === "resize") {
        return resizePlacementProportionally(drag.origin, dx, dy, areaWidth, areaHeight);
      }

      const left = clamp(
        Math.round(drag.origin.left + dx),
        0,
        areaWidth - drag.origin.width
      );
      const top = clamp(
        Math.round(drag.origin.top + dy),
        0,
        areaHeight - drag.origin.height
      );
      return { ...drag.origin, left, top };
    });
  }

  function startPointerDrag(event: React.PointerEvent, mode: DragMode) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: placement,
    };
  }

  function endPointerDrag(event: React.PointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    const nextConfig = {
      ...initialConfig,
      product_color: color,
      placement,
    };

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        config: nextConfig,
        status: "configuring",
      })
      .eq("id", sessionId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push(`/configure/${sessionId}`);
  }

  const designStyle = {
    left: `${(placement.left / areaWidth) * 100}%`,
    top: `${(placement.top / areaHeight) * 100}%`,
    width: `${(placement.width / areaWidth) * 100}%`,
    height: `${(placement.height / areaHeight) * 100}%`,
  };

  return (
    <div className="space-y-5">
      {error && <AppNotice tone="error">{error}</AppNotice>}

      <AppSurface className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">{product.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Ziehe und skaliere dein Design innerhalb der Druckfläche.
            </p>
          </div>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((option) => {
              const optionId = option.toLowerCase();
              return (
                <Button
                  key={option}
                  type="button"
                  variant={color === optionId ? "default" : "outline"}
                  onClick={() => setColor(optionId)}
                  className={
                    color === optionId
                      ? primaryActionClassName("px-4")
                      : secondaryActionClassName("px-4")
                  }
                >
                  {option}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="relative overflow-hidden rounded-[2rem] border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/30">
            {mockupImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mockupImage}
                alt={`${product.title} Mockup`}
                className="block w-full select-none"
                draggable={false}
              />
            ) : (
              <FallbackShirtMockup color={color} />
            )}

            <div
              ref={printAreaRef}
              data-testid="placement-print-area"
              data-area-width={areaWidth}
              data-area-height={areaHeight}
              className="absolute border border-dashed border-violet-300/70 bg-violet-500/5"
              style={printAreaStyle(activeTemplate)}
            >
              <div
                role="button"
                aria-label="Design platzieren"
                tabIndex={0}
                onPointerDown={(event) => startPointerDrag(event, "move")}
                onPointerMove={(event) => updatePlacementFromPointer(event.clientX, event.clientY)}
                onPointerUp={endPointerDrag}
                onPointerCancel={endPointerDrag}
                className="absolute touch-none rounded-xl border border-white/80 bg-white/10 shadow-lg shadow-black/30"
                style={designStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designUrl}
                  alt="Platziertes Design"
                  draggable={false}
                  className="h-full w-full select-none object-contain"
                />
                <button
                  type="button"
                  aria-label="Design skalieren"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    startPointerDrag(event, "resize");
                  }}
                  onPointerMove={(event) =>
                    updatePlacementFromPointer(event.clientX, event.clientY)
                  }
                  onPointerUp={endPointerDrag}
                  onPointerCancel={endPointerDrag}
                  className="absolute -bottom-2 -right-2 h-5 w-5 touch-none rounded-full border border-white bg-violet-500 shadow"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Druckfläche: {areaWidth} x {areaHeight}px, Placement {placement.placement}
        </p>
      </AppSurface>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className={secondaryActionClassName("flex-1")}
        >
          Zurück
        </Button>
        <Button
          type="button"
          onClick={() => void saveAndContinue()}
          disabled={saving}
          className={primaryActionClassName("flex-1")}
        >
          {saving ? "Speichere..." : "Weiter zur Konfiguration"}
        </Button>
      </div>
    </div>
  );
}
