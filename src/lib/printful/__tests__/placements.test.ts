import { describe, expect, it } from "vitest";
import { backPlacementFor, orderFilePlacements, placementForPrintArea } from "../placements";
import { placementMatches } from "../productPreviewImages";

describe("Printful placement helpers", () => {
  it("maps front placements to matching back placements", () => {
    expect(backPlacementFor("front_large")).toBe("back_large");
    expect(backPlacementFor("front")).toBe("back");
  });

  it("uses back placement for the editor when back print is selected", () => {
    expect(placementForPrintArea("back", "front_large")).toBe("back_large");
    expect(placementForPrintArea("front", "front_large")).toBe("front_large");
    expect(placementForPrintArea("both", "front_large")).toBe("front_large");
  });

  it("creates one or two order file placements from the selected print area", () => {
    expect(orderFilePlacements("front", "front_large")).toEqual(["front_large"]);
    expect(orderFilePlacements("back", "front_large")).toEqual(["back_large"]);
    expect(orderFilePlacements("both", "front_large")).toEqual(["front_large", "back_large"]);
  });

  it("treats large and regular front/back placements as compatible", () => {
    expect(placementMatches("front", "front_large")).toBe(true);
    expect(placementMatches("back", "back_large")).toBe(true);
  });
});
