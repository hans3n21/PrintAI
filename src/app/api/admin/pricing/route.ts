import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { DEFAULT_PRICING_SETTINGS, DEFAULT_SHIPPING_RATES } from "@/lib/pricing/calculatePrice";
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

function normalizeRate(input: unknown) {
  const rate = input as Record<string, unknown>;
  const countryCode =
    typeof rate.countryCode === "string"
      ? rate.countryCode
      : typeof rate.country_code === "string"
        ? rate.country_code
        : "";
  const rawFree = rate.freeFromCents ?? rate.free_from_cents;
  const parsedFree =
    rawFree != null && rawFree !== ""
      ? Math.max(0, Math.trunc(Number(rawFree)))
      : null;

  return {
    country_code: countryCode.trim().toUpperCase(),
    label: typeof rate.label === "string" ? rate.label.trim() : countryCode.trim().toUpperCase(),
    amount_cents: Math.max(0, Math.trunc(Number(rate.amountCents ?? rate.amount_cents ?? 0))),
    free_from_cents:
      parsedFree != null && Number.isFinite(parsedFree) ? parsedFree : null,
    enabled: rate.enabled !== false,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [{ data: pricing }, { data: shippingRates }] = await Promise.all([
    supabaseAdmin.from("pricing_settings").select("*").limit(1).single(),
    supabaseAdmin.from("shipping_rates").select("*").order("country_code"),
  ]);

  return NextResponse.json({
    pricing: pricing ?? {
      markup_percent: DEFAULT_PRICING_SETTINGS.markupPercent,
      markup_fixed_cents: DEFAULT_PRICING_SETTINGS.markupFixedCents,
      currency: DEFAULT_PRICING_SETTINGS.currency,
      shop_prices_include_shipping: false,
    },
    shipping_rates:
      shippingRates ??
      DEFAULT_SHIPPING_RATES.map((rate) => ({
        country_code: rate.countryCode,
        label: rate.label,
        amount_cents: rate.amountCents,
        free_from_cents: rate.freeFromCents ?? null,
        enabled: rate.enabled,
      })),
  });
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    markup_percent?: unknown;
    markup_fixed_cents?: unknown;
    shipping_rates?: unknown;
    shop_prices_include_shipping?: unknown;
  };

  const { data: existing, error: readError } = await supabaseAdmin
    .from("pricing_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (readError && readError.code !== "PGRST116") {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const existingRow = (existing ?? null) as Record<string, unknown> | null;
  const nextIncludeShipping =
    typeof body.shop_prices_include_shipping === "boolean"
      ? body.shop_prices_include_shipping
      : existingRow?.shop_prices_include_shipping === true;

  const pricing = {
    id: "default",
    markup_percent: Math.max(
      0,
      Number(
        body.markup_percent ??
          existingRow?.markup_percent ??
          DEFAULT_PRICING_SETTINGS.markupPercent
      )
    ),
    markup_fixed_cents: Math.max(
      0,
      Math.trunc(
        Number(body.markup_fixed_cents ?? existingRow?.markup_fixed_cents ?? 0)
      )
    ),
    currency: typeof existingRow?.currency === "string" ? existingRow.currency : "eur",
    shop_prices_include_shipping: nextIncludeShipping,
    updated_at: new Date().toISOString(),
  };
  const { error: pricingError } = await supabaseAdmin
    .from("pricing_settings")
    .upsert(pricing, { onConflict: "id" });
  if (pricingError) {
    return NextResponse.json({ error: pricingError.message }, { status: 500 });
  }

  if (Array.isArray(body.shipping_rates)) {
    const rates = body.shipping_rates.map(normalizeRate).filter((rate) => rate.country_code);
    if (rates.length > 0) {
      const { error: shippingError } = await supabaseAdmin
        .from("shipping_rates")
        .upsert(rates, { onConflict: "country_code" });
      if (shippingError) {
        return NextResponse.json({ error: shippingError.message }, { status: 500 });
      }
    }
  }

  return GET();
}
