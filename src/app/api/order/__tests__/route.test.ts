import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, postJsonMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  postJsonMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

vi.mock("@/lib/printful/client", () => ({
  postJson: postJsonMock,
}));

import { POST } from "../route";

function mockSessionSelect(session: Record<string, unknown>) {
  const single = vi.fn(() => Promise.resolve({ data: session, error: null }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

function mockInsert() {
  const insert = vi.fn(() => Promise.resolve({ error: null }));
  return { insert };
}

function mockUpdate() {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  return { update };
}

describe("POST /api/order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a sessionId", async () => {
    const response = await POST(
      new Request("https://example.com/api/order", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(postJsonMock).not.toHaveBeenCalled();
  });

  it("creates a Printful draft order and stores the Printful order id", async () => {
    const sessionQuery = mockSessionSelect({
      config: {
        quantity: 3,
        print_file: { url: "https://storage.example.com/print-file.png" },
      },
      product_selection: {
        printful_variant_id: 4011,
        size: "M",
        color: "Black",
      },
    });
    const orderInsert = mockInsert();
    const sessionUpdate = mockUpdate();
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        const sessionCalls = fromMock.mock.calls.filter(([name]) => name === "sessions").length;
        return sessionCalls === 1 ? { select: sessionQuery.select } : { update: sessionUpdate.update };
      }
      if (table === "orders") return { insert: orderInsert.insert };
      return {};
    });
    postJsonMock.mockResolvedValue({
      result: {
        id: 98765,
        status: "draft",
        dashboard_url: "https://www.printful.com/dashboard/default/orders/98765",
      },
    });

    const response = await POST(
      new Request("https://example.com/api/order", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(postJsonMock).toHaveBeenCalledWith("/orders", {
      recipient: expect.objectContaining({
        name: "PrintAI Testkunde",
        country_code: "DE",
      }),
      items: [
        {
          variant_id: 4011,
          quantity: 3,
          files: [
            {
              type: "front_large",
              url: "https://storage.example.com/print-file.png",
            },
          ],
        },
      ],
      confirm: false,
    });
    expect(orderInsert.insert).toHaveBeenCalledWith({
      session_id: "session-1",
      status: "draft",
      printful_order_id: 98765,
      total_cents: null,
      line_items: expect.objectContaining({
        printful_order: expect.objectContaining({ id: 98765 }),
      }),
    });
    expect(json).toEqual({
      order_id: "98765",
      status: "draft",
      dashboard_url: "https://www.printful.com/dashboard/default/orders/98765",
    });
  });
});
