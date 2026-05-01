import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { catalogVariantPriceMap, type CatalogPriceRow } from "@/lib/printful/catalogVariantPriceMap";
import { getJson } from "@/lib/printful/client";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEFAULT_PRODUCT_IDS = [71];
const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "2XL", "XXL"]);
const PRINTFUL_FRONT_PLACEMENT = "front";
const PRODUCT_SELECT =
  "id, printful_product_id, title, slug, technique, placements, variants, product_images, print_area, mockup_templates, is_active, is_primary, sort_order, created_at, updated_at";

type PrintfulResponse<T> = {
  data: T;
};

type PrintfulProduct = {
  id: number;
  name?: string | null;
  title?: string | null;
  techniques?: Array<{
    key?: string | null;
    display_name?: string | null;
    is_default?: boolean | null;
  }> | null;
  placements?: unknown[] | null;
};

type PrintfulVariant = {
  id: number;
  size?: string | null;
  color?: string | null;
  color_code?: string | null;
  primary_hex_color?: string | null;
  material?: string | null;
};

type PrintfulAvailability = {
  catalog_variant_id?: number;
  id?: number;
  stock?: unknown;
  status?: unknown;
  availability_status?: unknown;
};

type PrintfulMockupStyle = {
  placement?: string | null;
  technique?: string | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  dpi?: number | null;
  mockup_styles?: unknown[] | null;
};

type PrintfulMockupTemplate = {
  placement?: string | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  [key: string]: unknown;
};

type PrintfulProductImage = {
  catalog_variant_id?: number;
  color?: string | null;
  primary_hex_color?: string | null;
  images?: Array<{
    placement?: string | null;
    image_url?: string | null;
    background_color?: string | null;
    background_image?: string | null;
    mockup_style_id?: number | null;
  }> | null;
};

type NormalizedVariant = {
  variant_id: number;
  size: string;
  color: string;
  color_hex: string | null;
  material: string | null;
  price_cents: number | null;
  stock: unknown;
};

type NormalizedProduct = {
  printful_product_id: number;
  title: string;
  slug: string;
  technique: string | null;
  placements: unknown[];
  variants: NormalizedVariant[];
  print_area: {
    placement: string | null;
    area_width: number | null;
    area_height: number | null;
  };
  product_images: Array<{
    catalog_variant_id: number | null;
    color: string | null;
    color_hex: string | null;
    placement: string | null;
    image_url: string | null;
    background_color: string | null;
    background_image: string | null;
    mockup_style_id: number | null;
  }>;
  mockup_templates: PrintfulMockupTemplate[];
  is_active: boolean;
  is_primary: boolean;
  sort_order: number;
};

type ColorAssetRow = {
  printful_product_id: number;
  color_slug: string;
  placement: string;
  source: "printful";
  mockup_style_id: number | null;
  image_url: string;
  background_color: string | null;
  is_preferred: boolean;
  template_width: number | null;
  template_height: number | null;
  print_area_left: number | null;
  print_area_top: number | null;
  print_area_width: number | null;
  print_area_height: number | null;
  metadata: Record<string, unknown>;
};

const MAX_ASSETS_PER_COLOR_ROLE = 3;

type VariantFilter = {
  colors?: string[];
  sizes?: string[];
};

type ExistingProductAdminState = {
  printful_product_id: number;
  is_active: boolean | null;
  is_primary: boolean | null;
  sort_order: number | null;
  variants?: unknown;
};

function compareSizesForVariantFilter(a: string, b: string) {
  const order = [...ALLOWED_SIZES];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

/** Farben/Größen aus bereits gespeicherten Varianten — gleiche Semantik wie im Admin (Kreuzprodukt der Sets). */
function variantFilterFromStoredVariants(raw: unknown): VariantFilter | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const colors = new Set<string>();
  const sizes = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const colorRaw = typeof item.color === "string" ? item.color.trim() : "";
    const sizeRaw = typeof item.size === "string" ? item.size.trim().toUpperCase() : "";
    if (colorRaw) colors.add(colorRaw);
    if (sizeRaw) sizes.add(sizeRaw);
  }
  if (colors.size === 0 && sizes.size === 0) return undefined;
  const out: VariantFilter = {};
  if (colors.size > 0) out.colors = [...colors].sort((a, b) => a.localeCompare(b));
  if (sizes.size > 0) out.sizes = [...sizes].sort(compareSizesForVariantFilter);
  return out;
}

function isExplicitRequestFilter(filter: VariantFilter | undefined): boolean {
  if (!filter) return false;
  const hasColors = Array.isArray(filter.colors) && filter.colors.length > 0;
  const hasSizes = Array.isArray(filter.sizes) && filter.sizes.length > 0;
  return hasColors || hasSizes;
}

function effectiveVariantFilterForSync(
  requestFilter: VariantFilter | undefined,
  existing: ExistingProductAdminState | undefined
): VariantFilter | undefined {
  if (isExplicitRequestFilter(requestFilter)) return requestFilter;
  return variantFilterFromStoredVariants(existing?.variants);
}

function userFacingProductSchemaError(message: string) {
  if (message.includes("'product_images' column") || message.includes("product_images")) {
    return "Die Datenbank kennt die Spalte product_images noch nicht. Bitte die Migration supabase/migrations/013_printful_product_images.sql auf die aktive Supabase-Datenbank anwenden und den Schema-Cache aktualisieren.";
  }
  return message;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  if (isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function colorSlug(value: string | null | undefined) {
  return slugify(value?.trim() || "unknown");
}

function preferredTechnique(product: PrintfulProduct) {
  const techniques = product.techniques ?? [];
  return (
    techniques.find((technique) => technique.is_default)?.key ??
    techniques[0]?.key ??
    null
  );
}

function availabilityMap(availability: PrintfulAvailability[]) {
  return new Map(
    availability.map((item) => [
      item.catalog_variant_id ?? item.id,
      item.stock ?? item.availability_status ?? item.status ?? null,
    ])
  );
}

function normalizeVariants(
  variants: PrintfulVariant[],
  prices: Map<number, number | null>,
  availability: Map<number | undefined, unknown>,
  filter?: VariantFilter
): NormalizedVariant[] {
  const allowedColors =
    filter?.colors && filter.colors.length > 0
      ? new Set(filter.colors.map((color) => color.trim().toLowerCase()))
      : null;
  const allowedSizes =
    filter?.sizes && filter.sizes.length > 0
      ? new Set(filter.sizes.map((size) => size.trim().toUpperCase()))
      : null;
  return variants
    .filter((variant) => {
      const color = variant.color?.trim().toLowerCase();
      const size = variant.size?.trim().toUpperCase();
      return Boolean(
        color &&
          size &&
          (allowedColors ? allowedColors.has(color) : true) &&
          (allowedSizes ? allowedSizes.has(size) : true)
      );
    })
    .map((variant) => ({
      variant_id: variant.id,
      size: variant.size?.trim().toUpperCase() ?? "",
      color: variant.color?.trim() ?? "",
      color_hex: variant.color_code ?? variant.primary_hex_color ?? null,
      material: variant.material?.trim() || null,
      price_cents: prices.get(variant.id) ?? null,
      stock: availability.get(variant.id) ?? null,
    }))
    .sort((a, b) => {
      const colorCompare = a.color.localeCompare(b.color);
      if (colorCompare !== 0) return colorCompare;
      return [...ALLOWED_SIZES].indexOf(a.size) - [...ALLOWED_SIZES].indexOf(b.size);
    });
}

function normalizePrintArea(styles: PrintfulMockupStyle[]) {
  const style = styles.find((item) => item.placement === "front_large") ?? styles.find((item) => item.placement === "front") ?? styles[0];
  const dpi = style?.dpi ?? 1;
  return {
    placement: style?.placement ?? null,
    area_width:
      style?.print_area_width != null ? Math.round(style.print_area_width * dpi) : null,
    area_height:
      style?.print_area_height != null
        ? Math.round(style.print_area_height * dpi)
        : null,
  };
}

async function readSyncRequest(request: Request) {
  if (!request.body) return { productIds: DEFAULT_PRODUCT_IDS, variantFilters: {} };

  try {
    const body = (await request.json()) as {
      productIds?: unknown;
      product_ids?: unknown;
      variantFilters?: unknown;
      variant_filters?: unknown;
    };
    const rawIds = Array.isArray(body.productIds)
      ? body.productIds
      : Array.isArray(body.product_ids)
        ? body.product_ids
        : DEFAULT_PRODUCT_IDS;
    const ids = rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const rawFilters = body.variantFilters ?? body.variant_filters;
    const variantFilters =
      rawFilters && typeof rawFilters === "object" && !Array.isArray(rawFilters)
        ? (rawFilters as Record<string, VariantFilter>)
        : {};
    return { productIds: ids.length > 0 ? ids : DEFAULT_PRODUCT_IDS, variantFilters };
  } catch {
    return { productIds: DEFAULT_PRODUCT_IDS, variantFilters: {} };
  }
}

async function fetchAllVariants(productId: number): Promise<PrintfulVariant[]> {
  const all: PrintfulVariant[] = [];
  const limit = 100;
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const response = await getJson<PrintfulResponse<PrintfulVariant[]>>(
      `/v2/catalog-products/${productId}/catalog-variants?limit=${limit}&offset=${offset}`
    );
    const batch = response.data ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

async function fetchProductImages(productId: number, filter?: VariantFilter) {
  try {
    // Lowercase color names — Printful API expects lowercase (e.g. "black", not "Black").
    // No placement filter — products differ: some use "front", others "front_large".
    // The API only accepts one placement at a time, so we skip the param and filter client-side.
    const colors =
      filter?.colors && filter.colors.length > 0
        ? filter.colors.map((color) => color.trim().toLowerCase()).filter(Boolean)
        : ["black", "white"];

    const response = await getJson<{
      data?: PrintfulProductImage[];
    }>(
      `/v2/catalog-products/${productId}/images?colors=${colors.join(",")}&limit=20`
    );

    const images = (response.data ?? []).flatMap((variantImage) =>
      (variantImage.images ?? [])
        .filter((image) =>
          ["front", "front_large", "back", "back_large"].includes(image.placement ?? "")
        )
        .map((image) => ({
          catalog_variant_id: variantImage.catalog_variant_id ?? null,
          color: variantImage.color ?? null,
          color_hex: variantImage.primary_hex_color ?? null,
          placement: image.placement ?? null,
          image_url: image.image_url?.trim() || null,
          background_color: image.background_color?.trim() || null,
          background_image: image.background_image?.trim() || null,
          mockup_style_id: image.mockup_style_id ?? null,
        }))
    );

    const byKey = new Map<string, (typeof images)[number]>();
    for (const image of images) {
      const key = [
        image.color?.trim().toLowerCase() ?? "",
        image.placement ?? "",
        image.mockup_style_id ?? "",
        image.image_url ?? "",
        image.background_image ?? "",
      ].join("|");
      if (!byKey.has(key)) byKey.set(key, image);
    }
    return [...byKey.values()];
  } catch {
    return [];
  }
}

function uniqueProductColors(product: NormalizedProduct) {
  const bySlug = new Map<string, {
    printful_product_id: number;
    color_name: string;
    color_slug: string;
    color_hex: string | null;
    is_active: boolean;
  }>();
  for (const variant of product.variants) {
    const slug = colorSlug(variant.color);
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        printful_product_id: product.printful_product_id,
        color_name: variant.color,
        color_slug: slug,
        color_hex: variant.color_hex,
        is_active: true,
      });
    }
  }
  return [...bySlug.values()];
}

function scoreAsset(asset: ColorAssetRow) {
  const url = asset.image_url.toLowerCase();
  let score = 0;
  if (asset.placement === "front" || asset.placement === "front_large") score += 100;
  if (url.includes("/flat/")) score += 90;
  if (url.includes("/flat/new/")) score += 25;
  if (url.includes("/front/")) score += 20;
  if (url.includes("/back/")) score += 20;
  if (url.includes("zoomed")) score -= 15;
  if (url.includes("onboy_2") || url.includes("ongirl_3")) score += 10;
  if (url.includes("onboy") || url.includes("ongirl")) score -= 10;
  if (url.includes("frontleft") || url.includes("frontright")) score -= 35;
  if (url.includes("christmas") || url.includes("holiday")) score -= 80;
  if (url.includes("woodenbg") || url.includes("lightbg")) score -= 40;
  return score;
}

function assetViewRoleFromUrl(imageUrl: string, placement: string | null | undefined) {
  const url = imageUrl.toLowerCase();
  if (
    url.includes("frontleft") ||
    url.includes("frontright") ||
    url.includes("leftfront") ||
    url.includes("rightfront") ||
    url.includes("/left/") ||
    url.includes("/right/")
  ) {
    return "side";
  }
  if (url.includes("/back/") || placement === "back" || placement === "back_large") return "back";
  return "front";
}

function placementForViewRole(role: string) {
  if (role === "back") return "back";
  if (role === "side") return "side";
  return "front";
}

function productAssets(product: NormalizedProduct): ColorAssetRow[] {
  const allowedColors = new Set(product.variants.map((variant) => colorSlug(variant.color)));
  return product.product_images
    .filter((image) => {
      const slug = colorSlug(image.color);
      return allowedColors.has(slug) && image.image_url;
    })
    .map((image) => {
      const imageUrl = image.background_image || image.image_url!;
      const viewRole = assetViewRoleFromUrl(imageUrl, image.placement);
      return {
        printful_product_id: product.printful_product_id,
        color_slug: colorSlug(image.color),
        placement: placementForViewRole(viewRole),
        source: "printful" as const,
        mockup_style_id: image.mockup_style_id,
        image_url: imageUrl,
        background_color: image.background_color,
        is_preferred: false,
        template_width: null,
        template_height: null,
        print_area_left: null,
        print_area_top: null,
        print_area_width: product.print_area.area_width,
        print_area_height: product.print_area.area_height,
        metadata: {
          view_role: viewRole,
          catalog_variant_id: image.catalog_variant_id,
          color: image.color,
          color_hex: image.color_hex,
          original_placement: image.placement,
          image_url: image.image_url,
          background_image: image.background_image,
        },
      };
    });
}

function assetKey(asset: Pick<ColorAssetRow, "printful_product_id" | "color_slug" | "placement" | "source" | "image_url">) {
  return [
    asset.printful_product_id,
    asset.color_slug,
    asset.placement,
    asset.source,
    asset.image_url,
  ].join("|");
}

function preserveExistingAssetState(
  asset: ColorAssetRow,
  existing: Record<string, unknown> | undefined
): ColorAssetRow {
  if (!existing) return asset;
  const numericFields = [
    "template_width",
    "template_height",
    "print_area_left",
    "print_area_top",
    "print_area_width",
    "print_area_height",
  ] as const;
  const next: ColorAssetRow = {
    ...asset,
    is_preferred:
      typeof existing.is_preferred === "boolean" ? existing.is_preferred : asset.is_preferred,
  };
  for (const field of numericFields) {
    if (typeof existing[field] === "number") {
      next[field] = Math.trunc(existing[field] as number);
    }
  }
  return next;
}

function dedupeAssets(assets: ColorAssetRow[]) {
  const byKey = new Map<string, ColorAssetRow>();
  for (const asset of assets) {
    const key = assetKey(asset);
    const existing = byKey.get(key);
    if (!existing || scoreAsset(asset) > scoreAsset(existing)) {
      byKey.set(key, asset);
    }
  }
  return [...byKey.values()];
}

function limitAssetsForAdmin(assets: ColorAssetRow[]) {
  const groups = new Map<string, ColorAssetRow[]>();
  for (const asset of assets) {
    const key = `${asset.printful_product_id}:${asset.color_slug}:${asset.placement}`;
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }
  return [...groups.values()].flatMap((group) =>
    [...group]
      .sort((a, b) => scoreAsset(b) - scoreAsset(a))
      .slice(0, MAX_ASSETS_PER_COLOR_ROLE)
  );
}

async function cleanupStalePrintfulAssets(productIds: number[], keptAssets: ColorAssetRow[]) {
  if (productIds.length === 0) return;
  const kept = new Set(keptAssets.map(assetKey));
  const { data, error } = await supabaseAdmin
    .from("printful_product_color_assets")
    .select("id, printful_product_id, color_slug, placement, source, image_url")
    .in("printful_product_id", productIds)
    .eq("source", "printful");
  if (error) throw new Error(error.message);

  const staleIds = ((data ?? []) as Array<Record<string, unknown>>)
    .filter((asset) => {
      const placement = String(asset.placement);
      if (!["front", "back", "side"].includes(placement)) return true;
      const key = assetKey({
        printful_product_id: Number(asset.printful_product_id),
        color_slug: String(asset.color_slug),
        placement,
        source: "printful",
        image_url: String(asset.image_url),
      });
      return !kept.has(key);
    })
    .map((asset) => String(asset.id))
    .filter(Boolean);

  if (staleIds.length === 0) return;
  for (let i = 0; i < staleIds.length; i += 50) {
    const batch = staleIds.slice(i, i + 50);
    const { error: deleteError } = await supabaseAdmin
      .from("printful_product_color_assets")
      .delete()
      .in("id", batch);
    if (deleteError) throw new Error(deleteError.message);
  }
}

async function syncProductColorsAndAssets(products: NormalizedProduct[]) {
  const colors = products.flatMap(uniqueProductColors);
  if (colors.length > 0) {
    const { error } = await supabaseAdmin
      .from("printful_product_colors")
      .upsert(colors, { onConflict: "printful_product_id,color_slug" });
    if (error) throw new Error(error.message);
  }

  const assets = limitAssetsForAdmin(dedupeAssets(products.flatMap(productAssets)));
  if (assets.length === 0) return;

  const productIds = [...new Set(assets.map((asset) => asset.printful_product_id))];
  const { data: existingAssets, error: existingAssetsError } = await supabaseAdmin
    .from("printful_product_color_assets")
    .select("*")
    .in("printful_product_id", productIds)
    .eq("source", "printful");
  if (existingAssetsError) throw new Error(existingAssetsError.message);

  const existingByKey = new Map(
    ((existingAssets ?? []) as Record<string, unknown>[]).map((asset) => [
      assetKey({
        printful_product_id: Number(asset.printful_product_id),
        color_slug: String(asset.color_slug),
        placement: String(asset.placement),
        source: "printful",
        image_url: String(asset.image_url),
      }),
      asset,
    ])
  );
  const assetsToUpsert = assets.map((asset) =>
    preserveExistingAssetState(asset, existingByKey.get(assetKey(asset)))
  );

  const { error: assetError } = await supabaseAdmin
    .from("printful_product_color_assets")
    .upsert(assetsToUpsert, {
      onConflict: "printful_product_id,color_slug,placement,source,image_url",
    });
  if (assetError) throw new Error(assetError.message);

  await cleanupStalePrintfulAssets(productIds, assetsToUpsert);

  const groups = new Map<string, ColorAssetRow[]>();
  for (const asset of assets) {
    const key = `${asset.printful_product_id}:${asset.color_slug}:${asset.placement}`;
    const list = groups.get(key) ?? [];
    list.push(asset);
    groups.set(key, list);
  }

  for (const [key, candidates] of groups) {
    const [productIdRaw, color, placement] = key.split(":");
    const productId = Number(productIdRaw);
    const { data: existingPreferred, error: preferredError } = await supabaseAdmin
      .from("printful_product_color_assets")
      .select("id")
      .eq("printful_product_id", productId)
      .eq("color_slug", color)
      .eq("placement", placement)
      .eq("is_preferred", true)
      .limit(1);
    if (preferredError) throw new Error(preferredError.message);
    if ((existingPreferred ?? []).length > 0) continue;

    const preferred = [...candidates].sort((a, b) => scoreAsset(b) - scoreAsset(a))[0];
    if (!preferred) continue;
    const { error: resetError } = await supabaseAdmin
      .from("printful_product_color_assets")
      .update({ is_preferred: false })
      .eq("printful_product_id", productId)
      .eq("color_slug", color)
      .eq("placement", placement);
    if (resetError) throw new Error(resetError.message);

    const { error: setError } = await supabaseAdmin
      .from("printful_product_color_assets")
      .update({ is_preferred: true })
      .eq("printful_product_id", productId)
      .eq("color_slug", color)
      .eq("placement", placement)
      .eq("source", preferred.source)
      .eq("image_url", preferred.image_url);
    if (setError) throw new Error(setError.message);
  }
}

// ---- v1 API types — two response formats ----

// Old format: result is a flat array, one entry per variant
type V1TemplateResultFlat = {
  variant_id?: number | string;
  placement?: string | null;
  background_url?: string | null;
  background_color?: string | null;
  image_url?: string | null;
  template_width?: number | null;
  template_height?: number | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_top?: number | null;
  print_area_left?: number | null;
};

// New format (version 100): result is an object with templates[] + variant_mapping[]
type V1TemplateV100 = {
  template_id: number;
  background_url?: string | null;
  image_url?: string | null;
  placement?: string | null;
  template_width?: number | null;
  template_height?: number | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_top?: number | null;
  print_area_left?: number | null;
};

type V1VariantMappingEntry = {
  variant_id: number;
  templates: Array<{ placement: string; template_id: number }>;
};

type V1ResultV100 = {
  version: number;
  templates: V1TemplateV100[];
  variant_mapping: V1VariantMappingEntry[];
};

type V1TemplatesResponse = {
  result?: V1TemplateResultFlat[] | V1ResultV100;
};

function buildTemplateMap(byUrl: Map<string, PrintfulMockupTemplate>, url: string, entry: {
  placement?: string | null;
  background_color?: string | null;
  template_width?: number | null;
  template_height?: number | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_top?: number | null;
  print_area_left?: number | null;
}) {
  if (!byUrl.has(url)) {
    byUrl.set(url, {
      placement: entry.placement ?? "front_large",
      background_url: url,
      background_color: entry.background_color?.trim() || null,
      template_width: entry.template_width ?? null,
      template_height: entry.template_height ?? null,
      print_area_width: entry.print_area_width ?? null,
      print_area_height: entry.print_area_height ?? null,
      print_area_top: entry.print_area_top ?? null,
      print_area_left: entry.print_area_left ?? null,
      catalog_variant_ids: [],
    });
  }
}

async function fetchMockupTemplates(productId: number): Promise<PrintfulMockupTemplate[]> {
  // The v1 API provides catalog_variant_ids (old format) or variant_mapping (v100 format),
  // both of which let us link shirt photos to specific colors for color-reactive previews.
  try {
    const v1Response = await getJson<V1TemplatesResponse>(
      `/mockup-generator/templates/${productId}`
    );
    const result = v1Response.result;
    if (!result) return [];

    const byUrl = new Map<string, PrintfulMockupTemplate>();

    // ---- Format: version 100 (result is object with templates[] + variant_mapping[]) ----
    if (!Array.isArray(result) && typeof result === "object" && "templates" in result) {
      const v100 = result as V1ResultV100;

      // Index template_id → template metadata (for background_url + dimensions)
      const templateById = new Map<number, V1TemplateV100>();
      for (const t of v100.templates ?? []) {
        if (t.template_id != null) templateById.set(t.template_id, t);
      }

      // Walk variant_mapping: for each variant, find its front/front_large template
      for (const mapping of v100.variant_mapping ?? []) {
        for (const tmpl of mapping.templates ?? []) {
          if (tmpl.placement !== "front" && tmpl.placement !== "front_large") continue;
          const tData = templateById.get(tmpl.template_id);
          if (!tData) continue;
          const url = tData.background_url ?? tData.image_url;
          if (!url) continue;
          buildTemplateMap(byUrl, url, { ...tData, placement: tmpl.placement });
          const ids = (byUrl.get(url)!.catalog_variant_ids as number[]);
          if (!ids.includes(mapping.variant_id)) ids.push(mapping.variant_id);
        }
      }

      if (byUrl.size > 0) return [...byUrl.values()];
    }

    // ---- Format: flat array (result is V1TemplateResultFlat[]) ----
    if (Array.isArray(result)) {
      for (const entry of result as V1TemplateResultFlat[]) {
        const url = entry.background_url ?? entry.image_url;
        if (!url) continue;
        buildTemplateMap(byUrl, url, entry);
        const ids = (byUrl.get(url)!.catalog_variant_ids as number[]);
        const rawId = entry.variant_id;
        const variantId =
          typeof rawId === "number"
            ? rawId
            : typeof rawId === "string"
              ? parseInt(rawId, 10)
              : null;
        if (variantId != null && !isNaN(variantId) && !ids.includes(variantId)) {
          ids.push(variantId);
        }
      }
      if (byUrl.size > 0) return [...byUrl.values()];
    }
  } catch {
    // fall through
  }
  return [];
}

function filterMockupTemplatesForVariants(
  templates: PrintfulMockupTemplate[],
  variants: NormalizedVariant[]
) {
  const selectedVariantIds = new Set(variants.map((variant) => variant.variant_id));
  if (selectedVariantIds.size === 0) return [];

  return templates
    .map((template) => {
      const ids = Array.isArray(template.catalog_variant_ids)
        ? (template.catalog_variant_ids as number[]).filter((id) => selectedVariantIds.has(id))
        : [];
      if (ids.length === 0) return null;
      return {
        ...template,
        catalog_variant_ids: ids,
      };
    })
    .filter((template): template is PrintfulMockupTemplate => template != null);
}

async function fetchCatalogProduct(productId: number, sortOrder: number, filter?: VariantFilter) {
  const [
    productResponse,
    allVariants,
    pricesResponse,
    availabilityResponse,
    productImages,
    mockupStylesResponse,
    mockupTemplates,
  ] = await Promise.all([
    getJson<PrintfulResponse<PrintfulProduct>>(`/v2/catalog-products/${productId}`),
    fetchAllVariants(productId),
    getJson<PrintfulResponse<{ variants?: CatalogPriceRow[] }>>(
      `/v2/catalog-products/${productId}/prices`
    ),
    getJson<PrintfulResponse<PrintfulAvailability[]>>(
      `/v2/catalog-products/${productId}/availability`
    ),
    fetchProductImages(productId, filter),
    getJson<PrintfulResponse<PrintfulMockupStyle[]>>(
      `/v2/catalog-products/${productId}/mockup-styles?placements=${PRINTFUL_FRONT_PLACEMENT}&limit=100`
    ),
    fetchMockupTemplates(productId),
  ]);

  const product = productResponse.data;
  const title = product.name?.trim() || product.title?.trim() || `Printful ${product.id}`;
  const technique = preferredTechnique(product);
  const variants = normalizeVariants(
    allVariants,
    catalogVariantPriceMap(pricesResponse.data.variants ?? [], technique),
    availabilityMap(availabilityResponse.data ?? []),
    filter
  );

  return {
    printful_product_id: product.id,
    title,
    slug: slugify(title),
    technique,
    placements: product.placements ?? [],
    variants,
    print_area: normalizePrintArea(mockupStylesResponse.data ?? []),
    product_images: productImages,
    mockup_templates: filterMockupTemplatesForVariants(mockupTemplates, variants),
    is_active: false,
    is_primary: false,
    sort_order: sortOrder,
  } satisfies NormalizedProduct;
}

async function existingAdminState(productIds: number[]) {
  const { data, error } = await supabaseAdmin
    .from("printful_products")
    .select("printful_product_id, is_active, is_primary, sort_order, variants")
    .in("printful_product_id", productIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map(
    ((data ?? []) as ExistingProductAdminState[]).map((product) => [
      product.printful_product_id,
      product,
    ])
  );
}

function preserveAdminState(
  product: NormalizedProduct,
  existing: ExistingProductAdminState | undefined
) {
  if (!existing) return product;
  return {
    ...product,
    is_active: existing.is_active ?? product.is_active,
    is_primary: existing.is_primary ?? product.is_primary,
    sort_order: existing.sort_order ?? product.sort_order,
  };
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { productIds, variantFilters } = await readSyncRequest(request);
    const existingByPrintfulId = await existingAdminState(productIds);
    const fetchedProducts = await Promise.all(
      productIds.map((productId, index) => {
        const existing = existingByPrintfulId.get(productId);
        const requestFilter = variantFilters[String(productId)];
        const filter = effectiveVariantFilterForSync(requestFilter, existing);
        return fetchCatalogProduct(productId, index, filter);
      })
    );
    const products = fetchedProducts.map((product) =>
      preserveAdminState(product, existingByPrintfulId.get(product.printful_product_id))
    );

    const { data, error } = await supabaseAdmin
      .from("printful_products")
      .upsert(products, { onConflict: "printful_product_id" })
      .select(PRODUCT_SELECT);

    if (error) {
      return NextResponse.json(
        { error: userFacingProductSchemaError(error.message) },
        { status: 500 }
      );
    }
    await syncProductColorsAndAssets(products);

    return NextResponse.json({ synced: products.length, products: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/admin/printful/sync-catalog]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
