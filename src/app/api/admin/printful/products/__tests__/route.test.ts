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

describe("/api/admin/printful/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects reads without admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("lists products ordered by sort_order", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const order = vi.fn(() =>
      Promise.resolve({ data: [{ id: "product-1", title: "Shirt" }], error: null })
    );
    const select = vi.fn(() => ({ order }));
    fromMock.mockReturnValue({ select });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.products).toEqual([{ id: "product-1", title: "Shirt" }]);
    expect(fromMock).toHaveBeenCalledWith("printful_products");
    expect(order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
      nullsFirst: false,
    });
  });

  it("updates active state and sort order via service-role client", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const single = vi.fn(() =>
      Promise.resolve({
        data: { id: "product-1", is_active: true, sort_order: 5 },
        error: null,
      })
    );
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    const response = await PATCH(
      new Request("https://example.com/api/admin/printful/products", {
        method: "PATCH",
        body: JSON.stringify({
          id: "product-1",
          is_active: true,
          sort_order: 5,
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.product).toMatchObject({ id: "product-1", is_active: true, sort_order: 5 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: true,
        sort_order: 5,
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "product-1");
  });
});
