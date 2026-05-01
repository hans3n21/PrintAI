import { describe, expect, it } from "vitest";
import { calculatePriceQuote, shippingPaidForSubtotalCents, applyShopPriceIncludesShipping } from "../calculatePrice";

describe("calculatePriceQuote", () => {
  it("calculates product price from Printful cost plus markup and shipping", () => {
    expect(
      calculatePriceQuote({
        baseCostCents: 1200,
        quantity: 2,
        countryCode: "DE",
        pricing: {
          markupPercent: 50,
          markupFixedCents: 100,
          currency: "eur",
        },
        shippingRates: [
          { countryCode: "DE", label: "Deutschland", amountCents: 499, enabled: true },
        ],
      })
    ).toMatchObject({
      unitAmountCents: 1900,
      subtotalCents: 3800,
      shippingCents: 499,
      totalCents: 4299,
      currency: "eur",
      pricing_mode: "markup",
    });
  });

  it("waives shipping above the free shipping threshold", () => {
    expect(
      calculatePriceQuote({
        baseCostCents: 4000,
        quantity: 2,
        countryCode: "DE",
        pricing: { markupPercent: 25, markupFixedCents: 0, currency: "eur" },
        shippingRates: [
          {
            countryCode: "DE",
            label: "Deutschland",
            amountCents: 499,
            freeFromCents: 5000,
            enabled: true,
          },
        ],
      }).shippingCents
    ).toBe(0);
  });

  it("supports a manual shop unit price override independent of markup", () => {
    expect(
      calculatePriceQuote({
        baseCostCents: 1025,
        quantity: 1,
        countryCode: "DE",
        pricing: { markupPercent: 50, markupFixedCents: 0, currency: "eur" },
        shippingRates: [{ countryCode: "DE", label: "Deutschland", amountCents: 499, enabled: true }],
        overrideUnitAmountCents: 1538,
      })
    ).toMatchObject({
      unitAmountCents: 1538,
      markupCents: 513,
      pricing_mode: "override",
    });
  });
});

describe("shippingPaidForSubtotalCents", () => {
  it("charges DE postage when below free-from threshold", () => {
    expect(
      shippingPaidForSubtotalCents({
        subtotalCents: 2700,
        countryCode: "DE",
        shippingRates: [
          {
            countryCode: "DE",
            label: "Deutschland",
            amountCents: 499,
            freeFromCents: 7500,
            enabled: true,
          },
        ],
      })
    ).toBe(499);
  });

  it("waives shipping when Subtotal clears free-from (same threshold as Quote)", () => {
    expect(
      shippingPaidForSubtotalCents({
        subtotalCents: 7600,
        countryCode: "DE",
        shippingRates: [
          {
            countryCode: "DE",
            label: "Deutschland",
            amountCents: 499,
            freeFromCents: 7500,
            enabled: true,
          },
        ],
      })
    ).toBe(0);
  });
});

describe("applyShopPriceIncludesShipping", () => {
  it("zeros shipping line and aligns total with subtotal", () => {
    const quote = calculatePriceQuote({
      baseCostCents: 1200,
      quantity: 2,
      countryCode: "DE",
      pricing: {
        markupPercent: 50,
        markupFixedCents: 100,
        currency: "eur",
      },
      shippingRates: [{ countryCode: "DE", label: "DE", amountCents: 499, enabled: true }],
    });

    expect(applyShopPriceIncludesShipping(quote)).toMatchObject({
      subtotalCents: 3800,
      shippingCents: 0,
      totalCents: 3800,
      shippingIncludedInShopPrice: true,
    });
  });
});
