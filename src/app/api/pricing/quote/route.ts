import { quoteForVariant } from "@/lib/pricing/loadPricing";
import { NextResponse } from "next/server";

function normalizeQuantity(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      printful_product_id?: unknown;
      printful_variant_id?: unknown;
      quantity?: unknown;
      country_code?: unknown;
    };
    const variantId = Number(body.printful_variant_id);
    if (!Number.isInteger(variantId) || variantId <= 0) {
      return NextResponse.json({ error: "printful_variant_id required" }, { status: 400 });
    }

    const productId = Number(body.printful_product_id);
    const quote = await quoteForVariant({
      printfulProductId: Number.isInteger(productId) && productId > 0 ? productId : null,
      printfulVariantId: variantId,
      quantity: normalizeQuantity(body.quantity),
      countryCode: typeof body.country_code === "string" ? body.country_code : "DE",
    });

    return NextResponse.json({ quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/pricing/quote]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
