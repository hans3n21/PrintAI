import { describe, expect, it } from "vitest";
import { catalogVariantPriceMap, centsFromCatalogPriceValue } from "../catalogVariantPriceMap";

describe("catalogVariantPriceMap", () => {
  it("stores cents under both id and catalog_variant_id when present", () => {
    const map = catalogVariantPriceMap(
      [
        {
          id: 111,
          catalog_variant_id: 222,
          techniques: [{ technique_key: "dtg", price: "10.59", discounted_price: null }],
        },
      ],
      "dtg"
    );
    expect(map.get(111)).toBe(1059);
    expect(map.get(222)).toBe(1059);
  });

  it("fallbacks first technique row when preferred key absent", () => {
    expect(
      catalogVariantPriceMap(
        [
          {
            id: 1,
            catalog_variant_id: 1,
            techniques: [{ technique_key: "embroidery", price: "5.00" }],
          },
        ],
        "dtg"
      ).get(1)
    ).toBe(500);
  });
});

describe("centsFromCatalogPriceValue", () => {
  it("returns null on empty inputs", () => {
    expect(centsFromCatalogPriceValue(undefined)).toBe(null);
    expect(centsFromCatalogPriceValue("")).toBe(null);
  });
});
