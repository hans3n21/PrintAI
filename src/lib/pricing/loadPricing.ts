import { supabaseAdmin } from "@/lib/supabase";
import {
  applyShopPriceIncludesShipping,
  calculatePriceQuote,
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_SHIPPING_RATES,
  type PriceQuote,
  type PricingSettings,
  type ShippingRate,
} from "./calculatePrice";

type ProductVariant = {
  variant_id: number;
  price_cents?: number | null;
  size?: string | null;
  color?: string | null;
};

function normalizePricingSettings(row: Record<string, unknown> | null): PricingSettings {
  return {
    markupPercent:
      typeof row?.markup_percent === "number"
        ? row.markup_percent
        : DEFAULT_PRICING_SETTINGS.markupPercent,
    markupFixedCents:
      typeof row?.markup_fixed_cents === "number"
        ? row.markup_fixed_cents
        : DEFAULT_PRICING_SETTINGS.markupFixedCents,
    currency: typeof row?.currency === "string" ? row.currency : DEFAULT_PRICING_SETTINGS.currency,
  };
}

function normalizeShippingRate(row: Record<string, unknown>): ShippingRate {
  return {
    countryCode: typeof row.country_code === "string" ? row.country_code : "DE",
    label: typeof row.label === "string" ? row.label : "Versand",
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : 0,
    freeFromCents: typeof row.free_from_cents === "number" ? row.free_from_cents : null,
    enabled: row.enabled !== false,
  };
}

async function loadSettings() {
  const [{ data: pricing }, { data: shippingRates }] = await Promise.all([
    supabaseAdmin.from("pricing_settings").select("*").limit(1).single(),
    supabaseAdmin.from("shipping_rates").select("*").eq("enabled", true).order("country_code"),
  ]);

  const row = (pricing ?? null) as Record<string, unknown> | null;

  return {
    pricing: normalizePricingSettings(row),
    shippingRates:
      Array.isArray(shippingRates) && shippingRates.length > 0
        ? (shippingRates as Record<string, unknown>[]).map(normalizeShippingRate)
        : DEFAULT_SHIPPING_RATES,
    shopPricesIncludeShipping: row?.shop_prices_include_shipping === true,
  };
}

function customerFacingQuote(quote: PriceQuote, shopPricesIncludeShipping: boolean): PriceQuote {
  return shopPricesIncludeShipping
    ? applyShopPriceIncludesShipping(quote)
    : { ...quote, shippingIncludedInShopPrice: false };
}

export async function quoteForVariant({
  printfulProductId,
  printfulVariantId,
  quantity,
  countryCode = "DE",
}: {
  printfulProductId?: number | null;
  printfulVariantId: number;
  quantity: number;
  countryCode?: string | null;
}): Promise<PriceQuote> {
  let query = supabaseAdmin
    .from("printful_products")
    .select("variants, shop_unit_price_cents")
    .eq("is_active", true);
  if (printfulProductId && Number.isInteger(printfulProductId)) {
    query = query.eq("printful_product_id", printfulProductId);
  } else {
    query = query.order("is_primary", { ascending: false }).order("sort_order", {
      ascending: true,
      nullsFirst: false,
    });
  }

  const { data: product, error } = await query.maybeSingle();
  if (error || !product) {
    throw new Error(error?.message ?? "Printful product not found");
  }

  const variants = ((product as { variants?: ProductVariant[] | null }).variants ?? []);
  const variant = variants.find((item) => item.variant_id === printfulVariantId);
  const shopUnitPriceRaw = (product as { shop_unit_price_cents?: number | null }).shop_unit_price_cents;
  const shopUnitPriceCents =
    typeof shopUnitPriceRaw === "number" && Number.isFinite(shopUnitPriceRaw)
      ? Math.trunc(shopUnitPriceRaw)
      : null;
  const baseCostRaw = variant?.price_cents;
  const baseCostCents =
    typeof baseCostRaw === "number" && Number.isFinite(baseCostRaw) ? Math.trunc(baseCostRaw) : 0;

  const { pricing, shippingRates, shopPricesIncludeShipping } = await loadSettings();
  const raw = calculatePriceQuote({
    baseCostCents: baseCostCents > 0 ? baseCostCents : shopUnitPriceCents ?? 0,
    quantity,
    countryCode: countryCode ?? "DE",
    pricing,
    shippingRates,
    overrideUnitAmountCents:
      shopUnitPriceCents !== null && shopUnitPriceCents > 0 ? shopUnitPriceCents : undefined,
  });
  return customerFacingQuote(raw, shopPricesIncludeShipping);
}
