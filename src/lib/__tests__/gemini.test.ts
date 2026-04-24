import { describe, it, expect } from "vitest";
import { STYLE_VARIANTS } from "../gemini";

describe("STYLE_VARIANTS", () => {
  it("has exactly 4 variants", () => {
    expect(STYLE_VARIANTS).toHaveLength(4);
  });

  it("first variant is empty string", () => {
    expect(STYLE_VARIANTS[0]).toBe("");
  });

  it("remaining variants are non-empty strings", () => {
    expect(STYLE_VARIANTS[1].length).toBeGreaterThan(0);
    expect(STYLE_VARIANTS[2].length).toBeGreaterThan(0);
    expect(STYLE_VARIANTS[3].length).toBeGreaterThan(0);
  });
});
