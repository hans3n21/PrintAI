import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlacementEditor } from "../PlacementEditor";

const { updateMock, eqMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: updateMock,
    })),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}));

const product = {
  id: "product-1",
  title: "Bella Canvas 3001",
  variants: [
    { variant_id: 4011, color: "Black", color_hex: "#000000" },
    { variant_id: 4012, color: "White", color_hex: "#ffffff" },
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
  print_area: {
    placement: "front_large",
    area_width: 1800,
    area_height: 2400,
  },
  mockup_templates: [
    {
      placement: "front_large",
      catalog_variant_ids: [4011],
      image_url: "https://example.com/black-front.png",
      background_url: "https://example.com/black-front-background.png",
      print_area_width: 520,
      print_area_height: 700,
      print_area_left: 20,
      print_area_top: 30,
      template_width: 560,
      template_height: 760,
    },
    {
      placement: "front_large",
      catalog_variant_ids: [4012],
      image_url: "https://example.com/white-front.png",
      background_url: "https://example.com/white-front-background.png",
      print_area_width: 520,
      print_area_height: 700,
      print_area_left: 20,
      print_area_top: 30,
      template_width: 560,
      template_height: 760,
    },
  ],
};

describe("PlacementEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
  });

  it("prefers Printful product images over white-background mockup templates", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={product}
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/black-shirt.jpg"
    );
    expect(screen.getByTestId("mockup-preview-stage")).toHaveStyle({
      backgroundColor: "#0f0f0f",
    });
    expect(screen.getByRole("img", { name: "Platziertes Design" })).toHaveAttribute(
      "src",
      "https://example.com/design.png"
    );
    expect(screen.getByTestId("placement-print-area")).toHaveAttribute(
      "data-area-width",
      "1800"
    );
  });

  it("renders product mockups in a polished preview stage without changing print-area coordinates", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={product}
      />
    );

    expect(screen.getByTestId("mockup-preview-stage")).toHaveClass("bg-zinc-950");
    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveClass(
      "absolute",
      "object-cover"
    );
    expect(screen.getByTestId("placement-print-area")).toHaveStyle({
      left: "3.5714%",
      top: "3.9474%",
    });
  });

  it("switches between black and white product mockups", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={product}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "White" }));

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/white-shirt.jpg"
    );
  });

  it("switches the preview image when colorOverride changes", () => {
    const { rerender } = render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={product}
        colorOverride="black"
        hideNavigation
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/black-shirt.jpg"
    );

    rerender(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={product}
        colorOverride="white"
        hideNavigation
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/white-shirt.jpg"
    );
  });

  it("uses the preferred relational asset and its calibration for the selected color", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "white" }}
        product={{
          ...product,
          color_assets: [
            {
              id: "asset-1",
              color_slug: "white",
              placement: "front_large",
              image_url: "https://example.com/preferred-white.png",
              is_preferred: true,
              template_width: 600,
              template_height: 800,
              print_area_left: 60,
              print_area_top: 120,
              print_area_width: 300,
              print_area_height: 400,
            },
          ],
        }}
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/preferred-white.png"
    );
    expect(screen.getByTestId("placement-print-area")).toHaveStyle({
      left: "10.0000%",
      top: "15.0000%",
      width: "50.0000%",
      height: "50.0000%",
    });
  });

  it("keeps bright Printful image backgrounds out of the dark editor stage", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "white" }}
        product={product}
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/white-shirt.jpg"
    );
    expect(screen.getByTestId("mockup-preview-stage")).not.toHaveStyle({
      backgroundColor: "#f8fafc",
    });
  });

  it("falls back to a matching template background when no product image exists", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={{
          ...product,
          product_images: [],
        }}
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/black-front-background.png"
    );
    expect(screen.getByTestId("placement-print-area")).toHaveStyle({
      left: "3.5714%",
      top: "3.9474%",
    });
  });

  it("saves placement coordinates in print-file pixels", async () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "black" }}
        product={product}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Weiter zur Konfiguration" }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        config: expect.objectContaining({
          product_color: "black",
          placement: {
            placement: "front_large",
            top: 360,
            left: 270,
            width: 1260,
            height: 1680,
          },
        }),
        status: "configuring",
      });
    });
    expect(eqMock).toHaveBeenCalledWith("id", "session-1");
  });

  it("resizes the placement proportionally from the corner handle", async () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "black" }}
        product={product}
      />
    );
    const printArea = screen.getByTestId("placement-print-area");
    printArea.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1800,
      bottom: 2400,
      width: 1800,
      height: 2400,
      toJSON: () => ({}),
    }));
    const resizeHandle = screen.getByRole("button", { name: "Design skalieren" });
    resizeHandle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(resizeHandle, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(resizeHandle, { pointerId: 1, clientX: -600, clientY: 0 });
    fireEvent.pointerUp(resizeHandle, { pointerId: 1, clientX: -600, clientY: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Weiter zur Konfiguration" }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        config: expect.objectContaining({
          placement: {
            placement: "front_large",
            top: 360,
            left: 270,
            width: 660,
            height: 880,
          },
        }),
        status: "configuring",
      });
    });
  });

  it("toggles placement handles when the placed design is clicked", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "black" }}
        product={product}
      />
    );

    const design = screen.getByRole("button", { name: "Design platzieren" });
    expect(screen.getByTestId("placement-print-area")).toHaveClass("border-violet-300/70");
    expect(screen.getByRole("button", { name: "Design skalieren" })).toBeInTheDocument();

    fireEvent.click(design);

    expect(screen.getByTestId("placement-print-area")).not.toHaveClass("border-violet-300/70");
    expect(screen.queryByRole("button", { name: "Design skalieren" })).not.toBeInTheDocument();

    fireEvent.click(design);

    expect(screen.getByTestId("placement-print-area")).toHaveClass("border-violet-300/70");
    expect(screen.getByRole("button", { name: "Design skalieren" })).toBeInTheDocument();
  });

  it("keeps placement handles visible after dragging the placed design", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "black" }}
        product={product}
      />
    );
    const printArea = screen.getByTestId("placement-print-area");
    printArea.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1800,
      bottom: 2400,
      width: 1800,
      height: 2400,
      toJSON: () => ({}),
    }));
    const design = screen.getByRole("button", { name: "Design platzieren" });
    design.setPointerCapture = vi.fn();

    fireEvent.pointerDown(design, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(design, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(design, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.click(design);

    expect(screen.getByTestId("placement-print-area")).toHaveClass("border-violet-300/70");
    expect(screen.getByRole("button", { name: "Design skalieren" })).toBeInTheDocument();
  });

  it("renders a neutral shirt fallback when no Printful mockup template exists", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={{
          ...product,
          title: "Fallback Shirt",
          product_images: [],
          mockup_templates: [],
        }}
      />
    );

    expect(screen.getByTestId("fallback-shirt-mockup")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Platziertes Design" })).toHaveAttribute(
      "src",
      "https://example.com/design.png"
    );
  });

  it("uses template geometry while showing a matching template background image", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={{
          ...product,
          product_images: [],
          mockup_templates: [
            {
              placement: "front_large",
              catalog_variant_ids: [4011],
              print_area_width: 520,
              print_area_height: 700,
              print_area_left: 20,
              print_area_top: 30,
              template_width: 560,
              template_height: 760,
            },
            {
              placement: "front_large",
              catalog_variant_ids: [4011],
              background_url: "https://example.com/black-background.png",
            },
          ],
        }}
      />
    );

    expect(screen.getByRole("img", { name: "Shirt-Vorschau" })).toHaveAttribute(
      "src",
      "https://example.com/black-background.png"
    );
    expect(screen.getByTestId("placement-print-area")).toHaveStyle({
      left: "3.5714%",
      top: "3.9474%",
    });
  });

  it("does not show a black template background for a white selected color", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{ product_color: "white" }}
        product={{
          ...product,
          product_images: [],
          mockup_templates: [
            {
              placement: "front_large",
              catalog_variant_ids: [4011, 4012],
              background_url: "https://example.com/black-background.png",
              background_color: "#000000",
              print_area_width: 520,
              print_area_height: 700,
              print_area_left: 20,
              print_area_top: 30,
              template_width: 560,
              template_height: 760,
            },
          ],
        }}
      />
    );

    expect(screen.queryByRole("img", { name: "Shirt-Vorschau" })).not.toBeInTheDocument();
    expect(screen.getByTestId("fallback-shirt-mockup")).toBeInTheDocument();
  });

  it("renders the fallback shirt in the selected swatch color", () => {
    const { container } = render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={{
          ...product,
          product_images: [],
          mockup_templates: [],
        }}
        colorOptions={[{ id: "red", label: "Red", hex: "#e11d48" }]}
        colorOverride="red"
        hideNavigation
      />
    );

    expect(screen.getByTestId("fallback-shirt-mockup")).toBeInTheDocument();
    expect(container.querySelector("path")).toHaveAttribute("fill", "#e11d48");
  });

  it("uses a chest-sized print area fallback when template coordinates are missing", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={{
          ...product,
          mockup_templates: [
            {
              placement: "front_large",
              catalog_variant_ids: [4011],
              image_url: "https://example.com/black-front-without-area.png",
            },
          ],
        }}
      />
    );

    const printArea = screen.getByTestId("placement-print-area");
    expect(printArea).toHaveStyle({ left: "54px" });
    expect(printArea).toHaveStyle({ top: "133px" });
    expect(printArea).not.toHaveStyle({ left: "0%" });
    expect(printArea).not.toHaveStyle({ top: "0%" });
    expect(printArea).not.toHaveStyle({ width: "100%" });
    expect(printArea).not.toHaveStyle({ height: "100%" });
  });
});
