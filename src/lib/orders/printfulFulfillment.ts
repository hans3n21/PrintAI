import { postJson } from "@/lib/printful/client";
import { supabaseAdmin } from "@/lib/supabase";

type SessionOrderConfig = {
  quantity?: number;
  print_file?: {
    url?: string;
  };
  placement?: {
    placement?: string;
  };
};

type SessionProductSelection = {
  printful_variant_id?: number;
};

type PrintfulOrderResponse = {
  result?: {
    id?: number | string;
    status?: string;
    dashboard_url?: string;
  };
};

type StripePaymentDetails = {
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  customerEmail?: string | null;
};

const STUB_RECIPIENT = {
  name: "PrintAI Testkunde",
  address1: "Musterstrasse 1",
  city: "Berlin",
  state_code: "",
  country_code: "DE",
  zip: "10115",
};

function normalizeQuantity(value: number | undefined) {
  return Math.max(1, Math.trunc(value ?? 1));
}

function normalizePrintfulOrderId(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

export async function createPrintfulDraftOrderForSession(
  normalizedSessionId: string,
  stripePayment?: StripePaymentDetails
) {
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("config, product_selection")
    .eq("id", normalizedSessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? "Session not found");
  }

  const config = (session.config ?? {}) as SessionOrderConfig;
  const productSelection = session.product_selection as SessionProductSelection | null;
  const variantId = productSelection?.printful_variant_id;
  const printFileUrl = config.print_file?.url;

  if (!variantId || !printFileUrl) {
    throw new Error("printful_variant_id and print_file.url required");
  }

  const quantity = normalizeQuantity(config.quantity);
  const fileType = config.placement?.placement ?? "front_large";
  const printfulOrder = await postJson<PrintfulOrderResponse>("/orders", {
    recipient: STUB_RECIPIENT,
    items: [
      {
        variant_id: variantId,
        quantity,
        files: [
          {
            type: fileType,
            url: printFileUrl,
          },
        ],
      },
    ],
    confirm: false,
  });

  const result = printfulOrder.result;
  const printfulOrderId = result?.id;
  if (printfulOrderId == null) {
    throw new Error("Printful order id missing");
  }

  const normalizedPrintfulOrderId = normalizePrintfulOrderId(printfulOrderId);
  const lineItems = {
    printful_order: result,
    item: {
      variant_id: variantId,
      quantity,
      file_type: fileType,
      print_file_url: printFileUrl,
    },
    ...(stripePayment
      ? {
          stripe: {
            checkout_session_id: stripePayment.checkoutSessionId,
            payment_intent_id: stripePayment.paymentIntentId ?? null,
            amount_total: stripePayment.amountTotal ?? null,
            currency: stripePayment.currency ?? null,
          },
        }
      : {}),
  };

  if (stripePayment) {
    const { error: updateOrderError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid_printful_draft",
        printful_order_id: normalizedPrintfulOrderId,
        stripe_payment_intent_id: stripePayment.paymentIntentId ?? null,
        customer_email: stripePayment.customerEmail ?? null,
        paid_at: new Date().toISOString(),
        total_cents: stripePayment.amountTotal ?? null,
        line_items: lineItems,
      })
      .eq("stripe_checkout_session_id", stripePayment.checkoutSessionId);

    if (updateOrderError) {
      throw new Error(updateOrderError.message);
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      session_id: normalizedSessionId,
      status: result?.status ?? "draft",
      printful_order_id: normalizedPrintfulOrderId,
      total_cents: null,
      line_items: lineItems,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const { error: sessionUpdateError } = await supabaseAdmin
    .from("sessions")
    .update({ status: "ordered", updated_at: new Date().toISOString() })
    .eq("id", normalizedSessionId);

  if (sessionUpdateError) {
    throw new Error(sessionUpdateError.message);
  }

  return {
    order_id: String(printfulOrderId),
    status: stripePayment ? "paid_printful_draft" : result?.status ?? "draft",
    dashboard_url:
      result?.dashboard_url ??
      `https://www.printful.com/dashboard/default/orders/${printfulOrderId}`,
  };
}
