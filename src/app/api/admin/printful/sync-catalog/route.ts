import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { getJson } from "@/lib/printful/client";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEFAULT_PRODUCT_IDS = [71];
const ALLOWED_COLORS = new Set(["black", "white"]);
const ALLOWED_SIZES = new Set(["XS", "S", "M", "L", "XL", "2XL", "XXL"]);
const PRINTFUL_FRONT_PLACEMENT = "front";

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
};

type PrintfulPrice = {
  id?: number;
  catalog_variant_id?: number;
  techniques?: Array<{
    technique_key?: string | null;
    price?: string | number | null;
    discounted_price?: string | number | null;
  }> | null;
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

type NormalizedVariant = {
  variant_id: number;
  size: string;
  color: string;
  color_hex: string | null;
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
  mockup_templates: PrintfulMockupTemplate[];
  is_active: boolean;
  sort_order: number;
};

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

function centsFromPrice(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function preferredTechnique(product: PrintfulProduct) {
  const techniques = product.techniques ?? [];
  return (
    techniques.find((technique) => technique.is_default)?.key ??
    techniques[0]?.key ??
    null
  );
}

function priceMap(prices: PrintfulPrice[], technique: string | null) {
  return new Map(
    prices.map((price) => {
      const techniquePrice =
        price.techniques?.find((item) => item.technique_key === technique) ??
        price.techniques?.[0];
      return [
        price.id ?? price.catalog_variant_id,
        centsFromPrice(techniquePrice?.discounted_price ?? techniquePrice?.price),
      ];
    })
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
  prices: Map<number | undefined, number | null>,
  availability: Map<number | undefined, unknown>
): NormalizedVariant[] {
  return variants
    .filter((variant) => {
      const color = variant.color?.trim().toLowerCase();
      const size = variant.size?.trim().toUpperCase();
      return Boolean(color && size && ALLOWED_COLORS.has(color) && ALLOWED_SIZES.has(size));
    })
    .map((variant) => ({
      variant_id: variant.id,
      size: variant.size?.trim().toUpperCase() ?? "",
      color: variant.color?.trim() ?? "",
      color_hex: variant.color_code ?? variant.primary_hex_color ?? null,
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

async function readProductIds(request: Request) {
  if (!request.body) return DEFAULT_PRODUCT_IDS;

  try {
    const body = (await request.json()) as {
      productIds?: unknown;
      product_ids?: unknown;
    };
    const rawIds = Array.isArray(body.productIds)
      ? body.productIds
      : Array.isArray(body.product_ids)
        ? body.product_ids
        : DEFAULT_PRODUCT_IDS;
    const ids = rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return ids.length > 0 ? ids : DEFAULT_PRODUCT_IDS;
  } catch {
    return DEFAULT_PRODUCT_IDS;
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

type V1TemplateResult = {
  variant_id?: number;
  placement?: string | null;
  background_url?: string | null;
  image_url?: string | null;
  template_width?: number | null;
  template_height?: number | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_top?: number | null;
  print_area_left?: number | null;
};

type V1TemplatesResponse = {
  result?: V1TemplateResult[];
};

type V2TemplatesPageResponse = {
  data?: PrintfulMockupTemplate[];
  paging?: { total?: number; limit?: number; offset?: number };
};

async function fetchMockupTemplates(productId: number): Promise<PrintfulMockupTemplate[]> {
  const LIMIT = 100;
  const MAX_PAGES = 25; // safety cap - 25 x 100 = 2500 max items scanned

  try {
    const found: PrintfulMockupTemplate[] = [];
    let offset = 0;
    let totalScanned = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const offsetParam = offset > 0 ? `&offset=${offset}` : "";
      const response = await getJson<V2TemplatesPageResponse>(
        `/v2/catalog-products/${productId}/mockup-templates?placements=${PRINTFUL_FRONT_PLACEMENT}&limit=${LIMIT}${offsetParam}`
      );
      const batch = (response.data ?? []) as PrintfulMockupTemplate[];
      totalScanned += batch.length;

      for (const t of batch) {
        if (t.placement === PRINTFUL_FRONT_PLACEMENT || t.placement === "front_large") {
          found.push(t);
        }
      }

      // Stop if we've seen all items or already collected plenty
      const total = response.paging?.total ?? 0;
      if (batch.length < LIMIT || totalScanned >= total || found.length >= 200) break;
      offset += LIMIT;
    }

    if (found.length > 0) return found;
  } catch {
    // fall through to v1
  }

  // Fallback: v1 mockup-generator/templates – groups individual variant entries into
  // per-image template objects with catalog_variant_ids arrays.
  try {
    const v1Response = await getJson<V1TemplatesResponse>(
      `/mockup-generator/templates/${productId}`
    );
    const results = v1Response.result ?? [];
    // Group by background_url so each unique shirt image becomes one template entry
    const byUrl = new Map<string, PrintfulMockupTemplate>();
    for (const entry of results) {
      const url = entry.background_url ?? entry.image_url;
      if (!url) continue;
      if (!byUrl.has(url)) {
        byUrl.set(url, {
          placement: entry.placement ?? "front_large",
          background_url: url,
          template_width: entry.template_width ?? null,
          template_height: entry.template_height ?? null,
          print_area_width: entry.print_area_width ?? null,
          print_area_height: entry.print_area_height ?? null,
          print_area_top: entry.print_area_top ?? null,
          print_area_left: entry.print_area_left ?? null,
          catalog_variant_ids: [],
        });
      }
      const template = byUrl.get(url)!;
      const ids = template.catalog_variant_ids as number[];
      if (typeof entry.variant_id === "number" && !ids.includes(entry.variant_id)) {
        ids.push(entry.variant_id);
      }
    }
    return [...byUrl.values()];
  } catch {
    return [];
  }
}

async function fetchCatalogProduct(productId: number, sortOrder: number) {
  const [
    productResponse,
    allVariants,
    pricesResponse,
    availabilityResponse,
    mockupStylesResponse,
    mockupTemplates,
  ] = await Promise.all([
    getJson<PrintfulResponse<PrintfulProduct>>(`/v2/catalog-products/${productId}`),
    fetchAllVariants(productId),
    getJson<PrintfulResponse<{ variants?: PrintfulPrice[] }>>(
      `/v2/catalog-products/${productId}/prices`
    ),
    getJson<PrintfulResponse<PrintfulAvailability[]>>(
      `/v2/catalog-products/${productId}/availability`
    ),
    getJson<PrintfulResponse<PrintfulMockupStyle[]>>(
      `/v2/catalog-products/${productId}/mockup-styles?placements=${PRINTFUL_FRONT_PLACEMENT}&limit=100`
    ),
    fetchMockupTemplates(productId),
  ]);

  const product = productResponse.data;
  const title = product.name?.trim() || product.title?.trim() || `Printful ${product.id}`;
  const technique = preferredTechnique(product);

  return {
    printful_product_id: product.id,
    title,
    slug: slugify(title),
    technique,
    placements: product.placements ?? [],
    variants: normalizeVariants(
      allVariants,
      priceMap(pricesResponse.data.variants ?? [], technique),
      availabilityMap(availabilityResponse.data ?? [])
    ),
    print_area: normalizePrintArea(mockupStylesResponse.data ?? []),
    mockup_templates: mockupTemplates,
    is_active: false,
    sort_order: sortOrder,
  } satisfies NormalizedProduct;
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const productIds = await readProductIds(request);
    const products = await Promise.all(
      productIds.map((productId, index) => fetchCatalogProduct(productId, index))
    );

    const { error } = await supabaseAdmin
      .from("printful_products")
      .upsert(products, { onConflict: "printful_product_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ synced: products.length, products });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/admin/printful/sync-catalog]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
