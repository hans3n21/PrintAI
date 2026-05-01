import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { getJson } from "@/lib/printful/client";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  }

  const body = (await request.json()) as { mode?: string; productId?: number };
  const productId = body.productId ?? 71;

  if (body.mode === "db") {
    const { data, error } = await supabaseAdmin
      .from("printful_products")
      .select("printful_product_id, variants, product_images, mockup_templates")
      .eq("printful_product_id", productId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const variants = (data?.variants ?? []) as Array<{ variant_id: number; color: string }>;
    const imgs = (data?.product_images ?? []) as Array<{ color: string | null; image_url: string | null; background_image: string | null; placement: string | null }>;
    const templates = (data?.mockup_templates ?? []) as Array<{ placement: string | null; catalog_variant_ids?: number[]; background_url?: string | null }>;
    return NextResponse.json({
      variantCount: variants.length,
      variantColors: [...new Set(variants.map(v => v.color))],
      productImagesCount: imgs.length,
      templateCount: templates.length,
      templateSample: templates.slice(0, 3).map(t => ({
        placement: t.placement,
        hasBgUrl: !!t.background_url,
        catalogVariantIdsCount: t.catalog_variant_ids?.length ?? 0,
        firstVariantId: t.catalog_variant_ids?.[0] ?? null,
      })),
      variantIdsSample: variants.slice(0, 4).map(v => ({ id: v.variant_id, color: v.color })),
    });
  }

  if (body.mode === "v1templates") {
    try {
      const raw = await getJson<unknown>(`/mockup-generator/templates/${productId}`);
      const topKeys = Object.keys(raw as Record<string, unknown>);
      const result = (raw as Record<string, unknown>).result;
      const resultType = Array.isArray(result) ? "array" : typeof result;
      const resultLength = Array.isArray(result) ? result.length : null;
      // show first entry if array
      const firstEntry = Array.isArray(result) && result.length > 0 ? result[0] : result;
      return NextResponse.json({ topKeys, resultType, resultLength, firstEntry });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // default: v2 images API
  const url = `/v2/catalog-products/${productId}/images?colors=black,white&limit=3`;
  try {
    const raw = await getJson<{ data?: unknown[] }>(url);
    const data = raw?.data ?? [];
    return NextResponse.json({ url, totalItems: data.length });
  } catch (err) {
    return NextResponse.json({ url, error: String(err) }, { status: 500 });
  }
}
