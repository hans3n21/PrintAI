import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, stripeSessionCreateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  stripeSessionCreateMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: stripeSessionCreateMock,
      },
    },
  },
}));

import { POST } from "../route";

function mockSessionSelect(session: Record<string, unknown>) {
  const single = vi.fn(() => Promise.resolve({ data: session, error: null }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

describe("POST /api/checkout/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_CHECKOUT_AMOUNT_CENTS = "3499";
  });

  it("requires a sessionId", async () => {
    const response = await POST(
      new Request("https://example.com/api/checkout/stripe", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(stripeSessionCreateMock).not.toHaveBeenCalled();
  });

  it("creates a Stripe Checkout Session and stores a pending payment order", async () => {
    const sessionQuery = mockSessionSelect({
      config: {
        quantity: 2,
        print_file: { url: "https://storage.example.com/print-file.png" },
        shipping_country: "DE",
      },
      product_selection: {
        printful_product_id: 71,
        printful_variant_id: 4011,
        size: "M",
        color: "Black",
      },
    });
    const productSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          variants: [{ variant_id: 4011, size: "M", color: "Black", price_cents: 1200 }],
        },
        error: null,
      })
    );
    const productMaybeSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          variants: [{ variant_id: 4011, size: "M", color: "Black", price_cents: 1200 }],
        },
        error: null,
      })
    );
    const productEqVariant = vi.fn(() => ({ maybeSingle: productMaybeSingle, single: productSingle }));
    const productEqActive = vi.fn(() => ({ eq: productEqVariant, order: vi.fn() }));
    const productSelect = vi.fn(() => ({ eq: productEqActive }));
    const pricingSingle = vi.fn(() =>
      Promise.resolve({
        data: { markup_percent: 50, markup_fixed_cents: 100, currency: "eur" },
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
    const orderInsert = vi.fn(() => Promise.resolve({ error: null }));
    const sessionUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
    const sessionUpdate = vi.fn(() => ({ eq: sessionUpdateEq }));
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        const callCount = fromMock.mock.calls.filter(([name]) => name === "sessions").length;
        return callCount === 1 ? { select: sessionQuery.select } : { update: sessionUpdate };
      }
      if (table === "printful_products") return { select: productSelect };
      if (table === "pricing_settings") return { select: pricingSelect };
      if (table === "shipping_rates") return { select: shippingSelect };
      if (table === "orders") return { insert: orderInsert };
      return {};
    });
    stripeSessionCreateMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });

    const response = await POST(
      new Request("https://example.com/api/checkout/stripe", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" }),
        headers: { origin: "https://printai.example" },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(stripeSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        success_url: "https://printai.example/checkout/session-1?stripe=success",
        cancel_url: "https://printai.example/checkout/session-1?stripe=cancel",
        metadata: { sessionId: "session-1" },
        line_items: [
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 1900,
            }),
          }),
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 499,
            }),
          }),
        ],
      })
    );
    expect(orderInsert).toHaveBeenCalledWith({
      session_id: "session-1",
      status: "pending_payment",
      stripe_checkout_session_id: "cs_test_123",
      total_cents: 4299,
      line_items: expect.objectContaining({
        item: expect.objectContaining({
          variant_id: 4011,
          quantity: 2,
          print_file_url: "https://storage.example.com/print-file.png",
        }),
        pricing: expect.objectContaining({
          unit_amount_cents: 1900,
          shipping_cents: 499,
          shipping_included_in_shop_price: false,
          total_cents: 4299,
        }),
      }),
    });
    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_payment" })
    );
    expect(json).toEqual({
      checkout_session_id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
  });

  it("drops extra shipping Stripe line when shop price includes shipping", async () => {
    const sessionQuery = mockSessionSelect({
      config: {
        quantity: 2,
        print_file: { url: "https://storage.example.com/print-file.png" },
        shipping_country: "DE",
      },
      product_selection: {
        printful_product_id: 71,
        printful_variant_id: 4011,
        size: "M",
        color: "Black",
      },
    });
    const productSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          variants: [{ variant_id: 4011, size: "M", color: "Black", price_cents: 1200 }],
        },
        error: null,
      })
    );
    const productMaybeSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          variants: [{ variant_id: 4011, size: "M", color: "Black", price_cents: 1200 }],
        },
        error: null,
      })
    );
    const productEqVariant = vi.fn(() => ({ maybeSingle: productMaybeSingle, single: productSingle }));
    const productEqActive = vi.fn(() => ({ eq: productEqVariant, order: vi.fn() }));
    const productSelect = vi.fn(() => ({ eq: productEqActive }));
    const pricingSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          markup_percent: 50,
          markup_fixed_cents: 100,
          currency: "eur",
          shop_prices_include_shipping: true,
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
    const orderInsert = vi.fn(() => Promise.resolve({ error: null }));
    const sessionUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
    const sessionUpdate = vi.fn(() => ({ eq: sessionUpdateEq }));
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        const callCount = fromMock.mock.calls.filter(([name]) => name === "sessions").length;
        return callCount === 1 ? { select: sessionQuery.select } : { update: sessionUpdate };
      }
      if (table === "printful_products") return { select: productSelect };
      if (table === "pricing_settings") return { select: pricingSelect };
      if (table === "shipping_rates") return { select: shippingSelect };
      if (table === "orders") return { insert: orderInsert };
      return {};
    });
    stripeSessionCreateMock.mockResolvedValue({
      id: "cs_bundle",
      url: "https://checkout.stripe.com/c/pay/cs_bundle",
    });

    const response = await POST(
      new Request("https://example.com/api/checkout/stripe", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-bundle" }),
        headers: { origin: "https://printai.example" },
      })
    );
    await response.json();

    expect(response.status).toBe(200);
    expect(stripeSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 1900,
            }),
          }),
        ],
      })
    );
    expect(orderInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        total_cents: 3800,
        line_items: expect.objectContaining({
          pricing: expect.objectContaining({
            shipping_cents: 0,
            shipping_included_in_shop_price: true,
            total_cents: 3800,
          }),
        }),
      })
    );
  });
});
