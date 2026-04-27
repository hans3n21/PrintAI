import { describe, expect, it } from "vitest";
import { getPrintPromptTemplate } from "../templates";
import type { OnboardingData, ProductSelection } from "@/lib/types";

const baseData: OnboardingData = {
  event_type: "verein",
  group: true,
  group_size: 11,
  names: null,
  date: null,
  style: "modern",
  product: "tshirt",
  text_custom: "SV TEST",
  photo_upload: false,
  insider: null,
  tonality: "ernst",
};

describe("getPrintPromptTemplate", () => {
  it("adds print-safe rules for club shirts and selected product color", () => {
    const selection: ProductSelection = {
      product: "tshirt",
      product_color: "black",
      quantity: 11,
    };

    const template = getPrintPromptTemplate(baseData, selection);

    expect(template.name).toBe("verein-tshirt");
    expect(template.rules).toContain("shirt-ready centered chest graphic");
    expect(template.rules).toContain("optimize contrast for black fabric");
    expect(template.negativePrompt).toContain("checkerboard transparency pattern");
  });
});
