import { describe, expect, it } from "vitest";
import { normalizeFeedbackCategory } from "../categories";

describe("normalizeFeedbackCategory", () => {
  it("accepts known feedback categories", () => {
    expect(normalizeFeedbackCategory("not_printable")).toBe("not_printable");
    expect(normalizeFeedbackCategory("bad_mockup")).toBe("bad_mockup");
  });

  it("uses general when the category is unknown", () => {
    expect(normalizeFeedbackCategory("anything")).toBe("general");
    expect(normalizeFeedbackCategory(undefined)).toBe("general");
  });
});
