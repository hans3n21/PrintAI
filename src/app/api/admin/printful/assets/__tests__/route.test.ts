import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE } from "@/lib/adminAuth";

const { cookiesMock, fromMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

import { GET, PATCH } from "../route";

function mockAdminCookie(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === ADMIN_COOKIE_NAME && value ? { value } : undefined,
  });
}

describe("PATCH /api/admin/printful/assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await PATCH(
      new Request("https://example.com/api/admin/printful/assets", {
        method: "PATCH",
        body: JSON.stringify({ id: "asset-1", is_preferred: true }),
      })
    );

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("sets one preferred asset and stores calibration fields", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const existingSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          id: "asset-1",
          printful_product_id: 307,
          color_slug: "white",
          placement: "front",
        },
        error: null,
      })
    );
    const existingEq = vi.fn(() => ({ single: existingSingle }));
    const existingSelect = vi.fn(() => ({ eq: existingEq }));
    const resetEq = vi.fn(() => ({ eq: resetEq }));
    const resetUpdate = vi.fn(() => ({ eq: resetEq }));
    const updateSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          id: "asset-1",
          is_preferred: true,
          print_area_left: 20,
          print_area_top: 30,
        },
        error: null,
      })
    );
    const updateSelect = vi.fn(() => ({ single: updateSingle }));
    const updateEq = vi.fn(() => ({ select: updateSelect }));
    const update = vi.fn(() => ({ eq: updateEq }));
    fromMock
      .mockReturnValueOnce({ select: existingSelect })
      .mockReturnValueOnce({ update: resetUpdate })
      .mockReturnValueOnce({ update });

    const response = await PATCH(
      new Request("https://example.com/api/admin/printful/assets", {
        method: "PATCH",
        body: JSON.stringify({
          id: "asset-1",
          is_preferred: true,
          print_area_left: 20,
          print_area_top: 30,
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(resetUpdate).toHaveBeenCalledWith({ is_preferred: false });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_preferred: true,
        print_area_left: 20,
        print_area_top: 30,
      })
    );
    expect(json.asset).toMatchObject({ id: "asset-1", is_preferred: true });
  });

  it("lists assets for a product", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const orderFinal = vi.fn(() =>
      Promise.resolve({
        data: [{ id: "asset-1", printful_product_id: 71, color_slug: "black" }],
        error: null,
      })
    );
    const chain: { order: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> } = {
      order: vi.fn(() => chain),
      eq: vi.fn(() => chain),
    };
    chain.order.mockImplementationOnce(() => chain);
    chain.order.mockImplementationOnce(() => chain);
    chain.order.mockImplementationOnce(() => chain);
    chain.order.mockImplementationOnce(() => orderFinal());
    const select = vi.fn(() => chain);
    fromMock.mockReturnValue({ select });

    const response = await GET(
      new Request("https://example.com/api/admin/printful/assets?productId=71")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("printful_product_id", 71);
    expect(json.assets).toEqual([{ id: "asset-1", printful_product_id: 71, color_slug: "black" }]);
  });
});
