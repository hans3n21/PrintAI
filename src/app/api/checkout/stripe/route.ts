import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

type SessionCheckoutConfig = {
  quantity?: number;
  print_file?: {
    url?: string;
  };
};

type SessionProductSelection = {
  printful_variant_id?: number;
  size?: string;
  color?: string;
};

const DEFAULT_CHECKOUT_AMOUNT_CENTS = 2999;
const CHECKOUT_CURRENCY = "eur";

function checkoutAmountCents() {
  const raw = process.env.STRIPE_CHECKOUT_AMOUNT_CENTS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_CHECKOUT_AMOUNT_CENTS;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CHECKOUT_AMOUNT_CENTS;
}

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
    const unitAmount = checkoutAmountCents();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/checkout/${encodeURIComponent(normalizedSessionId)}?stripe=success`,
      cancel_url: `${baseUrl}/checkout/${encodeURIComponent(normalizedSessionId)}?stripe=cancel`,
      metadata: { sessionId: normalizedSessionId },
      line_items: [
        {
          quantity,
          price_data: {
            currency: CHECKOUT_CURRENCY,
            unit_amount: unitAmount,
            product_data: {
              name: "PrintAI Custom Shirt",
              description: [productSelection?.color, productSelection?.size]
                .filter(Boolean)
                .join(" / "),
            },
          },
        },
      ],
    });

    if (!checkoutSession.id || !checkoutSession.url) {
      return NextResponse.json({ error: "Stripe Checkout Session incomplete" }, { status: 500 });
    }

    const totalCents = unitAmount * quantity;
    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      session_id: normalizedSessionId,
      status: "pending_payment",
      stripe_checkout_session_id: checkoutSession.id,
      total_cents: totalCents,
      line_items: {
        item: {
          variant_id: variantId,
          quantity,
          print_file_url: printFileUrl,
          size: productSelection?.size ?? null,
          color: productSelection?.color ?? null,
        },
        stripe: {
          checkout_session_id: checkoutSession.id,
          amount_total: totalCents,
          currency: CHECKOUT_CURRENCY,
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
