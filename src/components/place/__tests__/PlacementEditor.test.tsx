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

  it("renders the product mockup template with the selected design inside the print area", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={product}
      />
    );

    expect(screen.getByRole("img", { name: "Bella Canvas 3001 Mockup" })).toHaveAttribute(
      "src",
      "https://example.com/black-front.png"
    );
    expect(screen.getByRole("img", { name: "Platziertes Design" })).toHaveAttribute(
      "src",
      "https://example.com/design.png"
    );
    expect(screen.getByTestId("placement-print-area")).toHaveAttribute(
      "data-area-width",
      "1800"
    );
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

    expect(screen.getByRole("img", { name: "Bella Canvas 3001 Mockup" })).toHaveAttribute(
      "src",
      "https://example.com/white-front.png"
    );
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

  it("renders a neutral shirt fallback when no Printful mockup template exists", () => {
    render(
      <PlacementEditor
        sessionId="session-1"
        designUrl="https://example.com/design.png"
        initialConfig={{}}
        product={{
          ...product,
          title: "Fallback Shirt",
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

  it("uses a renderable template image without losing print-area coordinates", () => {
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

    expect(screen.getByRole("img", { name: "Bella Canvas 3001 Mockup" })).toHaveAttribute(
      "src",
      "https://example.com/black-background.png"
    );
    expect(screen.queryByTestId("fallback-shirt-mockup")).not.toBeInTheDocument();
    expect(screen.getByTestId("placement-print-area")).toHaveStyle({
      left: "3.5714%",
      top: "3.9474%",
    });
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
