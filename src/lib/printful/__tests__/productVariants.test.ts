import { describe, expect, it } from "vitest";
import {
  findPrintfulVariant,
  getPrintfulColorOptions,
  getPrintfulSizeOptions,
} from "../productVariants";

const variants = [
  {
    variant_id: 4011,
    size: "S",
    color: "Black",
    color_hex: "#000000",
    price_cents: 1295,
    stock: "in_stock",
  },
  {
    variant_id: 4012,
    size: "M",
    color: "Black",
    color_hex: "#000000",
    price_cents: 1295,
    stock: "in_stock",
  },
  {
    variant_id: 4013,
    size: "M",
    color: "White",
    color_hex: "#ffffff",
    price_cents: 1295,
    stock: "in_stock",
  },
];

describe("printful product variants", () => {
  it("derives color options from active Printful variants", () => {
    expect(getPrintfulColorOptions(variants)).toEqual([
      { id: "black", label: "Black", hex: "#000000" },
      { id: "white", label: "White", hex: "#ffffff" },
    ]);
  });

  it("limits sizes to the selected color", () => {
    expect(getPrintfulSizeOptions(variants, "black")).toEqual(["S", "M"]);
    expect(getPrintfulSizeOptions(variants, "white")).toEqual(["M"]);
  });

  it("finds the concrete variant id for size and color", () => {
    expect(findPrintfulVariant(variants, "m", "black")).toMatchObject({
      variant_id: 4012,
      size: "M",
      color: "Black",
    });
    expect(findPrintfulVariant(variants, "S", "white")).toBeUndefined();
  });
});
