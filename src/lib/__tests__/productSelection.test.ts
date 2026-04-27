import { describe, expect, it } from "vitest";
import { mergeOnboardingWithProductSelection } from "../productSelection";
import type { OnboardingData, ProductSelection } from "../types";

const onboarding: OnboardingData = {
  event_type: "verein",
  group: true,
  group_size: 18,
  names: null,
  date: null,
  style: "cartoon",
  product: "tshirt",
  text_custom: "FC Test",
  photo_upload: false,
  insider: null,
  tonality: "witzig",
};

describe("mergeOnboardingWithProductSelection", () => {
  it("keeps structured product choices over AI guesses", () => {
    const selection: ProductSelection = {
      product: "hoodie",
      product_color: "white",
      quantity: 12,
    };

    const result = mergeOnboardingWithProductSelection(onboarding, selection);

    expect(result.product).toBe("hoodie");
    expect(result.group_size).toBe(12);
    expect(result.group).toBe(true);
  });

  it("uses onboarding data when no structured selection exists", () => {
    const result = mergeOnboardingWithProductSelection(onboarding, null);

    expect(result.product).toBe("tshirt");
    expect(result.group_size).toBe(18);
  });
});
