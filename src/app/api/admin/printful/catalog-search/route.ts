import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { catalogVariantPriceMap, type CatalogPriceRow } from "@/lib/printful/catalogVariantPriceMap";
import { getJson } from "@/lib/printful/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PRINTFUL_FRONT_PLACEMENT = "front";
const CATALOG_SEARCH_LIMIT = 100;
const MAX_CATALOG_SEARCH_PAGES = 10;
const VARIANT_PAGE_LIMIT = 100;
const MAX_VARIANT_PAGES = 20;

type PrintfulResponse<T> = {
  data: T;
};

type PrintfulProduct = {
  id: number;
  name?: string | null;
  title?: string | null;
  techniques?: Array<{ key?: string | null; is_default?: boolean | null }> | null;
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

type PrintfulVariantPageResponse = {
  data?: PrintfulVariant[];
  paging?: { total?: number; limit?: number; offset?: number };
};

type PrintfulMockupStyle = {
  placement?: string | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  dpi?: number | null;
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

type PrintfulCatalogListResponse = {
  data?: Array<{ id?: number; name?: string | null; title?: string | null }>;
  paging?: { total?: number; limit?: number; offset?: number };
};

async function requireAdmin() {
  const cookieStore = await cookies();
  if (isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

function preferredTechnique(product: PrintfulProduct) {
  const techniques = product.techniques ?? [];
  return (
    techniques.find((technique) => technique.is_default)?.key ??
    techniques[0]?.key ??
    null
  );
}

function normalizeVariants(
  variants: PrintfulVariant[],
  prices: Map<number, number | null>
) {
  return variants
    .filter((variant) => {
      const color = variant.color?.trim().toLowerCase();
      const size = variant.size?.trim().toUpperCase();
      return Boolean(color && size);
    })
    .map((variant) => ({
      variant_id: variant.id,
      size: variant.size?.trim().toUpperCase() ?? "",
      color: variant.color?.trim() ?? "",
      color_hex: variant.color_code ?? variant.primary_hex_color ?? null,
      price_cents: prices.get(variant.id) ?? null,
      stock: null,
      material: variant.material?.trim() || null,
    }));
}

async function fetchAllVariants(productId: number) {
  const all: PrintfulVariant[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_VARIANT_PAGES; page++) {
    const response = await getJson<PrintfulVariantPageResponse>(
      `/v2/catalog-products/${productId}/catalog-variants?limit=${VARIANT_PAGE_LIMIT}&offset=${offset}`
    );
    const batch = response.data ?? [];
    all.push(...batch);
    const total = response.paging?.total ?? 0;
    if (batch.length < VARIANT_PAGE_LIMIT || (total > 0 && offset + batch.length >= total)) break;
    offset += VARIANT_PAGE_LIMIT;
  }
  return all;
}

function normalizePrintArea(styles: PrintfulMockupStyle[]) {
  const style =
    styles.find((item) => item.placement === "front_large") ??
    styles.find((item) => item.placement === "front") ??
    styles[0];
  const dpi = style?.dpi ?? 1;
  return {
    placement: style?.placement ?? null,
    area_width:
      style?.print_area_width != null ? Math.round(style.print_area_width * dpi) : null,
    area_height:
      style?.print_area_height != null ? Math.round(style.print_area_height * dpi) : null,
  };
}

async function fetchProductImages(productId: number, colors: string[]) {
  try {
    const colorParam = colors.map((color) => color.trim().toLowerCase()).filter(Boolean).join(",");
    const response = await getJson<{ data?: PrintfulProductImage[] }>(
      `/v2/catalog-products/${productId}/images?placement=${PRINTFUL_FRONT_PLACEMENT}&colors=${encodeURIComponent(colorParam || "black,white")}&limit=20`
    );

    return (response.data ?? []).flatMap((variantImage) =>
      (variantImage.images ?? [])
        .filter(
          (image) =>
            image.placement === PRINTFUL_FRONT_PLACEMENT || image.placement === "front_large"
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
  } catch {
    return [];
  }
}

async function fetchPreviewProduct(productId: number) {
  const [productResponse, allVariants, pricesResponse, mockupStylesResponse, templatesResponse] =
    await Promise.all([
      getJson<PrintfulResponse<PrintfulProduct>>(`/v2/catalog-products/${productId}`),
      fetchAllVariants(productId),
      getJson<PrintfulResponse<{ variants?: CatalogPriceRow[] }>>(
        `/v2/catalog-products/${productId}/prices`
      ),
      getJson<PrintfulResponse<PrintfulMockupStyle[]>>(
        `/v2/catalog-products/${productId}/mockup-styles?placements=${PRINTFUL_FRONT_PLACEMENT}&limit=100`
      ),
      getJson<{ data?: unknown[] }>(
        `/v2/catalog-products/${productId}/mockup-templates?placements=${PRINTFUL_FRONT_PLACEMENT}&limit=100`
      ).catch(() => ({ data: [] })),
    ]);

  const product = productResponse.data;
  const technique = preferredTechnique(product);
  const variants = normalizeVariants(
    allVariants,
    catalogVariantPriceMap(pricesResponse.data.variants ?? [], technique)
  );
  const colors = [...new Set(variants.map((variant) => variant.color))];
  const productImages = await fetchProductImages(productId, colors);
  return {
    printful_product_id: product.id,
    title: product.name?.trim() || product.title?.trim() || `Printful ${product.id}`,
    technique,
    placements: product.placements ?? [],
    variants,
    product_images: productImages,
    print_area: normalizePrintArea(mockupStylesResponse.data ?? []),
    mockup_templates: templatesResponse.data ?? [],
  };
}

async function findProductIds(query: string) {
  const asNumber = Number(query);
  if (Number.isInteger(asNumber) && asNumber > 0) return [asNumber];

  const normalizedQuery = query.toLowerCase();
  const matches: number[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_CATALOG_SEARCH_PAGES && matches.length < 5; page++) {
    const response = await getJson<PrintfulCatalogListResponse>(
      `/v2/catalog-products?limit=${CATALOG_SEARCH_LIMIT}&offset=${offset}`
    );
    for (const product of response.data ?? []) {
      const title = (product.name ?? product.title ?? "").toLowerCase();
      if (product.id && title.includes(normalizedQuery)) {
        matches.push(product.id);
        if (matches.length >= 5) break;
      }
    }
    const count = response.data?.length ?? 0;
    const total = response.paging?.total ?? 0;
    if (count < CATALOG_SEARCH_LIMIT || (total > 0 && offset + count >= total)) break;
    offset += CATALOG_SEARCH_LIMIT;
  }
  return matches;
}

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  try {
    const productIds = await findProductIds(query);
    const previews = await Promise.all(productIds.slice(0, 5).map(fetchPreviewProduct));
    return NextResponse.json({ products: previews.filter((product) => product.variants.length > 0) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/admin/printful/catalog-search]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
