import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, getJsonMock, postJsonMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getJsonMock: vi.fn(),
  postJsonMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

vi.mock("@/lib/printful/client", () => ({
  getJson: getJsonMock,
  postJson: postJsonMock,
}));

import { POST } from "../route";

function mockSessionSelect(session: Record<string, unknown>) {
  const single = vi.fn(() => Promise.resolve({ data: session, error: null }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select };
}

function mockProductSelect(product: Record<string, unknown>) {
  const single = vi.fn(() => Promise.resolve({ data: product, error: null }));
  const eqProduct = vi.fn(() => ({ single }));
  const eqActive = vi.fn(() => ({ eq: eqProduct }));
  const select = vi.fn(() => ({ eq: eqActive }));
  return { select };
}

function mockSessionUpdate() {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq };
}

describe("POST /api/printful/mockup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a sessionId", async () => {
    const response = await POST(
      new Request("https://example.com/api/printful/mockup", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(postJsonMock).not.toHaveBeenCalled();
  });

  it("creates and polls a Printful mockup task, then stores mockup urls on the session", async () => {
    const sessionQuery = mockSessionSelect({
      product_selection: { size: "M" },
      config: {
        product_color: "black",
        sizes: { Ada: "M" },
        print_file: { url: "https://storage.example.com/print-file.png" },
        placement: {
          placement: "front_large",
          area_width: 1800,
          area_height: 2400,
          width: 1200,
          height: 1500,
          top: 300,
          left: 250,
        },
      },
    });
    const productQuery = mockProductSelect({
      printful_product_id: 71,
      print_area: {
        placement: "front_large",
        area_width: 1800,
        area_height: 2400,
      },
      variants: [
        { variant_id: 4011, size: "M", color: "Black" },
        { variant_id: 4012, size: "M", color: "White" },
        { variant_id: 4013, size: "L", color: "Black" },
      ],
    });
    const sessionUpdate = mockSessionUpdate();
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        const sessionCalls = fromMock.mock.calls.filter(([name]) => name === "sessions").length;
        return sessionCalls === 1 ? { select: sessionQuery.select } : { update: sessionUpdate.update };
      }
      if (table === "printful_products") return { select: productQuery.select };
      return {};
    });
    postJsonMock.mockResolvedValue({ result: { task_key: "task-123" } });
    getJsonMock.mockResolvedValue({
      result: {
        status: "completed",
        mockups: [
          { variant_id: 4011, mockup_url: "https://mockups.example.com/black.png" },
          { variant_id: 4012, mockup_url: "https://mockups.example.com/white.png" },
        ],
      },
    });

    const response = await POST(
      new Request("https://example.com/api/printful/mockup", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(postJsonMock).toHaveBeenCalledWith(
      "/mockup-generator/create-task/71",
      {
        variant_ids: [4011, 4012],
        format: "png",
        files: [
          {
            placement: "front_large",
            image_url: "https://storage.example.com/print-file.png",
            position: {
              area_width: 1800,
              area_height: 2400,
              width: 1200,
              height: 1500,
              top: 300,
              left: 250,
            },
          },
        ],
      }
    );
    expect(getJsonMock).toHaveBeenCalledWith(
      "/mockup-generator/task?task_key=task-123"
    );
    expect(sessionUpdate.update).toHaveBeenCalledWith({
      config: expect.objectContaining({
        mockups: [
          { variant_id: 4011, mockup_url: "https://mockups.example.com/black.png", color: "Black" },
          { variant_id: 4012, mockup_url: "https://mockups.example.com/white.png", color: "White" },
        ],
      }),
      updated_at: expect.any(String),
    });
    expect(json).toEqual({
      mockups: [
        { variant_id: 4011, mockup_url: "https://mockups.example.com/black.png", color: "Black" },
        { variant_id: 4012, mockup_url: "https://mockups.example.com/white.png", color: "White" },
      ],
    });
  });
});
