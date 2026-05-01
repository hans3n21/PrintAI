import { supabaseAdmin } from "@/lib/supabase";

/**
 * Aktives Shop-Produkt: primär markiert (`is_primary`), sonst erste Sortierreihenfolge.
 * Muss dieselbe Reihenfolge wie im Shop-Frontend (Configure, Place, Mockup-Fallback, Quote-Fallback) nutzen,
 * sonst liegt die Session auf einem anderen Produkt als im Admin angelegt wird.
 */
export async function getDefaultActivePrintfulProductId(): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("printful_products")
    .select("printful_product_id")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.printful_product_id !== "number") {
    return null;
  }
  const id = data.printful_product_id;
  return Number.isFinite(id) && id > 0 ? id : null;
}
