import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PRODUCT_SELECT =
  "id, printful_product_id, title, slug, technique, placements, variants, print_area, mockup_templates, is_active, sort_order, created_at, updated_at";

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    id?: unknown;
    is_active?: unknown;
    sort_order?: unknown;
  };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updates: { is_active?: boolean; sort_order?: number; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) {
    updates.sort_order = Math.trunc(body.sort_order);
  }
  if (!("is_active" in updates) && !("sort_order" in updates)) {
    return NextResponse.json({ error: "No supported fields provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("printful_products")
    .update(updates)
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}
