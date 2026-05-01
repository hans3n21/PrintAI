"use client";

import { Button } from "@/components/ui/button";
import {
  AppNotice,
  AppSurface,
  primaryActionClassName,
  secondaryActionClassName,
} from "@/components/ui/appSurface";
import {
  calculatePriceQuote,
  DEFAULT_SHIPPING_RATES,
  shippingPaidForSubtotalCents,
  type PricingSettings,
  type ShippingRate,
} from "@/lib/pricing/calculatePrice";
import { choosePrintfulPreview } from "@/lib/printful/productPreviewImages";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

type PricingApiResponse = {
  pricing?: {
    markup_percent?: unknown;
    markup_fixed_cents?: unknown;
    currency?: unknown;
  };
  shipping_rates?: unknown;
};

function normalizeShippingRateRow(row: Record<string, unknown>): ShippingRate {
  return {
    countryCode:
      typeof row.country_code === "string" && row.country_code.trim().length > 0
        ? row.country_code.trim().toUpperCase()
        : "DE",
    label:
      typeof row.label === "string" && row.label.trim().length > 0
        ? row.label.trim()
        : "Versand",
    amountCents: typeof row.amount_cents === "number" ? Math.max(0, Math.trunc(row.amount_cents)) : 0,
    freeFromCents:
      typeof row.free_from_cents === "number"
        ? Math.max(0, Math.trunc(row.free_from_cents))
        : null,
    enabled: row.enabled !== false,
  };
}

function shippingRatesFromApiPayload(rows: unknown): ShippingRate[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return DEFAULT_SHIPPING_RATES;
  }
  return rows.map((entry) =>
    normalizeShippingRateRow(entry != null && typeof entry === "object" ? (entry as Record<string, unknown>) : {})
  );
}

type ProductVariant = {
  variant_id: number;
  size: string | null | undefined;
  color: string | null | undefined;
  material?: string | null;
  price_cents?: number | null;
};

type ProductImage = {
  catalog_variant_id?: number | null;
  color?: string | null;
  placement?: string | null;
  image_url?: string | null;
  background_image?: string | null;
};

type ProductColorAsset = {
  id: string;
  printful_product_id: number;
  color_slug: string;
  placement: string;
  source: "printful" | "manual";
  mockup_style_id?: number | null;
  image_url: string;
  background_color?: string | null;
  is_preferred?: boolean | null;
  template_width?: number | null;
  template_height?: number | null;
  print_area_left?: number | null;
  print_area_top?: number | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
};

type ProductColor = {
  color_slug: string;
  color_name: string;
  color_hex?: string | null;
  is_active?: boolean | null;
};

type PrintArea = {
  placement: string | null;
  area_width: number | null;
  area_height: number | null;
};

type CatalogProductPayload = {
  id?: string;
  printful_product_id: number;
  title: string;
  slug?: string | null;
  technique: string | null;
  variants: unknown;
  mockup_templates: Array<{ image_url?: string | null; background_url?: string | null }> | null;
  product_images?: ProductImage[] | null;
  product_colors?: ProductColor[] | null;
  color_assets?: ProductColorAsset[] | null;
  print_area?: PrintArea | null;
  is_active: boolean;
  is_primary?: boolean;
  sort_order: number | null;
  shop_unit_price_cents?: number | null;
};

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const ADMIN_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "XXL", "XXXL"];

const FALLBACK_ADMIN_PRICING: PricingSettings = {
  markupPercent: 50,
  markupFixedCents: 0,
  currency: "eur",
};

/** 5 € Gutschein-/Generierungsanteil – in der Marge vom Shoppreis abziehen (neben Einkauf und Porto). */
const ADMIN_SHIRT_JOB_DEDUCTION_CENTS = 500;

function compareSizes(a: string, b: string) {
  const ia = ADMIN_SIZE_ORDER.indexOf(a);
  const ib = ADMIN_SIZE_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

function coerceVariants(raw: unknown): ProductVariant[] {
  if (!Array.isArray(raw)) return [];

  const variants: ProductVariant[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = Number(item.variant_id ?? item.catalog_variant_id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const sizeRaw = typeof item.size === "string" ? item.size : null;
    const colorRaw = typeof item.color === "string" ? item.color : null;
    let price =
      typeof item.price_cents === "number"
        ? item.price_cents
        : item.price != null && item.price !== ""
          ? Number(item.price)
          : null;
    if (typeof price === "number" && !Number.isFinite(price)) price = null;
    let material =
      typeof item.material === "string" && item.material.trim().length > 0
        ? item.material.trim()
        : null;
    if (!material) {
      const name = typeof item.name === "string" ? item.name : "";
      const lowered = name.toLowerCase();
      const match = lowered.match(/\b([\wÄÖÜäöüß]+)\s*cotton\b/);
      if (match?.[1]) material = `${match[1].replace(/^\w/, (ch) => ch.toUpperCase())} Cotton`;
    }
    variants.push({
      variant_id: id,
      size: sizeRaw?.trim() ? sizeRaw.trim().toUpperCase() : null,
      color: colorRaw?.trim() ? colorRaw.trim() : null,
      material,
      price_cents: typeof price === "number" ? Math.round(price) : null,
    });
  }
  return variants;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueSizesSorted(values: string[]) {
  return [...new Set(values)].sort(compareSizes);
}

function colorSlug(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ?? "";
}

function firstSelectedColor(payload: CatalogProductPayload, selection?: ReturnType<typeof deriveInitialVariantSelection>) {
  const selectedColor = [...(selection?.colorSelection ?? [])][0]?.trim().toLowerCase();
  if (selectedColor) return selectedColor;

  return (
    coerceVariants(payload.variants)
      .find((variant) => variant.color?.trim())
      ?.color?.trim()
      .toLowerCase() ?? "black"
  );
}

function getAdminCoverUrl(
  payload: CatalogProductPayload,
  selection?: ReturnType<typeof deriveInitialVariantSelection>
) {
  const selectedSlug = colorSlug(firstSelectedColor(payload, selection));
  const preferredAsset = payload.color_assets?.find(
    (asset) =>
      asset.is_preferred &&
      asset.color_slug === selectedSlug &&
      (asset.placement === payload.print_area?.placement ||
        asset.placement === "front" ||
        asset.placement === "front_large")
  );
  if (preferredAsset?.image_url) return preferredAsset.image_url;

  return choosePrintfulPreview({
    images: payload.product_images ?? [],
    templates: payload.mockup_templates ?? [],
    variants: coerceVariants(payload.variants),
    color: firstSelectedColor(payload, selection),
    placement: payload.print_area?.placement ?? "front_large",
  }).src;
}

function deriveInitialVariantSelection(variants: ProductVariant[]) {
  const colors = uniqueSorted(variants.map((variant) => variant.color).filter(Boolean) as string[]);
  const sizes = uniqueSizesSorted(variants.map((variant) => variant.size).filter(Boolean) as string[]);
  const defaultColors =
    colors.length > 0
      ? colors.filter((color) => {
          const lowered = color.toLowerCase();
          return lowered === "black" || lowered === "white";
        })
      : [];
  const colorSelection = new Set(
    defaultColors.length > 0 ? defaultColors : colors.slice(0, Math.min(2, colors.length))
  );

  let sizePick: string[];
  if (sizes.length <= 4) sizePick = sizes;
  else {
    const preferred = sizes.filter((size) =>
      ["M", "L", "XL"].includes(size)
    );
    sizePick =
      preferred.length > 0 ? uniqueSorted(preferred) : sizes.slice(0, 3);
  }
  const sizeSelection = new Set(sizePick.length > 0 ? sizePick : sizes);

  return { colorSelection, sizeSelection };
}

function filterVariants(selection: CatalogProductPayload, colors: Set<string>, sizes: Set<string>) {
  return coerceVariants(selection.variants).filter(
    (variant) =>
      Boolean(variant.color && variant.size && colors.has(variant.color) && sizes.has(variant.size))
  );
}

function averageCents(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, cents) => total + cents, 0) / values.length);
}

function minPositiveCents(values: number[]) {
  const positives = values.filter((value) => value > 0);
  if (positives.length === 0) return null;
  return Math.min(...positives);
}

function markupShopUnitCents(costCents: number, pricing: PricingSettings) {
  return calculatePriceQuote({
    baseCostCents: Math.max(costCents, 1),
    quantity: 1,
    countryCode: "DE",
    pricing,
    shippingRates: DEFAULT_SHIPPING_RATES,
  }).unitAmountCents;
}

export function AdminProducts() {
  const [products, setProducts] = useState<CatalogProductPayload[]>([]);
  const pricingRef = useRef<PricingSettings | null>(null);
  const shippingRatesRef = useRef<ShippingRate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewResults, setPreviewResults] = useState<CatalogProductPayload[]>([]);
  const [previewExpandedIds, setPreviewExpandedIds] = useState(() => new Set<number>());
  const previewSelectionsRef = useRef(
    new Map<number, ReturnType<typeof deriveInitialVariantSelection>>()
  );
  const [integratedExpandedIds, setIntegratedExpandedIds] = useState(() => new Set<string>());
  const integratedSelectionsRef = useRef(
    new Map<string, ReturnType<typeof deriveInitialVariantSelection>>()
  );
  const integratedPersistedSelectionsRef = useRef(
    new Map<string, ReturnType<typeof deriveInitialVariantSelection>>()
  );
  const integratedShopDraftRef = useRef(new Map<string, string>());
  const [integratedShopEditors, setIntegratedShopEditors] = useState(() => new Set<string>());
  /** Keys: `${context}-${selectionKey}-colors` | `${context}-${selectionKey}-sizes` — wenn nicht enthalten, nur Auswahl sichtbar. */
  const [variantPickerLayers, setVariantPickerLayers] = useState(() => new Set<string>());

  /** Cache: printful_product_id → alle verfügbaren Farben laut Printful-Katalog (für "+" Picker). */
  const catalogColorsRef = useRef<Map<number, string[]>>(new Map());
  const loadingCatalogIds = useRef<Set<number>>(new Set());
  /** Inkrementiert, wenn catalogColorsRef befüllt wird — triggert Re-Render in renderVariantControls. */
  const [catalogColorsVersion, setCatalogColorsVersion] = useState(0);

  async function loadProducts({ resetNotice = false }: { resetNotice?: boolean } = {}) {
    if (resetNotice) setNotice(null);
    setLoading(true);
    try {
      const [productResponse, pricingResponse] = await Promise.all([
        fetch("/api/admin/printful/products", { cache: "no-store" }),
        fetch("/api/admin/pricing", { cache: "no-store" }),
      ]);
      try {
        if (pricingResponse.ok) {
          const data = (await pricingResponse.json()) as PricingApiResponse;
          const row = data.pricing;
          if (
            typeof row?.markup_percent === "number" &&
            typeof row?.markup_fixed_cents === "number" &&
            typeof row?.currency === "string"
          ) {
            pricingRef.current = {
              markupPercent: row.markup_percent,
              markupFixedCents: row.markup_fixed_cents,
              currency: row.currency,
            };
          }
          shippingRatesRef.current = shippingRatesFromApiPayload(data.shipping_rates);
        }
      } catch {
        pricingRef.current = null;
        shippingRatesRef.current = null;
      }

      const payload = (await productResponse.json()) as {
        products?: CatalogProductPayload[];
        error?: string;
      };
      if (!productResponse.ok) {
        throw new Error(payload.error ?? "Produkte konnten nicht geladen werden");
      }
      setProducts(payload.products ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Produkte konnten nicht geladen werden");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function bootstrapIntegratedSelections(nextProducts: CatalogProductPayload[]) {
    const persisted = integratedPersistedSelectionsRef.current;
    for (const payload of nextProducts) {
      if (!payload.id) continue;
      const variants = coerceVariants(payload.variants);
      if (!persisted.has(payload.id)) {
        const initial = deriveInitialVariantSelection(variants);
        persisted.set(payload.id, initial);
        integratedSelectionsRef.current.set(payload.id, cloneSelection(initial));
      }
    }
  }

  function cloneSelection(selection: ReturnType<typeof deriveInitialVariantSelection>) {
    return {
      colorSelection: new Set(selection.colorSelection),
      sizeSelection: new Set(selection.sizeSelection),
    };
  }

  useEffect(() => {
    bootstrapIntegratedSelections(products);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstraps refs from latest product list only
  }, [products]);

  async function syncCatalog() {
    setSyncing(true);
    setNotice(null);
    try {
      // Send all known product IDs so every product in the DB gets refreshed
      const knownIds = products
        .map((p) => p.printful_product_id)
        .filter((id): id is number => typeof id === "number" && id > 0);
      const response = await fetch("/api/admin/printful/sync-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: knownIds.length > 0 ? knownIds : undefined }),
      });
      const data = (await response.json()) as {
        synced?: number;
        products?: CatalogProductPayload[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Katalog-Sync fehlgeschlagen");
      }
      // Merge synced products into the existing list — don't replace unsyncted products
      const syncedById = new Map((data.products ?? []).map((p) => [p.printful_product_id, p]));
      setProducts((prev) => {
        const merged = prev.map((p) =>
          p.printful_product_id != null && syncedById.has(p.printful_product_id)
            ? { ...p, ...syncedById.get(p.printful_product_id) }
            : p
        );
        // Add any newly synced products not yet in the list
        for (const [pid, product] of syncedById.entries()) {
          if (!merged.some((p) => p.printful_product_id === pid)) {
            merged.push(product);
          }
        }
        return merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      });
      setNotice(`${data.synced ?? 0} Produkt${data.synced === 1 ? "" : "e"} synchronisiert.`);
      void fetch("/api/admin/pricing", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          const dataPayload = payload as PricingApiResponse | null;
          const row = dataPayload?.pricing;
          if (
            row &&
            typeof row.markup_percent === "number" &&
            typeof row.markup_fixed_cents === "number" &&
            typeof row.currency === "string"
          ) {
            pricingRef.current = {
              markupPercent: row.markup_percent,
              markupFixedCents: row.markup_fixed_cents,
              currency: row.currency,
            };
          }
          if (dataPayload?.shipping_rates != null) {
            shippingRatesRef.current = shippingRatesFromApiPayload(dataPayload.shipping_rates);
          }
        })
        .catch(() => {});
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Katalog-Sync fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  }

  async function patchProductInternal(
    id: string | undefined,
    updates: Partial<CatalogProductPayload> & Record<string, unknown>,
    optimistic?: Partial<CatalogProductPayload>
  ) {
    if (!id) return;
    setBusyIds((prev) => new Set(prev).add(id));
    if (optimistic) {
      setProducts((prev) =>
        prev.map((product) =>
          product.id === id ? { ...product, ...optimistic } : product
        )
      );
    }
    try {
      const response = await fetch("/api/admin/printful/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = (await response.json()) as {
        product?: CatalogProductPayload;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Produkt konnte nicht gespeichert werden");
      }
      if (data.product?.id === id) {
        setProducts((prev) =>
          prev.map((product) =>
            product.id === id ? { ...product, ...data.product } : product
          )
        );
        const variants = coerceVariants(data.product!.variants);
        const initial = deriveInitialVariantSelection(variants);
        integratedPersistedSelectionsRef.current.set(id, initial);
        integratedSelectionsRef.current.set(id, cloneSelection(initial));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Produkt konnte nicht gespeichert werden");
      await loadProducts();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function patchProductLegacy(
    id: string | undefined,
    updates: Pick<Partial<CatalogProductPayload>, "is_active" | "sort_order" | "is_primary">
  ) {
    await patchProductInternal(id, updates as Record<string, unknown>, updates);
  }

  async function persistIntegratedVariants(payload: CatalogProductPayload) {
    const id = payload.id;
    if (!id) return;
    const selection =
      integratedSelectionsRef.current.get(id) ??
      cloneSelection(integratedPersistedSelectionsRef.current.get(id)!);
    const filtered = filterVariants(payload, selection.colorSelection, selection.sizeSelection);
    const replacements = filtered.map(({ variant_id, size, color, material, price_cents }) => ({
      variant_id,
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
      ...(material ? { material } : {}),
      ...(typeof price_cents === "number" ? { price_cents } : {}),
    }));
    integratedPersistedSelectionsRef.current.set(id, cloneSelection(selection));
    await patchProductInternal(id, { variants: replacements });
  }

  /**
   * Wenn nach „Katalog synchronisieren“ noch alle Printful-Varianten in der DB liegen,
   * die Admin-UI aber nur eine Teilmenge (z. B. Schwarz/Weiß, M/L/XL) vormerkt,
   * erscheinen im Konfigurator sonst alle Farben — die Checkboxen schreiben die Auswahl
   * erst bei Änderung. Dieser Effekt gleicht einmal die gespeicherten Varianten an die
   * aktuelle Auswahl an, sobald die Abweichung erkennbar ist.
   */
  useEffect(() => {
    if (loading || products.length === 0) return;
    for (const payload of products) {
      const id = payload.id;
      if (!id) continue;
      const variants = coerceVariants(payload.variants);
      if (variants.length === 0) continue;
      const selection =
        integratedSelectionsRef.current.get(id) ??
        integratedPersistedSelectionsRef.current.get(id);
      if (!selection) continue;
      const filtered = filterVariants(payload, selection.colorSelection, selection.sizeSelection);
      if (filtered.length > 0 && filtered.length < variants.length) {
        void persistIntegratedVariants(payload);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Absicht: nur bei products/loading, persist liest aktuelle Refs
  }, [loading, products]);

  async function persistShopPrice(id: string | undefined, raw: string | null | undefined) {
    if (!id) return;
    const trimmed = raw?.trim();
    if (!trimmed) {
      await patchProductInternal(id, { shop_unit_price_cents: null });
      integratedShopDraftRef.current.delete(id);
      setIntegratedShopEditors((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    const normalized = trimmed.replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      setNotice("Ungültiger Shop-Preis");
      return;
    }
    const cents = Math.round(parsed * 100);
    if (cents < 1) {
      setNotice("Shop-Preis muss grösser sein");
      return;
    }
    integratedShopDraftRef.current.delete(id);
    setIntegratedShopEditors((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await patchProductInternal(id, { shop_unit_price_cents: cents }, { shop_unit_price_cents: cents });
  }

  async function patchAsset(
    payload: CatalogProductPayload,
    assetId: string,
    updates: Record<string, unknown>
  ) {
    setNotice(null);
    try {
      const response = await fetch("/api/admin/printful/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assetId, ...updates }),
      });
      const data = (await response.json()) as { asset?: ProductColorAsset; error?: string };
      if (!response.ok || !data.asset) {
        throw new Error(data.error ?? "Asset konnte nicht gespeichert werden");
      }
      setProducts((prev) =>
        prev.map((product) => {
          if (product.printful_product_id !== payload.printful_product_id) return product;
          const nextAssets = (product.color_assets ?? []).map((asset) => {
            const sameGroup =
              asset.printful_product_id === data.asset!.printful_product_id &&
              asset.color_slug === data.asset!.color_slug &&
              asset.placement === data.asset!.placement;
            if (asset.id === data.asset!.id) return data.asset!;
            if (data.asset!.is_preferred && sameGroup) return { ...asset, is_preferred: false };
            return asset;
          });
          return { ...product, color_assets: nextAssets };
        })
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Asset konnte nicht gespeichert werden");
    }
  }

  function dismissPreviewResults() {
    setPreviewResults([]);
    setPreviewExpandedIds(() => new Set());
    previewSelectionsRef.current.clear();
    setVariantPickerLayers((prev) => {
      const next = new Set<string>();
      for (const key of prev) {
        if (!key.startsWith("preview-")) next.add(key);
      }
      return next;
    });
  }

  async function deleteProduct(id: string | undefined, title: string) {
    if (!id) return;
    if (!confirm(`„${title}“ wirklich aus dem Shop-Katalog entfernen?`)) return;
    setBusyIds((prev) => new Set(prev).add(id));
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/printful/products?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Produkt konnte nicht gelöscht werden");
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      integratedSelectionsRef.current.delete(id);
      integratedPersistedSelectionsRef.current.delete(id);
      integratedShopDraftRef.current.delete(id);
      setIntegratedShopEditors((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setIntegratedExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Produkt konnte nicht gelöscht werden");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  /** Lädt alle verfügbaren Farben für ein Printful-Produkt live vom Katalog (einmalig, dann gecacht). */
  async function fetchCatalogColors(printfulId: number) {
    if (loadingCatalogIds.current.has(printfulId)) return;
    if (catalogColorsRef.current.has(printfulId)) return;
    loadingCatalogIds.current.add(printfulId);
    try {
      const response = await fetch(
        `/api/admin/printful/catalog-search?query=${encodeURIComponent(String(printfulId))}`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as { products?: CatalogProductPayload[] };
      const found = data.products?.find((p) => p.printful_product_id === printfulId);
      if (found) {
        const allVariants = coerceVariants(found.variants);
        const allColors = uniqueSorted(
          allVariants.map((v) => v.color).filter(Boolean) as string[]
        );
        catalogColorsRef.current.set(printfulId, allColors);
        setCatalogColorsVersion((v) => v + 1);
      }
    } finally {
      loadingCatalogIds.current.delete(printfulId);
    }
  }

  /** Fügt eine neue Farbe zu einem integrierten Produkt hinzu, indem Printful-Varianten gezielt nachgeladen werden. */
  async function addColorToProduct(
    payload: CatalogProductPayload,
    selection: ReturnType<typeof deriveInitialVariantSelection>
  ) {
    const id = payload.id;
    if (!id) return;
    setBusyIds((prev) => new Set(prev).add(id));
    setNotice(null);
    try {
      const colors = [...selection.colorSelection];
      const existingVariants = coerceVariants(payload.variants);
      const sizes = uniqueSizesSorted(
        existingVariants.map((v) => v.size).filter(Boolean) as string[]
      );
      const response = await fetch("/api/admin/printful/sync-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: [payload.printful_product_id],
          variantFilters: {
            [payload.printful_product_id]: { colors, sizes: sizes.length > 0 ? sizes : undefined },
          },
        }),
      });
      const data = (await response.json()) as {
        products?: CatalogProductPayload[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Sync fehlgeschlagen");
      const syncedById = new Map((data.products ?? []).map((p) => [p.printful_product_id, p]));
      setProducts((prev) =>
        prev.map((p) =>
          p.printful_product_id != null && syncedById.has(p.printful_product_id)
            ? { ...p, ...syncedById.get(p.printful_product_id) }
            : p
        )
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Neue Farbe konnte nicht geladen werden");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function integratePreview(printfulProductId: number) {
    const selection =
      previewSelectionsRef.current.get(printfulProductId) ??
      deriveInitialVariantSelection([]);
    void (async () => {
      const colors = [...selection.colorSelection];
      const sizes = [...selection.sizeSelection];
      setSyncing(true);
      setNotice(null);
      try {
        const response = await fetch("/api/admin/printful/sync-catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productIds: [printfulProductId],
            variantFilters: {
              [printfulProductId]: { colors, sizes },
            },
          }),
        });
        const data = (await response.json()) as {
          synced?: number;
          products?: CatalogProductPayload[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Integration fehlgeschlagen");
        }
        // Merge synced product into existing list — don't drop other products
        const syncedById = new Map((data.products ?? []).map((p) => [p.printful_product_id, p]));
        setProducts((prev) => {
          const merged = prev.map((p) =>
            p.printful_product_id != null && syncedById.has(p.printful_product_id)
              ? { ...p, ...syncedById.get(p.printful_product_id) }
              : p
          );
          for (const [pid, product] of syncedById.entries()) {
            if (!merged.some((p) => p.printful_product_id === pid)) merged.push(product);
          }
          return merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        });
        setNotice(`${data.synced ?? 0} Produkt${data.synced === 1 ? "" : "e"} synchronisiert.`);
        dismissPreviewResults();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Integration fehlgeschlagen");
      } finally {
        setSyncing(false);
      }
    })();
  }

  async function runCatalogSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/printful/catalog-search?query=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        products?: CatalogProductPayload[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Suche fehlgeschlagen");
      }
      const previews = data.products ?? [];
      setPreviewResults(previews);

      previewSelectionsRef.current.clear();
      setVariantPickerLayers(() => new Set());

      previews.forEach((preview) => {
        const variants = coerceVariants(preview.variants);
        previewSelectionsRef.current.set(
          preview.printful_product_id,
          deriveInitialVariantSelection(variants)
        );
      });
      setPreviewExpandedIds(() => new Set());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Suche fehlgeschlagen");
      setPreviewResults([]);
    }
  }

  function renderPriceBadges(payload: CatalogProductPayload, context: "preview" | "integrated") {
    const markup = pricingRef.current ?? FALLBACK_ADMIN_PRICING;
    let selection: ReturnType<typeof deriveInitialVariantSelection>;

    if (context === "preview") {
      selection =
        previewSelectionsRef.current.get(payload.printful_product_id) ??
        deriveInitialVariantSelection(coerceVariants(payload.variants));
    } else if (payload.id) {
      const expanded = integratedExpandedIds.has(payload.id);
      selection = expanded
        ? integratedSelectionsRef.current.get(payload.id) ??
          integratedPersistedSelectionsRef.current.get(payload.id) ??
          deriveInitialVariantSelection(coerceVariants(payload.variants))
        : integratedPersistedSelectionsRef.current.get(payload.id) ??
          deriveInitialVariantSelection(coerceVariants(payload.variants));
    } else {
      selection = deriveInitialVariantSelection(coerceVariants(payload.variants));
    }

    const filtered = filterVariants(payload, selection.colorSelection, selection.sizeSelection);
    const pricePoints = filtered
      .map((variant) =>
        typeof variant.price_cents === "number" && variant.price_cents > 0
          ? variant.price_cents
          : null
      )
      .filter((amount): amount is number => amount != null);

    const minCost = minPositiveCents(pricePoints);
    const avgCost = averageCents(pricePoints.filter(Boolean));

    const overrideCents =
      context === "integrated" && typeof payload.shop_unit_price_cents === "number"
        ? Math.trunc(payload.shop_unit_price_cents)
        : null;

    const shopBadgeCents =
      overrideCents != null
        ? overrideCents
        : minCost != null
          ? markupShopUnitCents(minCost, markup)
          : null;

    const avgCogsCents = avgCost;

    const rates = shippingRatesRef.current ?? DEFAULT_SHIPPING_RATES;
    const germanShippingPaidCents = shippingPaidForSubtotalCents({
      subtotalCents: shopBadgeCents ?? 0,
      countryCode: "DE",
      shippingRates: rates,
    });

    /** Marge nur für Admin: Shop-Verkaufspreis minus Ø Printful-Einkauf der Auswahl minus 5 € minus Versand DE. */
    const netEndCents =
      shopBadgeCents != null &&
      shopBadgeCents >= 1 &&
      typeof avgCogsCents === "number" &&
      Number.isFinite(avgCogsCents)
        ? shopBadgeCents -
          Math.round(avgCogsCents) -
          ADMIN_SHIRT_JOB_DEDUCTION_CENTS -
          germanShippingPaidCents
        : null;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-emerald-200">
          Printful{" "}
          {minCost != null
            ? `ab ${eurFormatter.format(minCost / 100)}`
            : "Preis ausstehend"}
        </span>
        {(context === "preview" || integratedExpandedIds.has(payload.id ?? "")) && avgCost ? (
          <span className="rounded-full border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-zinc-300">
            Auswahl Ø {eurFormatter.format(avgCost / 100)}
          </span>
        ) : null}
        <span className="rounded-full bg-violet-900/70 px-2 py-0.5 font-medium text-violet-100 shadow-inner shadow-black/40">
          {context === "integrated" && integratedShopEditors.has(payload.id!) ? (
            <span className="inline-flex items-center gap-1">
              Shop
              <input
                className="h-6 w-24 rounded-full border border-violet-500/70 bg-zinc-950 px-2 text-[11px] text-violet-50 outline-none"
                defaultValue={integratedShopDraftRef.current.get(payload.id!) ?? ""}
                aria-label={`Shop-Preis ${payload.title}`}
                onBlur={(event) =>
                  void persistShopPrice(payload.id, event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    setIntegratedShopEditors((prev) => {
                      const next = new Set(prev);
                      next.delete(payload.id!);
                      return next;
                    });
                  }
                }}
              />{" "}
              €
            </span>
          ) : (
            <button
              type="button"
              className="font-semibold underline-offset-2 hover:underline"
              onClick={() => {
                if (!payload.id || context !== "integrated") return;
                const cents =
                  typeof payload.shop_unit_price_cents === "number"
                    ? payload.shop_unit_price_cents / 100
                    : shopBadgeCents != null
                      ? shopBadgeCents / 100
                      : null;
                integratedShopDraftRef.current.set(
                  payload.id,
                  cents != null ? String(cents).replace(".", ",") : ""
                );
                setIntegratedShopEditors((prev) => new Set(prev).add(payload.id!));
              }}
            >
              Shop{" "}
              {shopBadgeCents != null
                ? `ab ${eurFormatter.format(shopBadgeCents / 100)}`
                : "—"}
            </button>
          )}
        </span>
        {netEndCents != null ? (
          <span className="rounded-full border border-amber-500/45 bg-amber-950/40 px-2 py-0.5 text-amber-100">
            Marge netto {eurFormatter.format(netEndCents / 100)}
          </span>
        ) : null}
      </div>
    );
  }

  function renderVariantControls(
    payload: CatalogProductPayload,
    context: "preview" | "integrated"
  ) {
    const variants = coerceVariants(payload.variants);
    const colors = uniqueSorted(variants.map((variant) => variant.color).filter(Boolean) as string[]);
    const sizes = uniqueSizesSorted(variants.map((variant) => variant.size).filter(Boolean) as string[]);

    const printfulId = payload.printful_product_id;
    const integratedId = payload.id;

    const selectionKey =
      context === "preview" ? printfulId : integratedId ?? printfulId;

    const ensureSelection = () => {
      if (context === "preview") {
        const map = previewSelectionsRef.current;
        if (!map.has(printfulId)) {
          map.set(printfulId, deriveInitialVariantSelection(variants));
        }
        return map.get(printfulId)!;
      }
      if (!integratedId) {
        return deriveInitialVariantSelection(variants);
      }
      if (!integratedSelectionsRef.current.has(integratedId)) {
        const baseline =
          integratedPersistedSelectionsRef.current.get(integratedId) ??
          deriveInitialVariantSelection(variants);
        integratedSelectionsRef.current.set(integratedId, cloneSelection(baseline));
      }
      return integratedSelectionsRef.current.get(integratedId)!;
    };

    const selection = ensureSelection();

    const forceUpdate = () => {
      if (context === "preview") {
        setPreviewExpandedIds((prev) => new Set(prev));
      } else if (integratedId) {
        setIntegratedExpandedIds((prev) => new Set(prev));
      }
    };

    const pickerLayerBase = `${context}-${selectionKey}`;
    const expandedAllColors = variantPickerLayers.has(`${pickerLayerBase}-colors`);
    const expandedAllSizes = variantPickerLayers.has(`${pickerLayerBase}-sizes`);

    // Catalog colors: alle vom Printful-Katalog bekannten Farben (wenn geladen)
    // catalogColorsVersion wird inkrementiert wenn neue Daten ankommen → Re-Render
    void catalogColorsVersion;
    const catalogColors = context === "integrated"
      ? catalogColorsRef.current.get(printfulId) ?? colors
      : colors;

    const togglePickerLayer = (segment: "colors" | "sizes") => {
      const key = `${pickerLayerBase}-${segment}`;
      setVariantPickerLayers((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          // Katalogfarben nachladen wenn "+" für Farben geöffnet wird
          if (segment === "colors" && context === "integrated") {
            void fetchCatalogColors(printfulId);
          }
        }
        return next;
      });
    };

    const colorRows = expandedAllColors
      ? uniqueSorted(catalogColors)
      : uniqueSorted(colors.filter((c) => selection.colorSelection.has(c)));
    const sizeRows = expandedAllSizes
      ? sizes
      : uniqueSizesSorted(sizes.filter((s) => selection.sizeSelection.has(s)));

    const priceByColor = new Map<string, number[]>();
    for (const variant of variants) {
      if (!variant.color || typeof variant.price_cents !== "number") continue;
      const list = priceByColor.get(variant.color) ?? [];
      list.push(variant.price_cents);
      priceByColor.set(variant.color, list);
    }

    return (
      <div className="mt-3 space-y-3 text-xs text-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Farben
            </p>
            <button
              type="button"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-lg font-light leading-none text-zinc-200 hover:bg-zinc-900"
              aria-expanded={expandedAllColors}
              aria-label={
                expandedAllColors
                  ? `Nur ausgewaehlte Farben (${payload.title})`
                  : `Alle Farben anzeigen (${payload.title})`
              }
              onClick={() => togglePickerLayer("colors")}
            >
              {expandedAllColors ? "−" : "+"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {colorRows.map((color) => {
              const checked = selection.colorSelection.has(color);
              const rawPrices = priceByColor.get(color) ?? [];
              const prices = rawPrices.filter((n) => typeof n === "number");
              const avg = prices.length > 0 ? averageCents(prices) : null;
              const label =
                avg != null ? `${color} · ${eurFormatter.format(avg / 100)}` : `${color} · —`;
              return (
                <label
                  key={`${selectionKey}-color-${color}`}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="h-3 w-3 accent-violet-500"
                    aria-label={`${payload.title} Farbe ${color}`}
                    onChange={() => {
                      const isStoredColor = colors.includes(color);
                      if (selection.colorSelection.has(color)) {
                        selection.colorSelection.delete(color);
                        if (selection.colorSelection.size === 0) selection.colorSelection.add(color);
                        forceUpdate();
                        if (context === "integrated") void persistIntegratedVariants(payload);
                      } else {
                        selection.colorSelection.add(color);
                        forceUpdate();
                        if (context === "integrated") {
                          if (isStoredColor) {
                            // Farbe war schon geladen — nur Auswahl persistieren
                            void persistIntegratedVariants(payload);
                          } else {
                            // Neue Farbe aus Katalog — Varianten von Printful nachladen
                            void addColorToProduct(payload, selection);
                          }
                        }
                      }
                    }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Größen
            </p>
            <button
              type="button"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-lg font-light leading-none text-zinc-200 hover:bg-zinc-900"
              aria-expanded={expandedAllSizes}
              aria-label={
                expandedAllSizes
                  ? `Nur ausgewaehlte Groessen (${payload.title})`
                  : `Alle Groessen anzeigen (${payload.title})`
              }
              onClick={() => togglePickerLayer("sizes")}
            >
              {expandedAllSizes ? "−" : "+"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizeRows.map((size) => {
              const checked = selection.sizeSelection.has(size);
              return (
                <label
                  key={`${selectionKey}-size-${size}`}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    className="h-3 w-3 accent-violet-400"
                    aria-label={`${payload.title} Größe ${size}`}
                    onChange={() => {
                      if (selection.sizeSelection.has(size)) selection.sizeSelection.delete(size);
                      else selection.sizeSelection.add(size);
                      if (selection.sizeSelection.size === 0) selection.sizeSelection.add(size);
                      forceUpdate();
                      if (context === "integrated") void persistIntegratedVariants(payload);
                    }}
                  />
                  {size}
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-[11px] text-zinc-400">
          <p className="font-semibold text-zinc-300">Materialien</p>
          <div className="mt-2 flex flex-wrap gap-2 text-zinc-100">
            {uniqueSorted(variants.map((variant) => variant.material).filter(Boolean) as string[]).map((material) => (
              <span key={`${selectionKey}-material-${material}`} className="rounded-full bg-zinc-800 px-3 py-1">
                {material}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderAssetControls(
    payload: CatalogProductPayload,
    selection?: ReturnType<typeof deriveInitialVariantSelection>
  ) {
    const assets = payload.color_assets ?? [];
    if (assets.length === 0) {
      return (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-500">
          Noch keine relationalen Platzierungsbilder gespeichert. Katalog erneut synchronisieren.
        </div>
      );
    }

    const selectedColorSlugs =
      selection && selection.colorSelection.size > 0
        ? [...selection.colorSelection].map(colorSlug)
        : coerceVariants(payload.variants).map((variant) => colorSlug(variant.color)).filter(Boolean);
    const activeColorSlug = selectedColorSlugs[0] ?? colorSlug(firstSelectedColor(payload, selection));
    const activeColorName =
      payload.product_colors?.find((color) => color.color_slug === activeColorSlug)?.color_name ??
      activeColorSlug;
    const roles = ["front", "back", "side"];

    return (
      <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
        <div>
          <p className="font-semibold text-zinc-200">Vorschau-Bilder</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Aktive Farbe: {activeColorName}. Waehle pro Rolle ein statisches Platzierungsbild.
          </p>
        </div>
        {roles.map((role) => {
          const group = assets.filter(
            (asset) => asset.color_slug === activeColorSlug && asset.placement === role
          );
          if (group.length === 0) {
            return (
              <div key={role} className="rounded-xl border border-dashed border-zinc-800 p-3 text-zinc-500">
                {role}: keine Kandidaten
              </div>
            );
          }
          return (
            <div key={role} className="space-y-2 border-t border-zinc-800 pt-3 first:border-t-0 first:pt-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                {activeColorSlug} · {role}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.slice(0, 3).map((asset) => (
                  <div
                    key={asset.id}
                    className={`rounded-xl border p-2 ${
                      asset.is_preferred ? "border-violet-500 bg-violet-950/30" : "border-zinc-800 bg-zinc-900/50"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.image_url}
                      alt={`${activeColorSlug} ${role}`}
                      className="h-24 w-full rounded-lg object-cover"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-500">
                        {asset.source}
                        {asset.mockup_style_id ? ` #${asset.mockup_style_id}` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full text-[11px]"
                        disabled={asset.is_preferred === true}
                        onClick={() => void patchAsset(payload, asset.id, { is_preferred: true })}
                      >
                        {asset.is_preferred ? "Aktiv" : "Nutzen"}
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {([
                        "print_area_left",
                        "print_area_top",
                        "print_area_width",
                        "print_area_height",
                        "template_width",
                        "template_height",
                      ] as const).map((field) => (
                        <input
                          key={field}
                          type="number"
                          className="h-7 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-[10px] text-zinc-200"
                          title={field}
                          aria-label={`${field} ${activeColorSlug} ${role}`}
                          defaultValue={asset[field] ?? ""}
                          onBlur={(event) => {
                            const raw = event.currentTarget.value.trim();
                            void patchAsset(payload, asset.id, {
                              [field]: raw === "" ? null : Number(raw),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppSurface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Produkte</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Printful-Katalogprodukte aktivieren und Reihenfolge fuer die Auswahl pflegen.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void syncCatalog()}
          disabled={syncing}
          className={primaryActionClassName()}
        >
          {syncing ? "Synchronisiere..." : "Katalog synchronisieren"}
        </Button>
      </div>

      <div className="mt-6 space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Printful Produkt suchen
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            className="h-10 min-w-[220px] flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none ring-violet-400/50 focus:ring-2"
            value={searchQuery}
            aria-label="Printful Produkt suchen"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Titel oder ID"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void runCatalogSearch(searchQuery)}
            className={secondaryActionClassName("rounded-full")}
          >
            Suchen
          </Button>
        </div>
      </div>

      {previewResults.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-700/70 bg-zinc-900/40 px-4 py-2.5">
          <p className="text-sm text-zinc-400">
            {previewResults.length} Suchergebnis{previewResults.length === 1 ? "" : "se"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={secondaryActionClassName("rounded-full")}
            onClick={() => dismissPreviewResults()}
          >
            Suchergebnisse schließen
          </Button>
        </div>
      ) : null}

      {notice && <AppNotice className="mt-4">{notice}</AppNotice>}
      {loading && <p className="mt-4 text-sm text-zinc-500">Lade Produkte...</p>}
      {!loading && products.length === 0 && previewResults.length === 0 ? (
        <AppNotice className="mt-4">
          Noch keine Printful-Produkte gespeichert. Starte den Katalog-Sync oder suche einen Artikel aus dem Katalog.
        </AppNotice>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {products.map((product) => {
          const variants = coerceVariants(product.variants);
          const expanded = product.id ? integratedExpandedIds.has(product.id) : false;
          const coverSelection = product.id
            ? expanded
              ? integratedSelectionsRef.current.get(product.id) ??
                integratedPersistedSelectionsRef.current.get(product.id) ??
                deriveInitialVariantSelection(variants)
              : integratedPersistedSelectionsRef.current.get(product.id) ??
                deriveInitialVariantSelection(variants)
            : undefined;
          const transparent = getAdminCoverUrl(product, coverSelection);
          const busy = product.id ? busyIds.has(product.id) : false;
          const printArea = product.print_area;
          const showPrintArea =
            printArea?.area_width &&
            printArea.area_height &&
            typeof printArea.area_width === "number" &&
            typeof printArea.area_height === "number";

          return (
            <article
              key={`integrated-${product.id ?? product.slug ?? product.title}`}
              className="rounded-3xl border border-zinc-700/70 bg-zinc-950/50 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-28 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 sm:w-32">
                  {transparent ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={transparent}
                      alt={`${product.title} Cover`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-zinc-500">
                      Kein Cover
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 id={`product-title-${product.id}`} className="text-base font-semibold text-zinc-100">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Printful #{product.printful_product_id}
                        {product.technique ? ` · ${product.technique}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                        {variants.length} Varianten
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-zinc-400 hover:bg-red-950/50 hover:text-red-300"
                        disabled={busy}
                        aria-label={`${product.title} aus Katalog entfernen`}
                        onClick={() => void deleteProduct(product.id, product.title)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {showPrintArea ? (
                    <p className="mt-2 text-xs text-zinc-400">
                      Druckfläche: {printArea.area_width} x {printArea.area_height} px
                    </p>
                  ) : null}

                  {renderPriceBadges(product, "integrated")}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        checked={product.is_active}
                        disabled={busy}
                        aria-label={`${product.title} ${
                          product.is_active ? "deaktivieren" : "aktivieren"
                        }`}
                        onChange={(event) =>
                          void patchProductLegacy(product.id, {
                            is_active: event.currentTarget.checked,
                          })
                        }
                        className="h-4 w-4 accent-violet-500"
                      />
                      Aktiv
                    </label>

                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      Sortierung
                      <input
                        type="number"
                        defaultValue={product.sort_order ?? ""}
                        disabled={busy}
                        aria-label={`Sortierung fuer ${product.title}`}
                        onChange={(event) => {
                          const value = Number(event.currentTarget.value);
                          void patchProductLegacy(product.id, {
                            sort_order: Number.isFinite(value) ? value : 0,
                          });
                        }}
                        className="h-9 w-24 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none ring-violet-400/40 focus:ring-2"
                      />
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-violet-500/40 bg-violet-950/60 text-[11px] text-violet-100"
                      disabled={busy || product.is_primary}
                      aria-label={`${product.title} als Hauptprodukt nutzen`}
                      onClick={() => void patchProductLegacy(product.id, { is_primary: true })}
                    >
                      Als Hauptprodukt nutzen
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      aria-label={
                        expanded
                          ? `Details für ${product.title} ausblenden`
                          : `Details für ${product.title} anzeigen`
                      }
                      onClick={() => {
                        if (!product.id) return;
                        setIntegratedExpandedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(product.id!)) next.delete(product.id!);
                          else next.add(product.id!);
                          return next;
                        });
                      }}
                    >
                      {expanded ? "Details ausblenden" : "Details anzeigen"}
                    </Button>
                  </div>

                  {expanded ? (
                    <>
                      {renderVariantControls(product, "integrated")}
                      {renderAssetControls(product, coverSelection)}
                    </>
                  ) : null}

                  <p className="mt-3 text-xs text-zinc-600">{product.slug ?? ""}</p>
                </div>
              </div>
            </article>
          );
        })}

        {previewResults.map((preview) => {
          const variants = coerceVariants(preview.variants);
          const selection =
            previewSelectionsRef.current.get(preview.printful_product_id) ??
            deriveInitialVariantSelection(variants);
          previewSelectionsRef.current.set(preview.printful_product_id, selection);
          const transparent = getAdminCoverUrl(preview, selection);
          const printArea = preview.print_area;
          const showPrintArea =
            printArea?.area_width &&
            printArea.area_height &&
            typeof printArea.area_width === "number" &&
            typeof printArea.area_height === "number";
          const expanded = previewExpandedIds.has(preview.printful_product_id);
          return (
            <article
              key={`preview-${preview.printful_product_id}`}
              className="rounded-3xl border border-dashed border-emerald-500/40 bg-emerald-950/10 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="h-28 w-full overflow-hidden rounded-2xl border border-emerald-800/60 bg-zinc-950 sm:w-32">
                  {transparent ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={transparent}
                      alt={`${preview.title} Vorschau`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-emerald-200">
                      Keine Vorschau
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
                        Suchergebnis
                      </p>
                      <h3
                        id={`preview-title-${preview.printful_product_id}`}
                        className="text-base font-semibold text-zinc-50"
                      >
                        {preview.title}
                      </h3>
                      <p className="mt-1 text-xs text-emerald-200/70">
                        Printful #{preview.printful_product_id}
                        {preview.technique ? ` · ${preview.technique}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-950/60 px-3 py-1 text-xs text-emerald-100 ring-1 ring-emerald-500/40">
                      {variants.length} Varianten
                    </span>
                  </div>

                  {showPrintArea ? (
                    <p className="text-xs text-zinc-400">
                      Druckfläche: {printArea.area_width} x {printArea.area_height} px
                    </p>
                  ) : null}

                  {renderPriceBadges({ ...preview, id: "__preview__" }, "preview")}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={
                        expanded
                          ? `Details für ${preview.title} ausblenden`
                          : `Details für ${preview.title} anzeigen`
                      }
                      className="rounded-full border-zinc-600"
                      onClick={() =>
                        setPreviewExpandedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(preview.printful_product_id)) next.delete(preview.printful_product_id);
                          else next.add(preview.printful_product_id);
                          return next;
                        })
                      }
                    >
                      {expanded ? "Details ausblenden" : "Details anzeigen"}
                    </Button>
                    <Button
                      type="button"
                      className={`${primaryActionClassName()} rounded-full`}
                      onClick={() => integratePreview(preview.printful_product_id)}
                    >
                      {`${preview.title} integrieren`}
                    </Button>
                  </div>

                  {expanded ? renderVariantControls({ ...preview, is_active: false, sort_order: null }, "preview") : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => void loadProducts({ resetNotice: false })}
        className={secondaryActionClassName("mt-4")}
      >
        Produkte neu laden
      </Button>
    </AppSurface>
  );
}
