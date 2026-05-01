import { quoteForVariant } from "@/lib/pricing/loadPricing";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

type SessionCheckoutConfig = {
  quantity?: number;
  shipping_country?: string;
  print_file?: {
    url?: string;
  };
};

type SessionProductSelection = {
  printful_product_id?: number;
  printful_variant_id?: number;
  size?: string;
  color?: string;
};

function quantityFromConfig(config: SessionCheckoutConfig) {
  return Math.max(1, Math.trunc(config.quantity ?? 1));
}

function requestBaseUrl(request: Request) {
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return origin.replace(/\/+$/, "");
}

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: unknown };
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const normalizedSessionId = sessionId.trim();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("config, product_selection")
      .eq("id", normalizedSessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: sessionError?.message ?? "Session not found" },
        { status: sessionError ? 500 : 404 }
      );
    }

    const config = (session.config ?? {}) as SessionCheckoutConfig;
    const productSelection = session.product_selection as SessionProductSelection | null;
    const variantId = productSelection?.printful_variant_id;
    const printFileUrl = config.print_file?.url;

    if (!variantId || !printFileUrl) {
      return NextResponse.json(
        { error: "printful_variant_id and print_file.url required before checkout" },
        { status: 400 }
      );
    }

    const baseUrl = requestBaseUrl(request);
    const quantity = quantityFromConfig(config);
    const quote = await quoteForVariant({
      printfulProductId: productSelection?.printful_product_id ?? null,
      printfulVariantId: variantId,
      quantity,
      countryCode: config.shipping_country ?? "DE",
    });
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/checkout/${encodeURIComponent(normalizedSessionId)}?stripe=success`,
      cancel_url: `${baseUrl}/checkout/${encodeURIComponent(normalizedSessionId)}?stripe=cancel`,
      metadata: { sessionId: normalizedSessionId },
      line_items: [
        {
          quantity,
          price_data: {
            currency: quote.currency,
            unit_amount: quote.unitAmountCents,
            product_data: {
              name: "PrintAI Custom Shirt",
              description: [productSelection?.color, productSelection?.size]
                .filter(Boolean)
                .join(" / "),
            },
          },
        },
        ...(quote.shippingCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: quote.currency,
                  unit_amount: quote.shippingCents,
                  product_data: {
                    name: `Versand ${quote.countryCode}`,
                  },
                },
              },
            ]
          : []),
      ],
    });

    if (!checkoutSession.id || !checkoutSession.url) {
      return NextResponse.json({ error: "Stripe Checkout Session incomplete" }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      session_id: normalizedSessionId,
      status: "pending_payment",
      stripe_checkout_session_id: checkoutSession.id,
      total_cents: quote.totalCents,
      line_items: {
        item: {
          variant_id: variantId,
          quantity,
          print_file_url: printFileUrl,
          size: productSelection?.size ?? null,
          color: productSelection?.color ?? null,
        },
        pricing: {
          unit_amount_cents: quote.unitAmountCents,
          base_cost_cents: quote.baseCostCents,
          markup_cents: quote.markupCents,
          subtotal_cents: quote.subtotalCents,
          shipping_cents: quote.shippingCents,
          shipping_included_in_shop_price: quote.shippingIncludedInShopPrice === true,
          total_cents: quote.totalCents,
          country_code: quote.countryCode,
          pricing_mode: quote.pricing_mode,
        },
        stripe: {
          checkout_session_id: checkoutSession.id,
          amount_total: quote.totalCents,
          currency: quote.currency,
        },
      },
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({ status: "pending_payment", updated_at: new Date().toISOString() })
      .eq("id", normalizedSessionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      checkout_session_id: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/checkout/stripe]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
