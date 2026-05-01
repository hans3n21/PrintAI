import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, postJsonMock, constructEventMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  postJsonMock: vi.fn(),
  constructEventMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

vi.mock("@/lib/printful/client", () => ({
  postJson: postJsonMock,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
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

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("fulfills the paid Stripe Checkout Session as a Printful draft", async () => {
    const sessionQuery = mockSessionSelect({
      config: {
        quantity: 2,
        print_file: { url: "https://storage.example.com/print-file.png" },
      },
      product_selection: {
        printful_variant_id: 4011,
        size: "M",
        color: "Black",
      },
    });
    const orderUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
    const orderUpdate = vi.fn(() => ({ eq: orderUpdateEq }));
    const sessionUpdateEq = vi.fn(() => Promise.resolve({ error: null }));
    const sessionUpdate = vi.fn(() => ({ eq: sessionUpdateEq }));
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        const callCount = fromMock.mock.calls.filter(([name]) => name === "sessions").length;
        return callCount === 1 ? { select: sessionQuery.select } : { update: sessionUpdate };
      }
      if (table === "orders") return { update: orderUpdate };
      return {};
    });
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_intent: "pi_test_123",
          amount_total: 6998,
          currency: "eur",
          customer_details: { email: "kunde@example.com" },
          metadata: { sessionId: "session-1" },
        },
      },
    });
    postJsonMock.mockResolvedValue({
      result: {
        id: 98765,
        status: "draft",
        dashboard_url: "https://www.printful.com/dashboard/default/orders/98765",
      },
    });

    const response = await POST(
      new Request("https://example.com/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_test" }),
        headers: { "stripe-signature": "sig_test" },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(constructEventMock).toHaveBeenCalledWith(
      JSON.stringify({ id: "evt_test" }),
      "sig_test",
      "whsec_test"
    );
    expect(postJsonMock).toHaveBeenCalledWith("/orders", {
      recipient: expect.objectContaining({ country_code: "DE" }),
      items: [
        {
          variant_id: 4011,
          quantity: 2,
          files: [{ type: "front_large", url: "https://storage.example.com/print-file.png" }],
        },
      ],
      confirm: false,
    });
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid_printful_draft",
        stripe_payment_intent_id: "pi_test_123",
        customer_email: "kunde@example.com",
        printful_order_id: 98765,
      })
    );
    expect(orderUpdateEq).toHaveBeenCalledWith("stripe_checkout_session_id", "cs_test_123");
    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ordered" })
    );
    expect(json).toEqual({ received: true });
  });
});
