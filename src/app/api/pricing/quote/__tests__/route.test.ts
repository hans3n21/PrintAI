import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

import { POST } from "../route";

function mockMaybeSingle(data: unknown) {
  const maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }));
  const eqProduct = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ eq: eqProduct, maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

function mockPricingTables(options?: { shopPricesIncludeShipping?: boolean }) {
  const pricingSingle = vi.fn(() =>
    Promise.resolve({
      data: {
        markup_percent: 50,
        markup_fixed_cents: 100,
        currency: "eur",
        shop_prices_include_shipping: options?.shopPricesIncludeShipping === true,
      },
      error: null,
    })
  );
  const pricingLimit = vi.fn(() => ({ single: pricingSingle }));
  const pricingSelect = vi.fn(() => ({ limit: pricingLimit }));
  const shippingOrder = vi.fn(() =>
    Promise.resolve({
      data: [{ country_code: "DE", label: "Deutschland", amount_cents: 499, enabled: true }],
      error: null,
    })
  );
  const shippingEq = vi.fn(() => ({ order: shippingOrder }));
  const shippingSelect = vi.fn(() => ({ eq: shippingEq }));
  return { pricingSelect, shippingSelect };
}

describe("POST /api/pricing/quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates a quote from the selected variant cost", async () => {
    const productQuery = mockMaybeSingle({
      variants: [{ variant_id: 4011, price_cents: 1200, size: "M", color: "Black" }],
    });
    const { pricingSelect, shippingSelect } = mockPricingTables();
    fromMock.mockImplementation((table: string) => {
      if (table === "printful_products") return { select: productQuery.select };
      if (table === "pricing_settings") return { select: pricingSelect };
      if (table === "shipping_rates") return { select: shippingSelect };
      return {};
    });

    const response = await POST(
      new Request("https://example.com/api/pricing/quote", {
        method: "POST",
        body: JSON.stringify({
          printful_product_id: 71,
          printful_variant_id: 4011,
          quantity: 2,
          country_code: "DE",
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quote).toMatchObject({
      unitAmountCents: 1900,
      subtotalCents: 3800,
      shippingCents: 499,
      totalCents: 4299,
      currency: "eur",
      shippingIncludedInShopPrice: false,
    });
  });

  it("hides shipping in customer-facing totals when shop price includes shipping", async () => {
    const productQuery = mockMaybeSingle({
      variants: [{ variant_id: 4011, price_cents: 1200, size: "M", color: "Black" }],
    });
    const { pricingSelect, shippingSelect } = mockPricingTables({
      shopPricesIncludeShipping: true,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "printful_products") return { select: productQuery.select };
      if (table === "pricing_settings") return { select: pricingSelect };
      if (table === "shipping_rates") return { select: shippingSelect };
      return {};
    });

    const response = await POST(
      new Request("https://example.com/api/pricing/quote", {
        method: "POST",
        body: JSON.stringify({
          printful_product_id: 71,
          printful_variant_id: 4011,
          quantity: 2,
          country_code: "DE",
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quote).toMatchObject({
      subtotalCents: 3800,
      shippingCents: 0,
      totalCents: 3800,
      shippingIncludedInShopPrice: true,
    });
  });
});
