import { getDefaultActivePrintfulProductId } from "@/lib/printful/defaultShopProduct";
import { supabaseAdmin } from "@/lib/supabase";
import {
  DEFAULT_PRODUCT_SELECTION,
  normalizeQuantity,
  withPinnedShopPrintfulProductId,
} from "@/lib/productSelection";
import type { Product, ProductColor, ProductSelection } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { initial_message, product_selection } = await request.json();
  const rawSelection = (product_selection ?? {}) as Partial<ProductSelection>;
  const shopPrintfulId = await getDefaultActivePrintfulProductId();
  const baseSelection: ProductSelection = {
    product: (rawSelection.product ?? DEFAULT_PRODUCT_SELECTION.product) as Product,
    product_color: (rawSelection.product_color ??
      DEFAULT_PRODUCT_SELECTION.product_color) as ProductColor,
    quantity: normalizeQuantity(rawSelection.quantity),
  };
  const candidate: ProductSelection = {
    ...baseSelection,
    ...(typeof rawSelection.printful_product_id === "number" &&
    Number.isInteger(rawSelection.printful_product_id) &&
    rawSelection.printful_product_id > 0
      ? { printful_product_id: rawSelection.printful_product_id }
      : {}),
    ...(typeof rawSelection.printful_variant_id === "number"
      ? { printful_variant_id: rawSelection.printful_variant_id }
      : {}),
    ...(typeof rawSelection.size === "string" ? { size: rawSelection.size } : {}),
    ...(typeof rawSelection.color === "string" ? { color: rawSelection.color } : {}),
  };
  const selection =
    shopPrintfulId != null
      ? withPinnedShopPrintfulProductId(candidate, shopPrintfulId)
      : candidate;

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .insert({
      conversation_history: [],
      product_selection: selection,
      status: "onboarding",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: data.id, initial_message });
}
