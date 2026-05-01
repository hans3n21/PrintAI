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
  mockup_templates: [{ image_url: "https://example.com/mockup.png" }],
  is_active: false,
  sort_order: 3,
};

describe("AdminProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists printful products as cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ products: [product] }),
      })
    );

    render(<AdminProducts />);

    expect(await screen.findByText("Unisex Staple T-Shirt")).toBeInTheDocument();
    expect(screen.getByText("2 Varianten")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Unisex Staple T-Shirt Cover" })).toHaveAttribute(
      "src",
      "https://example.com/mockup.png"
    );
    expect(screen.getByLabelText("Sortierung fuer Unisex Staple T-Shirt")).toHaveValue(3);
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
        json: async () => ({ synced: 1, products: [product] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminProducts />);
    fireEvent.click(await screen.findByRole("button", { name: "Katalog synchronisieren" }));

    await screen.findByText("Unisex Staple T-Shirt");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/printful/sync-catalog", {
      method: "POST",
    });
  });

  it("persists active state and sort order changes directly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [product] }),
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
  });
});
