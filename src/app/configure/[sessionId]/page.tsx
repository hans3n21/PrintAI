"use client";

import { ColorPicker } from "@/components/configure/ColorPicker";
import { TextEditor } from "@/components/configure/TextEditor";
import { Header } from "@/components/layout/Header";
import { FeedbackWidget } from "@/components/notes/FeedbackWidget";
import {
  FALLBACK_PLACEMENT_PRODUCT,
  PlacementEditor,
  type PlacementEditorProps,
  type PrintfulProductForEditor,
} from "@/components/place/PlacementEditor";
import { Button } from "@/components/ui/button";
import {
  AppSurface,
  AppNotice,
  FieldGroup,
  PageShell,
  PageTitle,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import { Separator } from "@/components/ui/separator";
import { normalizeQuantity, withPinnedShopPrintfulProductId } from "@/lib/productSelection";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  findPrintfulVariant,
  getPrintfulColorOptions,
  getPrintfulSizeOptions,
  type PrintfulProductVariant,
} from "@/lib/printful/productVariants";
import { placementForPrintArea } from "@/lib/printful/placements";
import type { OnboardingData, ProductSelection, SloganOption } from "@/lib/types";
import { Plus, ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, startTransition, useState } from "react";

type PriceQuote = {
  unitAmountCents: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  shippingIncludedInShopPrice?: boolean;
};

type CartLine = {
  color: string;
  size: string;
  quantity: number;
};

type CatalogProductRow = PrintfulProductForEditor & {
  printful_product_id: number;
  is_primary?: boolean;
  sort_order?: number | null;
  color_assets?: Array<{
    id?: string;
    printful_product_id?: number;
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
  }> | null;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function cleanProductTitle(title: string) {
  const pipeIndex = title.indexOf(" | ");
  return pipeIndex > -1 ? title.slice(0, pipeIndex).trim() : title.trim();
}

const FALLBACK_CART_COLOR_SWATCHES = [
  { id: "black", label: "Schwarz", hex: "#1a1a1a" },
  { id: "white", label: "Weiß", hex: "#ffffff" },
];

function parseCartLinesFromConfig(
  config: Record<string, unknown>,
  productSelection: ProductSelection | null
): CartLine[] {
  const raw = config.cart_lines;
  if (Array.isArray(raw) && raw.length > 0) {
    const lines: CartLine[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const colorRaw = typeof o.color === "string" ? o.color.trim().toLowerCase() : "";
      const sizeRaw = typeof o.size === "string" ? o.size : "";
      const quantity =
        typeof o.quantity === "number" && Number.isFinite(o.quantity)
          ? Math.max(1, Math.floor(o.quantity))
          : 1;
      if (!colorRaw || !sizeRaw) continue;
      lines.push({ color: colorRaw, size: sizeRaw, quantity });
    }
    if (lines.length > 0) return lines;
  }
  const color = (
    productSelection?.color ??
    productSelection?.product_color ??
    "black"
  )
    .toString()
    .trim()
    .toLowerCase();
  const size = (productSelection?.size ?? "M").toString();
  const qty =
    typeof productSelection?.quantity === "number" && productSelection.quantity >= 1
      ? Math.floor(productSelection.quantity)
      : 1;
  return [{ color, size, quantity: qty }];
}

export default function ConfigurePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(null);
  const [quantityOverride, setQuantityOverride] = useState(1);
  const [color, setColor] = useState("black");
  const [printArea, setPrintArea] = useState<"front" | "back" | "both">("front");
  const [customText, setCustomText] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [singleSize, setSingleSize] = useState("M");
  const [existingConfig, setExistingConfig] = useState<Record<string, unknown>>({});
  const [availableProducts, setAvailableProducts] = useState<CatalogProductRow[]>([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [cartLines, setCartLines] = useState<CartLine[]>([
    { color: "black", size: "M", quantity: 1 },
  ]);
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [linePrices, setLinePrices] = useState<Record<number, PriceQuote>>({});
  const [priceStatus, setPriceStatus] = useState<string | null>(null);
  const [placementReady, setPlacementReady] = useState(false);
  const [placementSetupWarning, setPlacementSetupWarning] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setPlacementReady(false);
      try {
        const { data } = await supabase
          .from("sessions")
          .select("selected_design_url, selected_slogan, onboarding_data, product_selection, config")
          .eq("id", sessionId)
          .single();

        if (!data) return;
        setDesignUrl(data.selected_design_url);
        const selectedSlogan = data.selected_slogan as SloganOption | null;
        const selectedProduct = data.product_selection as ProductSelection | null;
        setOnboardingData(data.onboarding_data as OnboardingData | null);
        setExistingConfig((data.config ?? {}) as Record<string, unknown>);
        const selectedPrintfulProductId = selectedProduct?.printful_product_id;

        const { data: products } = await supabase
          .from("printful_products")
          .select(
            "id, printful_product_id, title, variants, product_images, print_area, mockup_templates, is_primary, sort_order"
          )
          .eq("is_active", true)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true, nullsFirst: false });

        const baseList = (products ?? []) as CatalogProductRow[];
        const productIds = baseList
          .map((product) => product.printful_product_id)
          .filter((id): id is number => Number.isInteger(id) && id > 0);
        let list = baseList;
        if (productIds.length > 0) {
          const { data: assets } = await supabase
            .from("printful_product_color_assets")
            .select("*")
            .in("printful_product_id", productIds)
            .order("is_preferred", { ascending: false });
          const byProduct = new Map<number, CatalogProductRow["color_assets"]>();
          for (const asset of assets ?? []) {
            const productId = Number((asset as { printful_product_id?: unknown }).printful_product_id);
            byProduct.set(productId, [...(byProduct.get(productId) ?? []), asset]);
          }
          list = baseList.map((product) => ({
            ...product,
            color_assets: byProduct.get(product.printful_product_id) ?? [],
          }));
        }
        setAvailableProducts(list);

        const preselectedIndex =
          typeof selectedPrintfulProductId === "number" &&
          Number.isInteger(selectedPrintfulProductId) &&
          selectedPrintfulProductId > 0
            ? list.findIndex((p) => p.printful_product_id === selectedPrintfulProductId)
            : -1;
        const initialIndex = preselectedIndex >= 0 ? preselectedIndex : 0;
        setSelectedProductIndex(initialIndex);

        const resolvedRow = list[initialIndex];
        const resolvedPrintfulPid =
          typeof resolvedRow?.printful_product_id === "number" ? resolvedRow.printful_product_id : null;

        const activeCatalogRow = resolvedRow ?? null;
        setPlacementSetupWarning(
          activeCatalogRow
            ? null
            : "Kein aktives Printful-Produkt gefunden. Du siehst vorerst eine einfache Vorschau; bitte im Admin-Bereich ein Produkt integrieren und aktivieren."
        );

        const hasPinnedProductId =
          typeof selectedPrintfulProductId === "number" &&
          Number.isInteger(selectedPrintfulProductId) &&
          selectedPrintfulProductId > 0;

        let nextSelection: ProductSelection | null = selectedProduct;
        const shouldPinResolvedProduct =
          resolvedPrintfulPid != null && resolvedPrintfulPid > 0 && !hasPinnedProductId;

        if (shouldPinResolvedProduct) {
          nextSelection = withPinnedShopPrintfulProductId(
            selectedProduct ?? {
              product: "tshirt",
              product_color: "black",
              quantity: normalizeQuantity(null),
            },
            resolvedPrintfulPid
          );
          await supabase
            .from("sessions")
            .update({
              product_selection: nextSelection,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
        }
        setProductSelection(nextSelection);

        const namesEarly = Array.isArray(data.onboarding_data?.names)
          ? (data.onboarding_data.names as string[])
          : [];

        if (namesEarly.length > 0) {
          setQuantityOverride(selectedProduct?.quantity ?? 1);
          if (selectedProduct?.color) setColor(selectedProduct.color.toLowerCase());
          else if (selectedProduct?.product_color) setColor(selectedProduct.product_color);
          if (selectedProduct?.size) setSingleSize(selectedProduct.size);
          else if (typeof (data.config as { size?: unknown } | null)?.size === "string") {
            setSingleSize((data.config as { size: string }).size);
          }
        } else {
          setCartLines(
            parseCartLinesFromConfig(
              (data.config ?? {}) as Record<string, unknown>,
              selectedProduct
            )
          );
        }
        if (selectedSlogan?.main_text) setCustomText(selectedSlogan.main_text);
      } finally {
        setPlacementReady(true);
      }
    })();
  }, [sessionId]);

  const names = Array.isArray(onboardingData?.names) ? onboardingData.names : [];
  const isGroupOrder = names.length > 0;
  const quantity = quantityOverride || onboardingData?.group_size || 1;
  const product = productSelection?.product ?? onboardingData?.product ?? "tshirt";

  const currentProduct = availableProducts[selectedProductIndex] ?? null;
  const placementProduct = useMemo(() => {
    const base = (currentProduct ?? FALLBACK_PLACEMENT_PRODUCT) as PlacementEditorProps["product"];
    const basePlacement = base.print_area?.placement ?? "front_large";
    return {
      ...base,
      print_area: {
        ...(base.print_area ?? {}),
        placement: placementForPrintArea(printArea, basePlacement),
      },
    } as PlacementEditorProps["product"];
  }, [currentProduct, printArea]);

  const printfulVariants = useMemo(
    () => (currentProduct?.variants ?? []) as PrintfulProductVariant[],
    [currentProduct]
  );

  const activePrintfulProductId =
    typeof currentProduct?.printful_product_id === "number" ? currentProduct.printful_product_id : null;

  const colorOptions = useMemo(
    () => getPrintfulColorOptions(printfulVariants),
    [printfulVariants]
  );
  const shownColorOptions = colorOptions.length > 0 ? colorOptions : undefined;

  const primaryLineColor = cartLines[0]?.color ?? "black";
  const effectiveColor = useMemo(() => {
    if (isGroupOrder) {
      if (colorOptions.length > 0 && !colorOptions.some((option) => option.id === color)) {
        return colorOptions[0].id;
      }
      return color;
    }
    if (colorOptions.length > 0 && !colorOptions.some((option) => option.id === primaryLineColor)) {
      return colorOptions[0].id;
    }
    return primaryLineColor;
  }, [isGroupOrder, colorOptions, color, primaryLineColor]);

  useEffect(() => {
    if (isGroupOrder || colorOptions.length === 0) return;
    startTransition(() => {
      setCartLines((prev) => {
        const line0 = prev[0];
        if (!line0) return prev;
        if (colorOptions.some((o) => o.id === line0.color)) return prev;
        const nextColor = colorOptions[0].id;
        const sizesForColor = getPrintfulSizeOptions(printfulVariants, nextColor);
        const nextSize = sizesForColor.includes(line0.size) ? line0.size : sizesForColor[0] ?? line0.size;
        return [{ ...line0, color: nextColor, size: nextSize }, ...prev.slice(1)];
      });
    });
  }, [colorOptions, isGroupOrder, printfulVariants]);

  const sizeOptions = useMemo(
    () => getPrintfulSizeOptions(printfulVariants, effectiveColor),
    [effectiveColor, printfulVariants]
  );
  const shownSizeOptions = useMemo(
    () => (sizeOptions.length > 0 ? sizeOptions : ["XS", "S", "M", "L", "XL", "XXL"]),
    [sizeOptions]
  );
  const selectedSize = names.length > 0
    ? sizes[names[0]] ?? productSelection?.size ?? shownSizeOptions[0]
    : singleSize && shownSizeOptions.includes(singleSize)
      ? singleSize
      : productSelection?.size ?? shownSizeOptions[0];

  const selectedVariant = useMemo(() => {
    if (isGroupOrder) {
      return findPrintfulVariant(printfulVariants, selectedSize, effectiveColor);
    }
    const line0 = cartLines[0];
    if (!line0) return undefined;
    return findPrintfulVariant(printfulVariants, line0.size, line0.color);
  }, [isGroupOrder, printfulVariants, selectedSize, effectiveColor, cartLines]);

  const totalQuantity = isGroupOrder
    ? quantity
    : cartLines.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    if (!isGroupOrder) return;
    if (!selectedVariant) {
      const timer = window.setTimeout(() => {
        setPriceQuote(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    void (async () => {
      setPriceStatus("Preis wird berechnet...");
      try {
        const response = await fetch("/api/pricing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printful_product_id: activePrintfulProductId,
            printful_variant_id: selectedVariant.variant_id,
            quantity,
            country_code: "DE",
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { quote?: PriceQuote; error?: string };
        if (!response.ok || !data.quote) {
          throw new Error(data.error ?? "Preis konnte nicht berechnet werden.");
        }
        setPriceQuote(data.quote);
        setPriceStatus(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPriceQuote(null);
        setPriceStatus(error instanceof Error ? error.message : "Preis konnte nicht berechnet werden.");
      }
    })();

    return () => controller.abort();
  }, [activePrintfulProductId, isGroupOrder, quantity, selectedVariant]);

  useEffect(() => {
    if (isGroupOrder) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setPriceStatus("Preis wird berechnet...");
        setLinePrices({});
        try {
          const results = await Promise.all(
            cartLines.map(async (line, index) => {
              const v = findPrintfulVariant(printfulVariants, line.size, line.color);
              if (!v || activePrintfulProductId == null) {
                return { index, quote: null as PriceQuote | null };
              }
              const response = await fetch("/api/pricing/quote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  printful_product_id: activePrintfulProductId,
                  printful_variant_id: v.variant_id,
                  quantity: line.quantity,
                  country_code: "DE",
                }),
              });
              const data = (await response.json()) as { quote?: PriceQuote; error?: string };
              if (!response.ok || !data.quote) {
                return { index, quote: null as PriceQuote | null };
              }
              return { index, quote: data.quote };
            })
          );
          if (cancelled) return;
          const next: Record<number, PriceQuote> = {};
          for (const { index, quote } of results) {
            if (quote) next[index] = quote;
          }
          setLinePrices(next);
          setPriceStatus(null);
        } catch {
          if (cancelled) return;
          setLinePrices({});
          setPriceStatus("Preis konnte nicht berechnet werden.");
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activePrintfulProductId, cartLines, isGroupOrder, printfulVariants]);

  function updateCartLine(index: number, patch: Partial<CartLine>) {
    setCartLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  function addCartLine() {
    const defaultColor = shownColorOptions?.[0]?.id ?? "black";
    const defaultSize =
      getPrintfulSizeOptions(printfulVariants, defaultColor)[0] ?? "M";
    setCartLines((prev) => [...prev, { color: defaultColor, size: defaultSize, quantity: 1 }]);
  }

  function removeCartLine(index: number) {
    setCartLines((prev) => prev.filter((_, i) => i !== index));
  }

  const totalCents = cartLines.reduce((sum, line, i) => {
    const q = linePrices[i];
    return sum + (q ? q.unitAmountCents * line.quantity : 0);
  }, 0);

  const lineCurrency =
    linePrices[0]?.currency ??
    cartLines.map((_, i) => linePrices[i]?.currency).find(Boolean) ??
    "EUR";

  const handleCheckout = async () => {
    const basePlacement = placementProduct.print_area?.placement ?? "front_large";
    const checkoutPlacement =
      existingConfig.placement && typeof existingConfig.placement === "object"
        ? {
            ...(existingConfig.placement as Record<string, unknown>),
            placement: placementForPrintArea(printArea, basePlacement),
          }
        : undefined;
    if (isGroupOrder) {
      const checkoutSize = selectedSize;
      const checkoutVariant = selectedVariant;
      await supabase
        .from("sessions")
        .update({
          config: {
            ...existingConfig,
            product,
            product_color: effectiveColor,
            print_area: printArea,
            ...(checkoutPlacement ? { placement: checkoutPlacement } : {}),
            text_override: customText,
            sizes,
            size: checkoutSize,
            quantity,
            shipping_country: "DE",
          },
          product_selection: checkoutVariant
            ? {
                product,
                product_color: effectiveColor,
                quantity,
                ...(activePrintfulProductId ? { printful_product_id: activePrintfulProductId } : {}),
                printful_variant_id: checkoutVariant.variant_id,
                size: checkoutVariant.size,
                color: checkoutVariant.color,
              }
            : {
                product,
                product_color: effectiveColor,
                quantity,
                ...(activePrintfulProductId ? { printful_product_id: activePrintfulProductId } : {}),
                size: checkoutSize,
                color: effectiveColor,
              },
          status: "checkout",
        })
        .eq("id", sessionId);
    } else {
      const line0 = cartLines[0];
      const v0 =
        line0 != null ? findPrintfulVariant(printfulVariants, line0.size, line0.color) : undefined;
      await supabase
        .from("sessions")
        .update({
          config: {
            ...existingConfig,
            product,
            product_color: line0?.color ?? "black",
            print_area: printArea,
            ...(checkoutPlacement ? { placement: checkoutPlacement } : {}),
            text_override: customText,
            sizes,
            size: line0?.size ?? "M",
            quantity: totalQuantity,
            cart_lines: cartLines,
            shipping_country: "DE",
          },
          product_selection: v0
            ? {
                product,
                product_color: line0!.color,
                quantity: line0!.quantity,
                ...(activePrintfulProductId ? { printful_product_id: activePrintfulProductId } : {}),
                printful_variant_id: v0.variant_id,
                size: v0.size,
                color: v0.color,
              }
            : {
                product,
                product_color: line0?.color ?? "black",
                quantity: line0?.quantity ?? 1,
                ...(activePrintfulProductId ? { printful_product_id: activePrintfulProductId } : {}),
                size: line0?.size ?? "M",
                color: line0?.color ?? "black",
              },
          status: "checkout",
        })
        .eq("id", sessionId);
    }

    router.push(`/checkout/${sessionId}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        rightSlot={
          <FeedbackWidget
            triggerVariant="header"
            sessionId={sessionId}
            targetType="page"
            targetRef={`configure:${sessionId}`}
            clientState={{
              designUrl,
              product,
              color: effectiveColor,
              quantity: totalQuantity,
            }}
          />
        }
      />
      <main>
        <PageShell>
          <PageTitle
            eyebrow="Konfiguration"
            title="Dein Design konfigurieren"
            description="Passe Farbe, Produkt und Menge an."
          />

          {placementSetupWarning ? (
            <AppNotice tone="warning" className="mb-4">
              {placementSetupWarning}
            </AppNotice>
          ) : null}

          {availableProducts.length > 1 ? (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Produkt</p>
              <div className="flex flex-wrap gap-2">
                {availableProducts.map((p, index) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductIndex(index);
                      setColor("black");
                      setSingleSize("M");
                      const vars = (p.variants ?? []) as PrintfulProductVariant[];
                      const opts = getPrintfulColorOptions(vars);
                      if (!isGroupOrder) {
                        const c = opts[0]?.id ?? "black";
                        const s = getPrintfulSizeOptions(vars, c)[0] ?? "M";
                        setCartLines([{ color: c, size: s, quantity: 1 }]);
                      }
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      selectedProductIndex === index
                        ? "border-violet-500/70 bg-violet-600/20 text-violet-100"
                        : "border-zinc-700/70 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800"
                    )}
                  >
                    {cleanProductTitle(p.title)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {placementReady && designUrl ? (
            <PlacementEditor
              sessionId={sessionId}
              designUrl={designUrl}
              initialConfig={existingConfig as PlacementEditorProps["initialConfig"]}
              product={placementProduct}
              colorOptions={shownColorOptions}
              colorOverride={effectiveColor}
              hideNavigation
              onColorChange={(c) => {
                if (isGroupOrder) setColor(c);
                else updateCartLine(0, { color: c });
              }}
              onSaved={(nextConfig) => {
                setExistingConfig(nextConfig);
              }}
            />
          ) : null}

          <AppSurface className="space-y-5">
            <ColorPicker
              selected={effectiveColor}
              onChange={(c) => {
                if (isGroupOrder) setColor(c);
                else updateCartLine(0, { color: c });
              }}
              colors={shownColorOptions}
            />
            <FieldGroup label="Druckbereich">
              <div className="flex gap-2">
                {(["front", "back", "both"] as const).map((area) => (
                  <Button
                    key={area}
                    variant={printArea === area ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPrintArea(area)}
                    className={
                      printArea === area
                        ? primaryActionClassName("px-4")
                        : secondaryActionClassName("px-4")
                    }
                  >
                    {area === "front" ? "Vorne" : area === "back" ? "Hinten" : "Vorne + Hinten"}
                  </Button>
                ))}
              </div>
            </FieldGroup>

            <TextEditor value={customText} onChange={setCustomText} label="Text auf dem Design" />
          </AppSurface>

          {isGroupOrder ? (
            <AppSurface className="space-y-3">
              <p className="text-sm font-medium text-zinc-400">Größen ({names.length} Personen)</p>
              <div className="space-y-2">
                {names.map((name) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{name}</span>
                    <div className="flex gap-1">
                      {shownSizeOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSizes((prev) => ({ ...prev, [name]: s }))}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs transition-colors",
                            sizes[name] === s
                              ? "bg-violet-600 text-white shadow-sm shadow-violet-950/40"
                              : "border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AppSurface>
          ) : null}

          {!isGroupOrder ? (
            <AppSurface className="space-y-4">
              <p className="text-sm font-medium text-zinc-400">Bestellung zusammenstellen</p>

              {cartLines.map((line, index) => {
                const lineSizeOptions = getPrintfulSizeOptions(printfulVariants, line.color);
                const sizesForLine =
                  lineSizeOptions.length > 0 ? lineSizeOptions : shownSizeOptions;
                const linePrice = linePrices[index];
                const lineColorChoices = shownColorOptions ?? FALLBACK_CART_COLOR_SWATCHES;
                return (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-700/50 bg-zinc-900/50 p-3"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {lineColorChoices.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          title={option.label}
                          aria-label={option.label}
                          onClick={() =>
                            updateCartLine(index, {
                              color: option.id,
                              size:
                                getPrintfulSizeOptions(printfulVariants, option.id)[0] ?? line.size,
                            })
                          }
                          className={cn(
                            "h-6 w-6 rounded-full border-2 transition-all",
                            line.color === option.id
                              ? "scale-110 border-violet-400"
                              : "border-zinc-600 hover:border-zinc-400"
                          )}
                          style={{ backgroundColor: option.hex }}
                        />
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {sizesForLine.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateCartLine(index, { size: s })}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs transition-colors",
                            line.size === s
                              ? "bg-violet-600 text-white"
                              : "border border-zinc-700/70 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-800"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={line.quantity}
                      onChange={(e) =>
                        updateCartLine(index, {
                          quantity: Math.max(1, Number.parseInt(e.target.value || "1", 10)),
                        })
                      }
                      className="w-16 rounded-full border border-zinc-700/80 bg-zinc-950/60 px-3 py-1.5 text-center text-sm text-zinc-100 outline-none focus:border-violet-500"
                    />

                    <span className="min-w-[60px] text-xs text-zinc-500">
                      {linePrice
                        ? `${formatMoney(linePrice.unitAmountCents, linePrice.currency)} / Stk`
                        : "…"}
                    </span>

                    {cartLines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeCartLine(index)}
                        className="ml-auto rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        aria-label="Position entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addCartLine}
                className="flex items-center gap-2 text-sm text-violet-400 transition-colors hover:text-violet-300"
              >
                <Plus className="h-4 w-4" /> Weitere Variante hinzufügen
              </button>
            </AppSurface>
          ) : null}

          <Separator className="border-zinc-800/70" />

          <AppSurface className="space-y-4">
            {isGroupOrder ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-400">Menge</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={quantityOverride}
                  onChange={(e) =>
                    setQuantityOverride(Math.max(1, Number.parseInt(e.target.value || "1", 10)))
                  }
                  className="w-28 rounded-full border border-zinc-700/80 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500"
                />
              </label>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <div>
                {!isGroupOrder ? (
                  <>
                    <p className="text-sm text-zinc-400">
                      {totalQuantity} Stück ·{" "}
                      {priceStatus ??
                        (Object.keys(linePrices).length < cartLines.length
                          ? "Preis wird berechnet…"
                          : "")}
                    </p>
                    <p className="text-xl font-bold text-white">
                      {Object.keys(linePrices).length === cartLines.length && cartLines.length > 0
                        ? formatMoney(totalCents, lineCurrency)
                        : "–"}
                    </p>
                    {linePrices[0]?.shippingIncludedInShopPrice ? (
                      <p className="text-xs text-zinc-500">Versand im Preis enthalten</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-zinc-400">
                      {priceQuote
                        ? `${quantity} x ${formatMoney(priceQuote.unitAmountCents, priceQuote.currency)}`
                        : priceStatus ?? "Preis wird berechnet…"}
                    </p>
                    <p className="text-xl font-bold text-white">
                      {priceQuote ? formatMoney(priceQuote.totalCents, priceQuote.currency) : "–"}
                    </p>
                  </>
                )}
              </div>
              <Button
                onClick={() => void handleCheckout()}
                disabled={
                  isGroupOrder
                    ? !priceQuote
                    : Object.keys(linePrices).length < cartLines.length
                }
                className={primaryActionClassName("px-6")}
              >
                <ShoppingCart className="mr-2 h-4 w-4" /> In den Warenkorb
              </Button>
            </div>
          </AppSurface>
        </PageShell>
      </main>
    </div>
  );
}
