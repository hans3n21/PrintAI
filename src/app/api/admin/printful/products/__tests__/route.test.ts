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

import { DELETE, GET, PATCH } from "../route";

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
    expect(select).toHaveBeenCalledWith(expect.stringContaining("is_primary"));
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

  it("marks one product as primary and active", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const single = vi.fn(() =>
      Promise.resolve({
        data: { id: "product-1", is_active: true, is_primary: true },
        error: null,
      })
    );
    const select = vi.fn(() => ({ single }));
    const eqTarget = vi.fn(() => ({ select }));
    const targetUpdate = vi.fn(() => ({ eq: eqTarget }));
    const neq = vi.fn(() => Promise.resolve({ error: null }));
    const resetUpdate = vi.fn(() => ({ neq }));
    fromMock
      .mockReturnValueOnce({ update: resetUpdate })
      .mockReturnValueOnce({ update: targetUpdate });

    const response = await PATCH(
      new Request("https://example.com/api/admin/printful/products", {
        method: "PATCH",
        body: JSON.stringify({
          id: "product-1",
          is_primary: true,
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.product).toMatchObject({ id: "product-1", is_active: true, is_primary: true });
    expect(resetUpdate).toHaveBeenCalledWith({ is_primary: false });
    expect(neq).toHaveBeenCalledWith("id", "product-1");
    expect(targetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: true,
        is_primary: true,
      })
    );
  });

  it("trims variants to the subset provided and updates shop_unit_price_cents", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const variantsSingle = vi.fn(() =>
      Promise.resolve({
        data: {
          variants: [
            { variant_id: 1, size: "M", color: "Black", price_cents: 1000 },
            { variant_id: 2, size: "L", color: "White", price_cents: 1200 },
          ],
        },
        error: null,
      })
    );
    const variantsEq = vi.fn(() => ({ single: variantsSingle }));
    const variantsSelect = vi.fn(() => ({ eq: variantsEq }));
    const upsertSingle = vi.fn(() =>
      Promise.resolve({
        data: { id: "product-1", shop_unit_price_cents: 1999, variants: [{ variant_id: 1 }] },
        error: null,
      })
    );
    const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
    const upsertEq = vi.fn(() => ({ select: upsertSelect }));
    const upsert = vi.fn(() => ({ eq: upsertEq }));
    fromMock
      .mockReturnValueOnce({ select: variantsSelect })
      .mockReturnValueOnce({ update: upsert });

    const response = await PATCH(
      new Request("https://example.com/api/admin/printful/products", {
        method: "PATCH",
        body: JSON.stringify({
          id: "product-1",
          shop_unit_price_cents: 1999,
          variants: [{ variant_id: 1 }],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(variantsSingle).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shop_unit_price_cents: 1999,
        variants: [{ variant_id: 1, size: "M", color: "Black", price_cents: 1000 }],
      })
    );
  });

  it("rejects deletes without admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await DELETE(
      new Request("https://example.com/api/admin/printful/products?id=product-1")
    );

    expect(response.status).toBe(401);
  });

  it("deletes a product by id", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const del = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ delete: del });

    const response = await DELETE(
      new Request("https://example.com/api/admin/printful/products?id=product-1")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "product-1");
  });
});
