import { createPrintfulDraftOrderForSession } from "@/lib/orders/printfulFulfillment";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

function stringFromStripeValue(value: string | Stripe.PaymentIntent | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook signature or secret missing" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  const sessionId = checkoutSession.metadata?.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "Stripe session metadata.sessionId missing" }, { status: 400 });
  }

  try {
    await createPrintfulDraftOrderForSession(sessionId, {
      checkoutSessionId: checkoutSession.id,
      paymentIntentId: stringFromStripeValue(checkoutSession.payment_intent),
      amountTotal: checkoutSession.amount_total ?? null,
      currency: checkoutSession.currency ?? null,
      customerEmail: checkoutSession.customer_details?.email ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/stripe/webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
