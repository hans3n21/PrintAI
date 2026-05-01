"use client";

import { Button } from "@/components/ui/button";
import {
  AppNotice,
  AppSurface,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { choosePrintfulPreview, placementMatches } from "@/lib/printful/productPreviewImages";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

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
  background_color?: string | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_left?: number | null;
  print_area_top?: number | null;
  template_width?: number | null;
  template_height?: number | null;
};

type ProductImage = {
  catalog_variant_id?: number | null;
  color?: string | null;
  color_hex?: string | null;
  placement?: string | null;
  image_url?: string | null;
  background_color?: string | null;
  background_image?: string | null;
  mockup_style_id?: number | null;
};

type ProductColorAsset = {
  id?: string;
  color_slug?: string | null;
  placement?: string | null;
  image_url?: string | null;
  is_preferred?: boolean | null;
  template_width?: number | null;
  template_height?: number | null;
  print_area_left?: number | null;
  print_area_top?: number | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
};

export type PrintfulProductForEditor = {
  id: string;
  title: string;
  variants: PrintfulVariant[] | null;
  product_images?: ProductImage[] | null;
  color_assets?: ProductColorAsset[] | null;
  print_area: {
    placement?: string | null;
    area_width?: number | null;
    area_height?: number | null;
  } | null;
  mockup_templates: MockupTemplate[] | null;
};

type PrintfulProduct = PrintfulProductForEditor;

export const FALLBACK_PLACEMENT_PRODUCT: PrintfulProduct = {
  id: "fallback-bella-canvas-3001",
  title: "Bella Canvas 3001 Vorschau",
  variants: [
    { variant_id: 0, color: "Black", color_hex: "#111111" },
    { variant_id: 1, color: "White", color_hex: "#ffffff" },
  ],
  print_area: {
    placement: "front_large",
    area_width: 1800,
    area_height: 2400,
  },
  product_images: [],
  mockup_templates: [],
};

type SessionConfigWithPlacement = Record<string, unknown> & {
  product_color?: string;
  placement?: Partial<Placement>;
};

type DragMode = "move" | "resize";

const FALLBACK_SWATCH_COLOR_OPTIONS: Array<{ id: string; label: string; hex: string }> = [
  { id: "black", label: "Black", hex: "#1a1a1a" },
  { id: "white", label: "White", hex: "#ffffff" },
];

const FALLBACK_PRINT_AREA_STYLE = {
  left: "54px",
  top: "133px",
  width: "68%",
  height: "58%",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeProductColorId(value: string | undefined) {
  const v = value?.trim().toLowerCase();
  return v && v.length > 0 ? v : "black";
}

function colorSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ?? "";
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

function editorStageBackgroundColor(image: ProductImage | undefined) {
  const color = image?.background_color?.trim();
  if (!color) return undefined;

  const hex = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;

  const value = hex[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.82 ? undefined : color;
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

function assetPrintAreaStyle(asset: ProductColorAsset | undefined) {
  if (
    asset?.template_width == null ||
    asset.template_height == null ||
    asset.print_area_left == null ||
    asset.print_area_top == null ||
    asset.print_area_width == null ||
    asset.print_area_height == null
  ) {
    return undefined;
  }

  return {
    left: `${((asset.print_area_left / asset.template_width) * 100).toFixed(4)}%`,
    top: `${((asset.print_area_top / asset.template_height) * 100).toFixed(4)}%`,
    width: `${((asset.print_area_width / asset.template_width) * 100).toFixed(4)}%`,
    height: `${((asset.print_area_height / asset.template_height) * 100).toFixed(4)}%`,
  };
}

function resolveFallbackHex(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "white") return "#f4f4f5";
  if (normalized === "black") return "#111113";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  }
  return "#111113";
}

function hexLuminance(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function FallbackShirtMockup({ color }: { color: string }) {
  const shirtFill = resolveFallbackHex(color);
  const isLight = hexLuminance(shirtFill) > 0.78;
  const shirtStroke = isLight ? "#d4d4d8" : "#27272a";
  const collarFill = isLight ? "#e4e4e7" : "#050505";

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
          stroke={isLight ? "#e4e4e7" : "#18181b"}
          strokeWidth="5"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

function ProductMockupPreview({ src, title }: { src: string; title: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        draggable={false}
        className="absolute inset-0 block h-full w-full select-none object-cover object-[center_30%]"
      />
    </div>
  );
}

export type PlacementEditorColorOption = { id: string; label: string; hex: string };

export type PlacementEditorProps = {
  sessionId: string;
  designUrl: string;
  initialConfig: SessionConfigWithPlacement;
  product: PrintfulProduct;
  onSaved?: (nextConfig: Record<string, unknown>) => void;
  hideNavigation?: boolean;
  /** Druckfarben mit Hex für Swatches; sonst Fallback Schwarz/Weiß. */
  colorOptions?: PlacementEditorColorOption[];
  /** Wenn gesetzt: Farbe von aussen (z. B. ColorPicker), keine Schwarz/Weiß-Buttons. */
  colorOverride?: string;
  /** Farbwahl an Parent melden (z. B. ColorPicker / Warenkorb-Zeilen). */
  onColorChange?: (color: string) => void;
};

export function PlacementEditor({
  sessionId,
  designUrl,
  initialConfig,
  product,
  onSaved,
  hideNavigation = false,
  colorOptions,
  colorOverride,
  onColorChange,
}: PlacementEditorProps) {
  const router = useRouter();
  const placementName = product.print_area?.placement ?? "front_large";
  const areaWidth = product.print_area?.area_width ?? 1800;
  const areaHeight = product.print_area?.area_height ?? 2400;
  const resolvedColorOptions = useMemo(
    () => colorOptions ?? FALLBACK_SWATCH_COLOR_OPTIONS,
    [colorOptions]
  );
  const [color, setColor] = useState(() =>
    normalizeProductColorId(initialConfig.product_color)
  );
  const isColorControlled = colorOverride !== undefined;
  const effectiveColor =
    isColorControlled
      ? String(colorOverride).trim().toLowerCase() || normalizeProductColorId(color)
      : color;
  const hideColorButtons = isColorControlled;

  const initialConfigRef = useRef(initialConfig);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    initialConfigRef.current = initialConfig;
  }, [initialConfig]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const [placement, setPlacement] = useState(() =>
    buildPlacement(initialConfig, areaWidth, areaHeight, placementName)
  );

  const placementSignature = useMemo(
    () => {
      const p = initialConfig.placement;
      if (
        p &&
        typeof p.left === "number" &&
        typeof p.top === "number" &&
        typeof p.width === "number" &&
        typeof p.height === "number"
      ) {
        return `${p.placement ?? ""}:${p.left}:${p.top}:${p.width}:${p.height}`;
      }
      return "__none__";
    },
    // Nur Placement-Primitive; initialConfig.placement-Objekt würde jeden Render triggern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      initialConfig.placement?.left,
      initialConfig.placement?.top,
      initialConfig.placement?.width,
      initialConfig.placement?.height,
      initialConfig.placement?.placement,
    ]
  );

  useEffect(() => {
    // Re-Sync bei Signatur-/Area-/Placement-Wechsel; nicht bei jedem neuen initialConfig-Objekt (verhindert Auto-Save-Loops).
    startTransition(() => {
      setPlacement(buildPlacement(initialConfig, areaWidth, areaHeight, placementName));
    });
    // initialConfig absichtlich ausgenommen — sonst Placement-Reset nach jedem onSaved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementSignature, areaWidth, areaHeight, placementName]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    mode: DragMode;
    startX: number;
    startY: number;
    origin: Placement;
    moved: boolean;
  } | null>(null);
  const suppressControlToggleRef = useRef(false);
  const [showPlacementControls, setShowPlacementControls] = useState(true);

  useEffect(() => {
    if (!hideNavigation) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const base: Record<string, unknown> = {
          ...(initialConfigRef.current as Record<string, unknown>),
        };
        if (onSavedRef.current) {
          base.mockups = [];
        }
        const nextConfig: Record<string, unknown> = {
          ...base,
          product_color: effectiveColor,
          placement,
        };

        const { error: updateError } = await supabase
          .from("sessions")
          .update({
            config: nextConfig,
            status: "configuring",
          })
          .eq("id", sessionId);

        if (updateError) {
          setError(updateError.message);
          return;
        }
        setError(null);
        onSavedRef.current?.(nextConfig);
      })();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [placement, effectiveColor, hideNavigation, sessionId]);

  const previewChoice = useMemo(
    () =>
      choosePrintfulPreview({
        images: product.product_images ?? [],
        templates: product.mockup_templates ?? [],
        variants: product.variants ?? [],
        color: effectiveColor,
        placement: placementName,
      }),
    [
      effectiveColor,
      placementName,
      product.mockup_templates,
      product.product_images,
      product.variants,
    ]
  );
  const selectedAsset = useMemo(() => {
    const selectedSlug = colorSlug(effectiveColor);
    const matching = (product.color_assets ?? []).filter(
      (asset) =>
        asset.image_url &&
        asset.color_slug === selectedSlug &&
        placementMatches(asset.placement, placementName)
    );
    return matching.find((asset) => asset.is_preferred) ?? matching[0];
  }, [effectiveColor, placementName, product.color_assets]);
  const activeTemplate =
    previewChoice.template && hasTemplatePrintArea(previewChoice.template)
      ? previewChoice.template
      : (product.mockup_templates ?? []).find(
          (template) =>
            placementMatches(template.placement, placementName) && hasTemplatePrintArea(template)
        ) ?? previewChoice.template;
  const productImage = previewChoice.image;
  const previewImage = selectedAsset?.image_url?.trim() || previewChoice.src;
  const previewBackgroundColor = editorStageBackgroundColor(productImage);
  const previewAspectRatio =
    hasTemplatePrintArea(activeTemplate) && activeTemplate?.template_width && activeTemplate.template_height
      ? `${activeTemplate.template_width} / ${activeTemplate.template_height}`
      : undefined;
  const fallbackShirtColor =
    resolvedColorOptions.find((option) => option.id === effectiveColor)?.hex ?? effectiveColor;

  function updatePlacementFromPointer(clientX: number, clientY: number) {
    const drag = dragRef.current;
    const printAreaElement = printAreaRef.current;
    if (!drag || !printAreaElement) return;
    const bounds = printAreaElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const dx = ((clientX - drag.startX) / bounds.width) * areaWidth;
    const dy = ((clientY - drag.startY) / bounds.height) * areaHeight;
    if (Math.abs(clientX - drag.startX) > 2 || Math.abs(clientY - drag.startY) > 2) {
      drag.moved = true;
    }

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
      moved: false,
    };
  }

  function endPointerDrag(event: React.PointerEvent) {
    if (dragRef.current?.pointerId === event.pointerId) {
      suppressControlToggleRef.current = dragRef.current.moved;
      dragRef.current = null;
    }
  }

  function togglePlacementControls() {
    if (dragRef.current?.moved || suppressControlToggleRef.current) {
      suppressControlToggleRef.current = false;
      return;
    }
    setShowPlacementControls((current) => !current);
  }

  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    const base: Record<string, unknown> = { ...(initialConfig as Record<string, unknown>) };
    if (hideNavigation && onSaved) {
      base.mockups = [];
    }
    const nextConfig: Record<string, unknown> = {
      ...base,
      product_color: effectiveColor,
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
    if (onSaved) {
      onSaved(nextConfig);
    } else {
      router.push(`/configure/${sessionId}`);
    }
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
        {!hideColorButtons ? (
          <div className="flex flex-wrap justify-end gap-2">
            {resolvedColorOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => {
                  if (!isColorControlled) setColor(option.id);
                  onColorChange?.(option.id);
                }}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-all",
                  effectiveColor === option.id
                    ? "scale-110 border-violet-400 shadow-lg shadow-violet-950/40"
                    : "border-zinc-600 hover:border-zinc-400"
                )}
                style={{ backgroundColor: option.hex }}
              />
            ))}
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-md">
          <div
            data-testid="mockup-preview-stage"
            className="relative overflow-hidden rounded-[2.25rem] border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/40 ring-1 ring-white/5"
            style={{
              aspectRatio: previewAspectRatio,
              backgroundColor: previewBackgroundColor,
            }}
          >
            {previewImage ? (
              <ProductMockupPreview src={previewImage} title="Shirt-Vorschau" />
            ) : (
              <FallbackShirtMockup color={fallbackShirtColor} />
            )}

            <div
              ref={printAreaRef}
              data-testid="placement-print-area"
              data-area-width={areaWidth}
              data-area-height={areaHeight}
              className={cn(
                "absolute",
                showPlacementControls
                  ? "border border-dashed border-violet-300/70 bg-violet-500/5"
                  : "border border-transparent bg-transparent"
              )}
              style={assetPrintAreaStyle(selectedAsset) ?? printAreaStyle(activeTemplate)}
            >
              <div
                role="button"
                aria-label="Design platzieren"
                tabIndex={0}
                onPointerDown={(event) => startPointerDrag(event, "move")}
                onPointerMove={(event) => updatePlacementFromPointer(event.clientX, event.clientY)}
                onPointerUp={endPointerDrag}
                onPointerCancel={endPointerDrag}
                onClick={togglePlacementControls}
                className={cn(
                  "absolute touch-none rounded-xl",
                  showPlacementControls
                    ? "border border-white/80 bg-white/10 shadow-lg shadow-black/30"
                    : "border border-transparent bg-transparent"
                )}
                style={designStyle}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={designUrl}
                  alt="Platziertes Design"
                  draggable={false}
                  className="h-full w-full select-none object-contain"
                />
                {showPlacementControls && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </AppSurface>

      {!hideNavigation ? (
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
      ) : null}
    </div>
  );
}
