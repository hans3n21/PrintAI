import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE } from "@/lib/adminAuth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, getJsonMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  getJsonMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/printful/client", () => ({
  getJson: getJsonMock,
}));

import { GET } from "../route";

function mockAdminCookie(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === ADMIN_COOKIE_NAME && value ? { value } : undefined,
  });
}

function mockPreviewProduct(productId = 155) {
  getJsonMock.mockImplementation((path: string) => {
    if (path === `/v2/catalog-products/${productId}`) {
      return Promise.resolve({
        data: {
          id: productId,
          name: "Premium Hoodie",
          techniques: [{ key: "dtg", is_default: true }],
          placements: [{ placement: "front", technique: "dtg" }],
        },
      });
    }
    if (path === `/v2/catalog-products/${productId}/catalog-variants?limit=100&offset=0`) {
      return Promise.resolve({
        data: [
          { id: 9001, size: "M", color: "Black", color_code: "#000000", material: "Cotton" },
          { id: 9002, size: "L", color: "Black", color_code: "#000000", material: "Cotton" },
        ],
      });
    }
    if (path === `/v2/catalog-products/${productId}/prices`) {
      return Promise.resolve({
        data: {
          variants: [{ id: 9001, techniques: [{ technique_key: "dtg", price: "18.00" }] }],
        },
      });
    }
    if (path.startsWith(`/v2/catalog-products/${productId}/images?placement=front&colors=`)) {
      return Promise.resolve({
        data: [
          {
            catalog_variant_id: 9001,
            color: "Black",
            primary_hex_color: "#000000",
            images: [
              {
                placement: "front",
                image_url: "https://example.com/hoodie-transparent.png",
                background_color: "#111111",
                background_image: null,
                mockup_style_id: 7,
              },
            ],
          },
        ],
      });
    }
    if (path === `/v2/catalog-products/${productId}/mockup-styles?placements=front&limit=100`) {
      return Promise.resolve({
        data: [{ placement: "front", print_area_width: 14, print_area_height: 18, dpi: 150 }],
      });
    }
    if (path === `/v2/catalog-products/${productId}/mockup-templates?placements=front&limit=100`) {
      return Promise.resolve({ data: [], paging: { total: 0, limit: 100, offset: 0 } });
    }
    throw new Error(`Unexpected Printful path: ${path}`);
  });
}

function mockPreviewProductForSearch() {
  getJsonMock.mockImplementation((path: string) => {
    if (path === "/v2/catalog-products?limit=100&offset=0") {
      return Promise.resolve({
        data: [
          { id: 1, name: "Enhanced Matte Paper Poster (in)" },
          { id: 2, name: "Enhanced Matte Paper Framed Poster (in)" },
          { id: 155, name: "Premium Hoodie" },
        ],
        paging: { total: 3, limit: 100, offset: 0 },
      });
    }
    if (path === "/v2/catalog-products/155") {
      return Promise.resolve({
        data: {
          id: 155,
          name: "Premium Hoodie",
          techniques: [{ key: "dtg", is_default: true }],
          placements: [{ placement: "front", technique: "dtg" }],
        },
      });
    }
    if (path === "/v2/catalog-products/155/catalog-variants?limit=100&offset=0") {
      return Promise.resolve({
        data: [
          { id: 9001, size: "M", color: "Black", color_code: "#000000", material: "Cotton" },
          { id: 9002, size: "L", color: "Black", color_code: "#000000", material: "Cotton" },
        ],
      });
    }
    if (path === "/v2/catalog-products/155/prices") {
      return Promise.resolve({
        data: {
          variants: [{ id: 9001, techniques: [{ technique_key: "dtg", price: "18.00" }] }],
        },
      });
    }
    if (path.startsWith("/v2/catalog-products/155/images?placement=front&colors=")) {
      return Promise.resolve({ data: [] });
    }
    if (path === "/v2/catalog-products/155/mockup-styles?placements=front&limit=100") {
      return Promise.resolve({
        data: [{ placement: "front", print_area_width: 14, print_area_height: 18, dpi: 150 }],
      });
    }
    if (path === "/v2/catalog-products/155/mockup-templates?placements=front&limit=100") {
      return Promise.resolve({ data: [], paging: { total: 0, limit: 100, offset: 0 } });
    }
    throw new Error(`Unexpected Printful path: ${path}`);
  });
}

describe("GET /api/admin/printful/catalog-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await GET(new Request("https://example.com/api/admin/printful/catalog-search?query=155"));

    expect(response.status).toBe(401);
    expect(getJsonMock).not.toHaveBeenCalled();
  });

  it("returns a normalized preview for a Printful product id", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPreviewProduct();

    const response = await GET(new Request("https://example.com/api/admin/printful/catalog-search?query=155"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.products[0]).toMatchObject({
      printful_product_id: 155,
      title: "Premium Hoodie",
      technique: "dtg",
      print_area: {
        placement: "front",
        area_width: 2100,
        area_height: 2700,
      },
    });
    expect(json.products[0].variants).toHaveLength(2);
    expect(json.products[0].variants[0]).toMatchObject({
      variant_id: 9001,
      price_cents: 1800,
      material: "Cotton",
    });
    expect(json.products[0].product_images[0].image_url).toBe(
      "https://example.com/hoodie-transparent.png"
    );
  });

  it("searches products by keyword and previews matching ids", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPreviewProductForSearch();

    const response = await GET(new Request("https://example.com/api/admin/printful/catalog-search?query=hoodie"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.products).toHaveLength(1);
    expect(json.products[0].printful_product_id).toBe(155);
    expect(getJsonMock).not.toHaveBeenCalledWith("/v2/catalog-products/1");
  });
});
