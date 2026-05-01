import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PRODUCT_SELECT =
  "id, printful_product_id, title, slug, technique, placements, variants, product_images, print_area, mockup_templates, is_active, is_primary, sort_order, shop_unit_price_cents, created_at, updated_at";

function postgresHint(error: { message?: string } | null | undefined): string | undefined {
  const message = typeof error?.message === "string" ? error.message : "";
  if (message.includes("shop_unit_price_cents")) {
    return "Spalte shop_unit_price_cents fehlt – Migration supabase/migrations/016_shop_unit_price.sql auf die verbundene Supabase-Datenbank anwenden, danach Schema-Cache neu laden (falls angeboten).";
  }
  if (message.includes("product_images") || message.includes("'product_images'")) {
    return "Spalte product_images fehlt – Migration supabase/migrations/013_printful_product_images.sql anwenden.";
  }
  if (message.includes("is_primary")) {
    return "Spalte is_primary fehlt – Migration supabase/migrations/014_printful_primary_product.sql anwenden.";
  }
  if (
    message.includes("printful_product_colors") ||
    message.includes("printful_product_color_assets")
  ) {
    return "Tabellen printful_product_colors/printful_product_color_assets fehlen – Migration supabase/migrations/018_printful_color_assets.sql anwenden.";
  }
  return undefined;
}

type IncomingVariantPatch = Record<string, unknown>;

function isIncomingVariantPatch(value: unknown): value is IncomingVariantPatch {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceVariantPatches(variants: unknown): IncomingVariantPatch[] {
  return Array.isArray(variants)
    ? variants.filter((item): item is IncomingVariantPatch => isIncomingVariantPatch(item))
    : [];
}

async function requireAdmin() {
  const cookieStore = await cookies();
  if (isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("printful_products")
    .select(PRODUCT_SELECT)
    .order("sort_order", { ascending: true, nullsFirst: false });

  if (error) {
    const hint = postgresHint(error);
    return NextResponse.json(
      hint ? { error: error.message, hint } : { error: error.message },
      { status: 500 }
    );
  }

  const products = data ?? [];
  const productIds = products
    .map((product) => Number((product as { printful_product_id?: unknown }).printful_product_id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (productIds.length === 0) {
    return NextResponse.json({ products });
  }

  const [colorsResult, assetsResult] = await Promise.all([
    supabaseAdmin
      .from("printful_product_colors")
      .select("*")
      .in("printful_product_id", productIds)
      .order("color_name"),
    supabaseAdmin
      .from("printful_product_color_assets")
      .select("*")
      .in("printful_product_id", productIds)
      .order("color_slug")
      .order("placement")
      .order("is_preferred", { ascending: false }),
  ]);

  if (colorsResult.error || assetsResult.error) {
    const err = colorsResult.error ?? assetsResult.error;
    const hint = postgresHint(err);
    return NextResponse.json(
      hint ? { error: err?.message, hint } : { error: err?.message },
      { status: 500 }
    );
  }

  const colorsByProduct = new Map<number, unknown[]>();
  for (const color of colorsResult.data ?? []) {
    const productId = Number((color as { printful_product_id?: unknown }).printful_product_id);
    colorsByProduct.set(productId, [...(colorsByProduct.get(productId) ?? []), color]);
  }

  const assetsByProduct = new Map<number, unknown[]>();
  for (const asset of assetsResult.data ?? []) {
    const productId = Number((asset as { printful_product_id?: unknown }).printful_product_id);
    assetsByProduct.set(productId, [...(assetsByProduct.get(productId) ?? []), asset]);
  }

  return NextResponse.json({
    products: products.map((product) => {
      const printfulProductId = Number((product as { printful_product_id?: unknown }).printful_product_id);
      return {
        ...product,
        product_colors: colorsByProduct.get(printfulProductId) ?? [],
        color_assets: assetsByProduct.get(printfulProductId) ?? [],
      };
    }),
  });
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: unknown;
    is_active?: unknown;
    is_primary?: unknown;
    sort_order?: unknown;
    variants?: unknown;
    shop_unit_price_cents?: unknown | null;
  };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updates: {
    is_active?: boolean;
    is_primary?: boolean;
    sort_order?: number;
    variants?: unknown[];
    shop_unit_price_cents?: number | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }
  if (typeof body.is_primary === "boolean") {
    updates.is_primary = body.is_primary;
    if (body.is_primary) {
      updates.is_active = true;
    }
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    updates.sort_order = Math.trunc(body.sort_order);
  }
  if (body.shop_unit_price_cents === null || body.shop_unit_price_cents === undefined) {
    if (body.shop_unit_price_cents === null) {
      updates.shop_unit_price_cents = null;
    }
  } else if (
    typeof body.shop_unit_price_cents === "number" &&
    Number.isFinite(body.shop_unit_price_cents) &&
    Math.trunc(body.shop_unit_price_cents) >= 1
  ) {
    updates.shop_unit_price_cents = Math.trunc(body.shop_unit_price_cents);
  } else if (typeof body.shop_unit_price_cents === "string" && body.shop_unit_price_cents.trim() !== "") {
    const parsed = Number.parseInt(body.shop_unit_price_cents, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json({ error: "invalid shop_unit_price_cents" }, { status: 400 });
    }
    updates.shop_unit_price_cents = parsed;
  } else if (body.shop_unit_price_cents !== undefined) {
    return NextResponse.json({ error: "invalid shop_unit_price_cents" }, { status: 400 });
  }

  const variantPatches = coerceVariantPatches(body.variants);
  if (variantPatches.length > 0) {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("printful_products")
      .select("variants")
      .eq("id", id)
      .single();
    if (fetchError || !existing) {
      return NextResponse.json({ error: fetchError?.message ?? "Product not found" }, { status: 404 });
    }
    const current = Array.isArray((existing as { variants?: unknown }).variants)
      ? ((existing as { variants: IncomingVariantPatch[] }).variants ?? []).map((item) => ({ ...item }))
      : [];

    const byId = new Map(current.map((item) => [Number(item.variant_id), item]));

    const nextIds = new Set<number>(
      variantPatches
        .map((patch) => Number(patch.variant_id))
        .filter((value) => Number.isInteger(value) && value > 0)
    );
    const missing = [...nextIds].filter((sid) => !byId.has(sid));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Unknown variants in request", missing }, { status: 400 });
    }

    const replacements = [...byId.entries()]
      .filter(([sid]) => nextIds.has(sid))
      .map(([sid, baseline]) => {
        const patch = variantPatches.find((item) => Number(item.variant_id) === sid)!;
        return {
          ...baseline,
          ...(typeof patch.variant_id !== "undefined" ? { variant_id: patch.variant_id } : {}),
          ...(typeof patch.size !== "undefined" ? { size: patch.size } : {}),
          ...(typeof patch.color !== "undefined" ? { color: patch.color } : {}),
          ...(typeof patch.color_hex !== "undefined" ? { color_hex: patch.color_hex } : {}),
          ...(typeof patch.material !== "undefined" ? { material: patch.material } : {}),
          ...(typeof patch.price_cents !== "undefined" ? { price_cents: patch.price_cents } : {}),
          ...(typeof patch.stock !== "undefined" ? { stock: patch.stock } : {}),
        };
      });

    updates.variants = replacements;
  }

  if (
    !("is_active" in updates) &&
    !("is_primary" in updates) &&
    !("sort_order" in updates) &&
    !("variants" in updates) &&
    !("shop_unit_price_cents" in updates)
  ) {
    return NextResponse.json({ error: "No supported fields provided" }, { status: 400 });
  }

  if (updates.is_primary) {
    const { error: resetError } = await supabaseAdmin
      .from("printful_products")
      .update({ is_primary: false })
      .neq("id", id);
    if (resetError) {
      const hint = postgresHint(resetError);
      return NextResponse.json(
        hint ? { error: resetError.message, hint } : { error: resetError.message },
        { status: 500 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("printful_products")
    .update(updates)
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .single();

  if (error) {
    const hint = postgresHint(error);
    return NextResponse.json(
      hint ? { error: error.message, hint } : { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("printful_products").delete().eq("id", id);

  if (error) {
    const hint = postgresHint(error);
    return NextResponse.json(
      hint ? { error: error.message, hint } : { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
