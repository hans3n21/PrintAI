export type PricingSettings = {
  markupPercent: number;
  markupFixedCents: number;
  currency: string;
};

export type ShippingRate = {
  countryCode: string;
  label: string;
  amountCents: number;
  freeFromCents?: number | null;
  enabled: boolean;
};

export type PriceQuoteInput = {
  baseCostCents: number;
  quantity: number;
  countryCode: string;
  pricing: PricingSettings;
  shippingRates: ShippingRate[];
  overrideUnitAmountCents?: number | null;
};

export type PriceQuote = {
  baseCostCents: number;
  markupCents: number;
  unitAmountCents: number;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  countryCode: string;
  pricing_mode: "markup" | "override";
  /** Wahr, wenn Porto im angezeigten Stückpreis steckt (keine separate Versandzeile beim Kunden). */
  shippingIncludedInShopPrice?: boolean;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  markupPercent: 50,
  markupFixedCents: 0,
  currency: "eur",
};

export const DEFAULT_SHIPPING_RATES: ShippingRate[] = [
  { countryCode: "DE", label: "Deutschland", amountCents: 499, freeFromCents: 7500, enabled: true },
  { countryCode: "AT", label: "Österreich", amountCents: 799, freeFromCents: 10000, enabled: true },
  { countryCode: "CH", label: "Schweiz", amountCents: 1499, enabled: true },
  { countryCode: "US", label: "USA", amountCents: 1499, enabled: true },
];

function normalizePositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function normalizeNonNegativeInteger(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) && value != null && value >= 0 ? Math.trunc(value) : fallback;
}

/** Porto in Cent zur Subtotal eines Warenkorbs – gleiche Regeln wie bei `calculatePriceQuote`. */
export function shippingPaidForSubtotalCents(input: {
  subtotalCents: number;
  countryCode: string;
  shippingRates: ShippingRate[];
}): number {
  const countryCode = input.countryCode.trim().toUpperCase() || "DE";
  const candidates = input.shippingRates.length > 0 ? input.shippingRates : DEFAULT_SHIPPING_RATES;
  const shippingRate =
    candidates.find((rate) => rate.enabled && rate.countryCode === countryCode) ??
    candidates.find((rate) => rate.enabled && rate.countryCode === "DE") ??
    DEFAULT_SHIPPING_RATES[0];
  const subtotalCents = Math.max(0, Math.trunc(input.subtotalCents));
  if (shippingRate.freeFromCents != null && subtotalCents >= shippingRate.freeFromCents) {
    return 0;
  }
  return shippingRate.amountCents;
}

/** Kunden-Checkout/Konfigurator: keine separate Versandposition; `total` = `subtotal`. */
export function applyShopPriceIncludesShipping(quote: PriceQuote): PriceQuote {
  return {
    ...quote,
    shippingCents: 0,
    totalCents: quote.subtotalCents,
    shippingIncludedInShopPrice: true,
  };
}

export function calculatePriceQuote(input: PriceQuoteInput): PriceQuote {
  const quantity = normalizePositiveInteger(input.quantity, 1);
  const countryCode = input.countryCode.trim().toUpperCase() || "DE";

  let baseCostCents = normalizePositiveInteger(input.baseCostCents, 0);
  let markupCents = 0;
  let unitAmountCents = 0;
  let pricingMode: PriceQuote["pricing_mode"] = "markup";

  const overrideRaw = input.overrideUnitAmountCents;
  if (
    overrideRaw !== undefined &&
    overrideRaw !== null &&
    typeof overrideRaw === "number" &&
    Number.isFinite(overrideRaw) &&
    Math.trunc(overrideRaw) >= 1
  ) {
    pricingMode = "override";
    unitAmountCents = normalizePositiveInteger(overrideRaw, 0);
    if (baseCostCents <= 0) {
      baseCostCents = unitAmountCents;
      markupCents = 0;
    } else {
      markupCents = Math.max(0, unitAmountCents - baseCostCents);
    }
  } else {
    pricingMode = "markup";
    baseCostCents = normalizePositiveInteger(input.baseCostCents, 0);
    if (baseCostCents <= 0) {
      throw new Error("Printful variant price is missing");
    }
    const markupPercent = Number.isFinite(input.pricing.markupPercent)
      ? Math.max(0, input.pricing.markupPercent)
      : DEFAULT_PRICING_SETTINGS.markupPercent;
    const markupFixedCents = normalizeNonNegativeInteger(input.pricing.markupFixedCents);
    markupCents = Math.round(baseCostCents * (markupPercent / 100)) + markupFixedCents;
    unitAmountCents = baseCostCents + markupCents;
  }

  const subtotalCents = unitAmountCents * quantity;
  const shippingCents = shippingPaidForSubtotalCents({
    subtotalCents,
    countryCode,
    shippingRates: input.shippingRates,
  });

  return {
    baseCostCents,
    markupCents,
    unitAmountCents,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: input.pricing.currency.trim().toLowerCase() || "eur",
    countryCode,
    pricing_mode: pricingMode,
  };
}
