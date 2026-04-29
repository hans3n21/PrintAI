import { afterEach, describe, expect, it } from "vitest";
import { getDesignVariantCount } from "../designVariantCount";

const key = "NEXT_PUBLIC_DESIGN_COUNT";
const serverKey = "DESIGN_COUNT";

describe("getDesignVariantCount", () => {
  afterEach(() => {
    delete process.env[key];
    delete process.env[serverKey];
  });

  it("defaults to 1 when unset", () => {
    delete process.env[key];
    delete process.env[serverKey];
    expect(getDesignVariantCount()).toBe(1);
  });

  it("uses the backend design count before the public hint", () => {
    process.env[key] = "1";
    process.env[serverKey] = "2";
    expect(getDesignVariantCount()).toBe(2);
  });

  it("clamps to 1–2", () => {
    process.env[key] = "0";
    expect(getDesignVariantCount()).toBe(1);
    process.env[key] = "99";
    expect(getDesignVariantCount()).toBe(2);
    process.env[key] = "2";
    expect(getDesignVariantCount()).toBe(2);
  });
});
