import { describe, expect, it } from "vitest";
import {
  choosePrintfulPreview,
  type PrintfulPreviewImage,
  type PrintfulPreviewTemplate,
  type PrintfulPreviewVariant,
} from "../productPreviewImages";

const variants: PrintfulPreviewVariant[] = [
  { variant_id: 101, color: "Black", color_hex: "#000000" },
  { variant_id: 102, color: "White", color_hex: "#ffffff" },
  { variant_id: 103, color: "Navy", color_hex: "#111827" },
];

describe("choosePrintfulPreview", () => {
  it("prefers a background_image for the requested color", () => {
    const images: PrintfulPreviewImage[] = [
      {
        catalog_variant_id: 101,
        color: "Black",
        placement: "front_large",
        image_url: "https://example.com/black-transparent.png",
        background_image: "https://example.com/black-shirt.jpg",
      },
      {
        catalog_variant_id: 102,
        color: "White",
        placement: "front_large",
        image_url: "https://example.com/white-transparent.png",
        background_image: "https://example.com/white-shirt.jpg",
      },
    ];

    expect(
      choosePrintfulPreview({ images, templates: [], variants, color: "white", placement: "front_large" })
    ).toMatchObject({
      src: "https://example.com/white-shirt.jpg",
      source: "product-background",
      image: expect.objectContaining({ color: "White" }),
    });
  });

  it("falls back to a matching template background before transparent image_url", () => {
    const images: PrintfulPreviewImage[] = [
      {
        catalog_variant_id: 103,
        color: "Navy",
        placement: "front",
        image_url: "https://example.com/navy-transparent.png",
      },
    ];
    const templates: PrintfulPreviewTemplate[] = [
      {
        placement: "front_large",
        catalog_variant_ids: [103],
        background_url: "https://example.com/navy-template.jpg",
      },
    ];

    expect(
      choosePrintfulPreview({ images, templates, variants, color: "navy", placement: "front_large" })
    ).toMatchObject({
      src: "https://example.com/navy-template.jpg",
      source: "template-background",
    });
  });

  it("does not choose a different color while a matching transparent image exists", () => {
    const images: PrintfulPreviewImage[] = [
      {
        catalog_variant_id: 101,
        color: "Black",
        placement: "front_large",
        background_image: "https://example.com/black-shirt.jpg",
      },
      {
        catalog_variant_id: 102,
        color: "White",
        placement: "front_large",
        image_url: "https://example.com/white-transparent.png",
      },
    ];

    expect(
      choosePrintfulPreview({ images, templates: [], variants, color: "white", placement: "front_large" })
    ).toMatchObject({
      src: "https://example.com/white-transparent.png",
      source: "product-transparent",
    });
  });

  it("prefers a matching real shirt photo over an earlier transparent image", () => {
    const images: PrintfulPreviewImage[] = [
      {
        catalog_variant_id: 102,
        color: "White",
        placement: "front_large",
        image_url: "https://example.com/white-transparent.png",
      },
      {
        catalog_variant_id: 102,
        color: "White",
        placement: "front_large",
        background_image: "https://example.com/white-shirt.jpg",
      },
    ];

    expect(
      choosePrintfulPreview({ images, templates: [], variants, color: "white", placement: "front_large" })
    ).toMatchObject({
      src: "https://example.com/white-shirt.jpg",
      source: "product-background",
    });
  });

  it("does not match a template by variant id when its background color belongs to another color", () => {
    const templates: PrintfulPreviewTemplate[] = [
      {
        placement: "front",
        catalog_variant_ids: [101, 102],
        background_url: "https://example.com/black-template.jpg",
        background_color: "#000000",
      },
    ];

    expect(
      choosePrintfulPreview({ images: [], templates, variants, color: "white", placement: "front" })
    ).toMatchObject({
      src: null,
      source: "none",
    });

    expect(
      choosePrintfulPreview({ images: [], templates, variants, color: "black", placement: "front" })
    ).toMatchObject({
      src: "https://example.com/black-template.jpg",
      source: "template-background",
    });
  });
});
