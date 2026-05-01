import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE } from "@/lib/adminAuth";

const { cookiesMock, getJsonMock, fromMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getJsonMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/printful/client", () => ({
  getJson: getJsonMock,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

import { POST } from "../route";

function mockAdminCookie(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === ADMIN_COOKIE_NAME && value ? { value } : undefined,
  });
}

function mockPrintfulCatalog() {
  getJsonMock.mockImplementation((path: string) => {
    if (path === "/v2/catalog-products/71") {
      return Promise.resolve({
        data: {
          id: 71,
          name: "Unisex Staple T-Shirt | Bella + Canvas 3001",
          techniques: [
            { key: "dtg", display_name: "DTG printing", is_default: true },
          ],
          placements: [{ placement: "front", technique: "dtg" }],
        },
      });
    }
    if (path === "/v2/catalog-products/71/catalog-variants?limit=100&offset=0") {
      return Promise.resolve({
        data: [
          {
            id: 4011,
            size: "XS",
            color: "Black",
            color_code: "#000000",
          },
          {
            id: 4012,
            size: "2XL",
            color: "White",
            color_code: "#ffffff",
          },
          {
            id: 4013,
            size: "3XL",
            color: "Black",
            color_code: "#000000",
          },
          {
            id: 4014,
            size: "M",
            color: "Navy",
            color_code: "#111827",
          },
        ],
      });
    }
    if (path === "/v2/catalog-products/71/prices") {
      return Promise.resolve({
        data: {
          variants: [
            { id: 4011, techniques: [{ technique_key: "dtg", price: "12.95" }] },
            { id: 4012, techniques: [{ technique_key: "dtg", price: "14.95" }] },
          ],
        },
      });
    }
    if (path === "/v2/catalog-products/71/availability") {
      return Promise.resolve({
        data: [
          { catalog_variant_id: 4011, stock: "in_stock" },
          { catalog_variant_id: 4012, stock: "in_stock" },
        ],
      });
    }
    if (path === "/v2/catalog-products/71/mockup-styles?placements=front&limit=100") {
      return Promise.resolve({
        data: [
          {
            placement: "front",
            technique: "dtg",
            print_area_width: 12,
            print_area_height: 16,
            dpi: 150,
            mockup_styles: [{ id: 10, view_name: "Front" }],
          },
        ],
      });
    }
    if (path === "/v2/catalog-products/71/mockup-templates?placements=front&limit=100") {
      return Promise.resolve({
        data: [
          {
            placement: "front",
            catalog_variant_ids: [4011, 4012],
            image_url: "https://example.com/front-template.png",
            template_width: 560,
            template_height: 760,
            print_area_width: 520,
            print_area_height: 700,
            print_area_top: 30,
            print_area_left: 20,
          },
        ],
        paging: { total: 1, offset: 0, limit: 100 },
      });
    }
    throw new Error(`Unexpected Printful path: ${path}`);
  });
}

function mockUpsert() {
  const upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  fromMock.mockReturnValue({ upsert });
  return { upsert };
}

describe("POST /api/admin/printful/sync-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a valid admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
      })
    );

    expect(response.status).toBe(401);
    expect(getJsonMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("syncs product 71 by default and stores filtered Black/White XS-2XL variants", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { upsert } = mockUpsert();

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.synced).toBe(1);
    expect(json.products).toHaveLength(1);
    expect(json.products[0]).toMatchObject({
      printful_product_id: 71,
      title: "Unisex Staple T-Shirt | Bella + Canvas 3001",
      slug: "unisex-staple-t-shirt-bella-canvas-3001",
      technique: "dtg",
      print_area: {
        placement: "front",
        area_width: 1800,
        area_height: 2400,
      },
    });
    expect(json.products[0].variants).toEqual([
      {
        variant_id: 4011,
        size: "XS",
        color: "Black",
        color_hex: "#000000",
        price_cents: 1295,
        stock: "in_stock",
      },
      {
        variant_id: 4012,
        size: "2XL",
        color: "White",
        color_hex: "#ffffff",
        price_cents: 1495,
        stock: "in_stock",
      },
    ]);
    expect(json.products[0].mockup_templates).toEqual([
      expect.objectContaining({
        placement: "front",
        image_url: "https://example.com/front-template.png",
        catalog_variant_ids: [4011, 4012],
      }),
    ]);
    expect(fromMock).toHaveBeenCalledWith("printful_products");
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ printful_product_id: 71 })],
      { onConflict: "printful_product_id" }
    );
  });

  it("accepts selected product IDs from the request body", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    mockUpsert();

    await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
        body: JSON.stringify({ productIds: [71] }),
      })
    );

    expect(getJsonMock).toHaveBeenCalledWith("/v2/catalog-products/71");
  });
});
