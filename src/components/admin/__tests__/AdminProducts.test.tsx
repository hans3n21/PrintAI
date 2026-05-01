import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminProducts } from "../AdminProducts";

const product = {
  id: "product-1",
  printful_product_id: 71,
  title: "Unisex Staple T-Shirt",
  slug: "unisex-staple-t-shirt",
  technique: "dtg",
  variants: [
    { variant_id: 4011, size: "XS", color: "Black" },
    { variant_id: 4012, size: "S", color: "White" },
  ],
  product_images: [
    {
      catalog_variant_id: 4011,
      color: "Black",
      placement: "front_large",
      image_url: "https://example.com/black-product-transparent.png",
      background_image: "https://example.com/black-shirt.jpg",
      background_color: "#0f0f0f",
    },
    {
      catalog_variant_id: 4012,
      color: "White",
      placement: "front_large",
      image_url: "https://example.com/white-product-transparent.png",
      background_image: "https://example.com/white-shirt.jpg",
      background_color: "#f8fafc",
    },
  ],
  mockup_templates: [{ image_url: "https://example.com/mockup.png" }],
  is_active: false,
  is_primary: false,
  sort_order: 3,
};

const pricingResponse = {
  pricing: { markup_percent: 50, markup_fixed_cents: 0 },
  shipping_rates: [
    {
      country_code: "DE",
      label: "Deutschland",
      amount_cents: 499,
      free_from_cents: 7500,
      enabled: true,
    },
  ],
};

describe("AdminProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists printful products as cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ products: [product] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pricingResponse,
        })
    );

    render(<AdminProducts />);

    expect(await screen.findByText("Unisex Staple T-Shirt")).toBeInTheDocument();
    expect(screen.getByText("2 Varianten")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Unisex Staple T-Shirt Cover" })).toHaveAttribute(
      "src",
      "https://example.com/black-shirt.jpg"
    );
    expect(screen.getByLabelText("Sortierung fuer Unisex Staple T-Shirt")).toHaveValue(3);
  });

  it("searches Printful products, previews their print data, and integrates selected products", async () => {
    const previewProduct = {
      printful_product_id: 155,
      title: "Premium Hoodie",
      technique: "dtg",
      variants: [
        { variant_id: 9001, size: "M", color: "Black", price_cents: 1800, material: "Cotton" },
        { variant_id: 9002, size: "L", color: "White", price_cents: 1800, material: "Cotton" },
        { variant_id: 9003, size: "XL", color: "Red", price_cents: 2000, material: "Cotton" },
      ],
      product_images: [
        {
          catalog_variant_id: 9001,
          color: "Black",
          placement: "front_large",
          image_url: "https://example.com/hoodie-transparent.png",
          background_image: "https://example.com/hoodie-shirt.jpg",
        },
      ],
      print_area: { placement: "front", area_width: 2100, area_height: 2700 },
      mockup_templates: [],
    };
    const integratedProduct = {
      ...product,
      id: "product-155",
      printful_product_id: 155,
      title: "Premium Hoodie",
      slug: "premium-hoodie",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [product] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pricingResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [previewProduct] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: 1, products: [integratedProduct] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminProducts />);
    fireEvent.change(await screen.findByLabelText("Printful Produkt suchen"), {
      target: { value: "hoodie" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suchen" }));

    expect(await screen.findByText("Premium Hoodie")).toBeInTheDocument();
    expect(screen.getAllByText("3 Varianten").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("img", { name: "Premium Hoodie Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/hoodie-shirt.jpg"
    );
    expect(screen.getByText("Druckfläche: 2100 x 2700 px")).toBeInTheDocument();
    expect(screen.getByText("Printful ab 18,00 €")).toBeInTheDocument();
    expect(screen.getByText("Shop ab 27,00 €")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Details für Premium Hoodie anzeigen" }));
    fireEvent.click(screen.getByRole("button", { name: "Alle Farben anzeigen (Premium Hoodie)" }));
    expect(screen.getByLabelText("Premium Hoodie Farbe Black")).toBeChecked();
    expect(screen.getByLabelText("Premium Hoodie Farbe White")).toBeChecked();
    expect(screen.getByLabelText("Premium Hoodie Farbe Red")).not.toBeChecked();
    expect(screen.getByText("Materialien")).toBeInTheDocument();
    expect(screen.getByLabelText("Premium Hoodie Größe M")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Premium Hoodie Größe XL"));

    fireEvent.click(screen.getByRole("button", { name: "Premium Hoodie integrieren" }));

    await screen.findByText("1 Produkt synchronisiert.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/printful/catalog-search?query=hoodie",
      { cache: "no-store" }
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/printful/sync-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productIds: [155],
        variantFilters: {
          "155": {
            colors: ["Black", "White"],
            sizes: ["M", "L"],
          },
        },
      }),
    });
  });

  it("shows cost, shop price, sizes and materials for integrated products on demand", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [
            {
              ...product,
              is_active: true,
              variants: [
                { variant_id: 4011, size: "M", color: "Black", price_cents: 1200, material: "Cotton" },
                { variant_id: 4012, size: "L", color: "White", price_cents: 1400, material: "Cotton" },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pricingResponse,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminProducts />);

    expect(await screen.findByText("Unisex Staple T-Shirt")).toBeInTheDocument();
    expect(screen.getByText("Printful ab 12,00 €")).toBeInTheDocument();
    expect(screen.getByText("Shop ab 18,00 €")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Details für Unisex Staple T-Shirt anzeigen" }));

    expect(screen.getByText("Größen")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("Materialien")).toBeInTheDocument();
    expect(screen.getByText("Cotton")).toBeInTheDocument();
  });

  it("updates the integrated cover when the current admin color selection changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [product] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pricingResponse,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          product: {
            ...product,
            variants: [{ variant_id: 4012, size: "S", color: "White" }],
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminProducts />);

    expect(await screen.findByRole("img", { name: "Unisex Staple T-Shirt Cover" })).toHaveAttribute(
      "src",
      "https://example.com/black-shirt.jpg"
    );

    fireEvent.click(screen.getByRole("button", { name: "Details für Unisex Staple T-Shirt anzeigen" }));
    fireEvent.click(screen.getByLabelText("Unisex Staple T-Shirt Farbe Black"));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Unisex Staple T-Shirt Cover" })).toHaveAttribute(
        "src",
        "https://example.com/white-shirt.jpg"
      );
    });
  });

  it("uses the derived admin color selection for the initial integrated cover", async () => {
    const navyWhiteProduct = {
      ...product,
      variants: [
        { variant_id: 4013, size: "M", color: "Navy" },
        { variant_id: 4012, size: "S", color: "White" },
      ],
      product_images: [
        {
          catalog_variant_id: 4013,
          color: "Navy",
          placement: "front_large",
          image_url: "https://example.com/navy-product-transparent.png",
          background_image: "https://example.com/navy-shirt.jpg",
          background_color: "#111827",
        },
        {
          catalog_variant_id: 4012,
          color: "White",
          placement: "front_large",
          image_url: "https://example.com/white-product-transparent.png",
          background_image: "https://example.com/white-shirt.jpg",
          background_color: "#f8fafc",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ products: [navyWhiteProduct] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pricingResponse,
        })
    );

    render(<AdminProducts />);

    expect(await screen.findByRole("img", { name: "Unisex Staple T-Shirt Cover" })).toHaveAttribute(
      "src",
      "https://example.com/white-shirt.jpg"
    );
  });

  it("syncs the catalog and replaces the product list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pricingResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ synced: 1, products: [product] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Katalog synchronisieren" }));

    await screen.findByText("Unisex Staple T-Shirt");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/printful/sync-catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  });

  it("persists active state and sort order changes directly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [product] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => pricingResponse,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ product: { ...product, is_active: true, sort_order: 5 } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminProducts />);

    fireEvent.click(await screen.findByLabelText("Unisex Staple T-Shirt aktivieren"));
    fireEvent.change(screen.getByLabelText("Sortierung fuer Unisex Staple T-Shirt"), {
      target: { value: "5" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/printful/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "product-1", is_active: true }),
      });
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/printful/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "product-1", sort_order: 5 }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Unisex Staple T-Shirt als Hauptprodukt nutzen" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/printful/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "product-1", is_primary: true }),
    });
  });
});
