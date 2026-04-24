import { afterEach, describe, expect, it } from "vitest";
import { getDesignVariantCount } from "../designVariantCount";

const key = "NEXT_PUBLIC_DESIGN_COUNT";

describe("getDesignVariantCount", () => {
  afterEach(() => {
    delete process.env[key];
  });

  it("defaults to 1 when unset", () => {
    delete process.env[key];
    expect(getDesignVariantCount()).toBe(1);
  });

  it("clamps to 1–4", () => {
    process.env[key] = "0";
    expect(getDesignVariantCount()).toBe(1);
    process.env[key] = "99";
    expect(getDesignVariantCount()).toBe(4);
    process.env[key] = "2";
    expect(getDesignVariantCount()).toBe(2);
  });
});
