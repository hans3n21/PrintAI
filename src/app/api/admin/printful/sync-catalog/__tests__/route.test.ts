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
            material: "Cotton",
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
    if (path === "/v2/catalog-products/71/images?colors=navy&limit=20") {
      return Promise.resolve({
        data: [],
        paging: { total: 0, offset: 0, limit: 20 },
      });
    }
    if (path === "/v2/catalog-products/71/images?colors=black,white&limit=20") {
      return Promise.resolve({
        data: [
          {
            catalog_variant_id: 4011,
            color: "Black",
            primary_hex_color: "#000000",
            images: [
              {
                placement: "front",
                image_url: "https://example.com/black-transparent-product.png",
                background_color: "#0f0f0f",
                background_image: "https://example.com/black-shirt.jpg",
                mockup_style_id: 239,
              },
            ],
          },
          {
            catalog_variant_id: 4015,
            color: "Black",
            primary_hex_color: "#000000",
            images: [
              {
                placement: "front",
                image_url: "https://example.com/black-transparent-product.png",
                background_color: "#000000",
                background_image: "https://example.com/black-shirt.jpg",
                mockup_style_id: 239,
              },
            ],
          },
          {
            catalog_variant_id: 4016,
            color: "Black",
            primary_hex_color: "#000000",
            images: [
              {
                placement: "back",
                image_url: "https://example.com/black-frontleft.png",
                background_color: "#000000",
                background_image: "",
                mockup_style_id: 240,
              },
            ],
          },
          {
            catalog_variant_id: 4012,
            color: "White",
            primary_hex_color: "#ffffff",
            images: [
              {
                placement: "front_large",
                image_url: "https://example.com/white-transparent-product.png",
                background_color: "#f8fafc",
                background_image: "https://example.com/white-shirt.jpg",
                mockup_style_id: 239,
              },
            ],
          },
        ],
        paging: { total: 2, offset: 0, limit: 20 },
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
    if (path === "/mockup-generator/templates/71") {
      return Promise.resolve({
        result: [
          {
            variant_id: 4011,
            placement: "front",
            image_url: "https://example.com/front-template.png",
            template_width: 560,
            template_height: 760,
            print_area_width: 520,
            print_area_height: 700,
            print_area_top: 30,
            print_area_left: 20,
          },
          {
            variant_id: 4012,
            placement: "front",
            image_url: "https://example.com/front-template.png",
            template_width: 560,
            template_height: 760,
            print_area_width: 520,
            print_area_height: 700,
            print_area_top: 30,
            print_area_left: 20,
          },
          {
            variant_id: 4014,
            placement: "front",
            image_url: "https://example.com/navy-template.png",
            template_width: 560,
            template_height: 760,
            print_area_width: 520,
            print_area_height: 700,
            print_area_top: 30,
            print_area_left: 20,
          },
        ],
      });
    }
    throw new Error(`Unexpected Printful path: ${path}`);
  });
}

function mockUpsert(options?: {
  existingVariants?: Array<Record<string, unknown>>;
  existingAssets?: Array<Record<string, unknown>>;
}) {
  const inFilter = vi.fn(() =>
    Promise.resolve({
      data: [
        {
          printful_product_id: 71,
          is_active: true,
          is_primary: true,
          sort_order: 9,
          ...(options?.existingVariants
            ? { variants: options.existingVariants }
            : {}),
        },
      ],
      error: null,
    })
  );
  const existingSelect = vi.fn(() => ({ in: inFilter }));
  const select = vi.fn(() =>
    Promise.resolve({
      data: [
        {
          id: "product-1",
          printful_product_id: 71,
          title: "Stored Shirt",
          is_active: true,
          is_primary: true,
          sort_order: 9,
        },
      ],
      error: null,
    })
  );
  const upsert = vi.fn(() => ({ select }));
  const colorUpsert = vi.fn(() => Promise.resolve({ error: null }));
  const assetUpsert = vi.fn(() => Promise.resolve({ error: null }));
  const assetChain: {
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: (resolve: (value: { data: unknown[]; error: null }) => void) => void;
  } = {
    eq: vi.fn(() => assetChain),
    in: vi.fn(() => assetChain),
    delete: vi.fn(() => assetChain),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    then: (resolve) => resolve({ data: options?.existingAssets ?? [], error: null }),
  };
  const assetSelect = vi.fn(() => assetChain);
  const assetUpdate = vi.fn(() => assetChain);
  let productTableCalls = 0;
  fromMock.mockImplementation((table: string) => {
    if (table === "printful_products") {
      productTableCalls += 1;
      return productTableCalls === 1 ? { select: existingSelect } : { upsert };
    }
    if (table === "printful_product_colors") return { upsert: colorUpsert };
    if (table === "printful_product_color_assets") {
      return { upsert: assetUpsert, select: assetSelect, update: assetUpdate, delete: assetChain.delete };
    }
    return {};
  });
  return { existingSelect, inFilter, select, upsert, colorUpsert, assetUpsert, assetChain };
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

  it("syncs product 71 by default and stores all available variants", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { inFilter, select, upsert } = mockUpsert();

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
      id: "product-1",
      printful_product_id: 71,
      is_active: true,
      is_primary: true,
      sort_order: 9,
    });
    expect(inFilter).toHaveBeenCalledWith("printful_product_id", [71]);
    expect(select).toHaveBeenCalledWith(expect.stringContaining("product_images"));
    const storedProduct = upsert.mock.calls[0][0][0];
    expect(storedProduct).toMatchObject({
      printful_product_id: 71,
      title: "Unisex Staple T-Shirt | Bella + Canvas 3001",
      slug: "unisex-staple-t-shirt-bella-canvas-3001",
      technique: "dtg",
      print_area: {
        placement: "front",
        area_width: 1800,
        area_height: 2400,
      },
      is_active: true,
      is_primary: true,
      sort_order: 9,
    });
    expect(storedProduct.variants).toEqual([
      {
        variant_id: 4013,
        size: "3XL",
        color: "Black",
        color_hex: "#000000",
        material: null,
        price_cents: null,
        stock: null,
      },
      {
        variant_id: 4011,
        size: "XS",
        color: "Black",
        color_hex: "#000000",
        material: "Cotton",
        price_cents: 1295,
        stock: "in_stock",
      },
      {
        variant_id: 4014,
        size: "M",
        color: "Navy",
        color_hex: "#111827",
        material: null,
        price_cents: null,
        stock: null,
      },
      {
        variant_id: 4012,
        size: "2XL",
        color: "White",
        color_hex: "#ffffff",
        material: null,
        price_cents: 1495,
        stock: "in_stock",
      },
    ]);
    expect(storedProduct.mockup_templates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        placement: "front",
        background_url: "https://example.com/front-template.png",
        catalog_variant_ids: [4011, 4012],
      }),
    ]));
    expect(storedProduct.product_images).toEqual(expect.arrayContaining([
      {
        catalog_variant_id: 4011,
        color: "Black",
        color_hex: "#000000",
        placement: "front",
        image_url: "https://example.com/black-transparent-product.png",
        background_color: "#0f0f0f",
        background_image: "https://example.com/black-shirt.jpg",
        mockup_style_id: 239,
      },
      {
        catalog_variant_id: 4012,
        color: "White",
        color_hex: "#ffffff",
        placement: "front_large",
        image_url: "https://example.com/white-transparent-product.png",
        background_color: "#f8fafc",
        background_image: "https://example.com/white-shirt.jpg",
        mockup_style_id: 239,
      },
    ]));
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

  it("keeps stored color/size subset when syncing without variantFilters", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { upsert } = mockUpsert({
      existingVariants: [
        { variant_id: 4011, color: "Black", size: "XS" },
        { variant_id: 4012, color: "White", size: "2XL" },
      ],
    });

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
      })
    );
    expect(response.status).toBe(200);

    const storedProduct = upsert.mock.calls[0][0][0];
    expect(storedProduct.variants).toEqual([
      {
        variant_id: 4011,
        size: "XS",
        color: "Black",
        color_hex: "#000000",
        material: "Cotton",
        price_cents: 1295,
        stock: "in_stock",
      },
      {
        variant_id: 4012,
        size: "2XL",
        color: "White",
        color_hex: "#ffffff",
        material: null,
        price_cents: 1495,
        stock: "in_stock",
      },
    ]);
  });

  it("uses request variantFilters when the client sends them", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { upsert } = mockUpsert({
      existingVariants: [
        { variant_id: 4011, color: "Black", size: "XS" },
        { variant_id: 4012, color: "White", size: "2XL" },
      ],
    });

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
        body: JSON.stringify({
          productIds: [71],
          variantFilters: {
            71: { colors: ["Navy"], sizes: ["M"] },
          },
        }),
      })
    );
    expect(response.status).toBe(200);

    const storedProduct = upsert.mock.calls[0][0][0];
    expect(storedProduct.variants).toEqual([
      {
        variant_id: 4014,
        size: "M",
        color: "Navy",
        color_hex: "#111827",
        material: null,
        price_cents: null,
        stock: null,
      },
    ]);
  });

  it("fetches product images for explicitly selected admin colors", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { upsert, colorUpsert, assetUpsert } = mockUpsert();

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
        body: JSON.stringify({
          productIds: [71],
          variantFilters: {
            "71": { colors: ["Black", "White"], sizes: ["XS", "2XL"] },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(getJsonMock).toHaveBeenCalledWith(
      "/v2/catalog-products/71/images?colors=black,white&limit=20"
    );
    const storedProduct = upsert.mock.calls[0][0][0];
    expect(colorUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ color_name: "Black", color_slug: "black" }),
        expect.objectContaining({ color_name: "White", color_slug: "white" }),
      ]),
      { onConflict: "printful_product_id,color_slug" }
    );
    expect(assetUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          color_slug: "black",
          placement: "front",
          image_url: "https://example.com/black-shirt.jpg",
          source: "printful",
        }),
        expect.objectContaining({
          color_slug: "white",
          placement: "front",
          image_url: "https://example.com/white-shirt.jpg",
          source: "printful",
        }),
        expect.objectContaining({
          color_slug: "black",
          placement: "side",
          image_url: "https://example.com/black-frontleft.png",
          source: "printful",
        }),
      ]),
      { onConflict: "printful_product_id,color_slug,placement,source,image_url" }
    );
    const upsertedAssets = assetUpsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    const blackFrontAssets = upsertedAssets.filter(
      (asset) =>
        asset.color_slug === "black" &&
        asset.placement === "front" &&
        asset.image_url === "https://example.com/black-shirt.jpg"
    );
    expect(blackFrontAssets).toHaveLength(1);
    expect(storedProduct.product_images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: "Black",
          background_image: "https://example.com/black-shirt.jpg",
        }),
        expect.objectContaining({
          color: "White",
          background_image: "https://example.com/white-shirt.jpg",
        }),
      ])
    );
    expect(storedProduct.mockup_templates).toEqual([
      expect.objectContaining({
        background_url: "https://example.com/front-template.png",
        catalog_variant_ids: [4011, 4012],
      }),
    ]);
  });

  it("preserves existing preferred asset and calibration while syncing", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { assetUpsert } = mockUpsert({
      existingAssets: [
        {
          printful_product_id: 71,
          color_slug: "black",
          placement: "front",
          source: "printful",
          image_url: "https://example.com/black-shirt.jpg",
          is_preferred: true,
          print_area_left: 25,
          print_area_top: 35,
          print_area_width: 500,
          print_area_height: 650,
        },
      ],
    });

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
        body: JSON.stringify({
          productIds: [71],
          variantFilters: {
            "71": { colors: ["Black", "White"], sizes: ["XS", "2XL"] },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(assetUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          image_url: "https://example.com/black-shirt.jpg",
          is_preferred: true,
          print_area_left: 25,
          print_area_top: 35,
          print_area_width: 500,
          print_area_height: 650,
        }),
      ]),
      { onConflict: "printful_product_id,color_slug,placement,source,image_url" }
    );
  });

  it("removes stale printful assets outside the current role candidates", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockPrintfulCatalog();
    const { assetChain } = mockUpsert({
      existingAssets: [
        {
          id: "asset-current",
          printful_product_id: 71,
          color_slug: "black",
          placement: "front",
          source: "printful",
          image_url: "https://example.com/black-shirt.jpg",
        },
        {
          id: "asset-stale",
          printful_product_id: 71,
          color_slug: "black",
          placement: "front_large",
          source: "printful",
          image_url: "https://example.com/old.png",
        },
      ],
    });

    const response = await POST(
      new Request("https://example.com/api/admin/printful/sync-catalog", {
        method: "POST",
        body: JSON.stringify({
          productIds: [71],
          variantFilters: {
            "71": { colors: ["Black", "White"], sizes: ["XS", "2XL"] },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(assetChain.delete).toHaveBeenCalled();
    expect(assetChain.in).toHaveBeenCalledWith("id", ["asset-stale"]);
  });
});
