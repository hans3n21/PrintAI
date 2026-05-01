import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const cookieStore = await cookies();
  if (isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

function integerOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: unknown;
    is_preferred?: unknown;
    template_width?: unknown;
    template_height?: unknown;
    print_area_left?: unknown;
    print_area_top?: unknown;
    print_area_width?: unknown;
    print_area_height?: unknown;
  };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("printful_product_color_assets")
    .select("id, printful_product_id, color_slug, placement")
    .eq("id", id)
    .single();
  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? "Asset not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const fields = [
    "template_width",
    "template_height",
    "print_area_left",
    "print_area_top",
    "print_area_width",
    "print_area_height",
  ] as const;
  for (const field of fields) {
    if (field in body) {
      const value = integerOrNull(body[field]);
      if (value === undefined) {
        return NextResponse.json({ error: `invalid ${field}` }, { status: 400 });
      }
      updates[field] = value;
    }
  }

  if (body.is_preferred === true) {
    const productId = Number((existing as { printful_product_id: unknown }).printful_product_id);
    const colorSlug = String((existing as { color_slug: unknown }).color_slug);
    const placement = String((existing as { placement: unknown }).placement);
    const { error: resetError } = await supabaseAdmin
      .from("printful_product_color_assets")
      .update({ is_preferred: false })
      .eq("printful_product_id", productId)
      .eq("color_slug", colorSlug)
      .eq("placement", placement);
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 });
    updates.is_preferred = true;
  } else if (body.is_preferred === false) {
    updates.is_preferred = false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No supported fields provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("printful_product_color_assets")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const productId = Number(params.get("productId") ?? params.get("printful_product_id") ?? "");
  let query = supabaseAdmin
    .from("printful_product_color_assets")
    .select("*");

  if (Number.isInteger(productId) && productId > 0) {
    query = query.eq("printful_product_id", productId);
  }

  const { data, error } = await query
    .order("printful_product_id")
    .order("color_slug")
    .order("placement")
    .order("is_preferred", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}
