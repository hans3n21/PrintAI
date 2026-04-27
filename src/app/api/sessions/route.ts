import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_PRODUCT_SELECTION, normalizeQuantity } from "@/lib/productSelection";
import type { Product, ProductColor, ProductSelection } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { initial_message, product_selection } = await request.json();
  const rawSelection = (product_selection ?? {}) as Partial<ProductSelection>;
  const selection: ProductSelection = {
    product: (rawSelection.product ?? DEFAULT_PRODUCT_SELECTION.product) as Product,
    product_color: (rawSelection.product_color ??
      DEFAULT_PRODUCT_SELECTION.product_color) as ProductColor,
    quantity: normalizeQuantity(rawSelection.quantity),
  };

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
