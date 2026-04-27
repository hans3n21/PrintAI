import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_COOKIE_VALUE,
  getAdminPassword,
  isAdminCookieValid,
  isValidAdminPassword,
} from "../adminAuth";

describe("adminAuth", () => {
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it("uses changeme as default admin password", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(getAdminPassword()).toBe("changeme");
    expect(isValidAdminPassword("changeme")).toBe(true);
  });

  it("allows overriding the password via environment", () => {
    process.env.ADMIN_PASSWORD = "secret";
    expect(isValidAdminPassword("changeme")).toBe(false);
    expect(isValidAdminPassword("secret")).toBe(true);
  });

  it("validates the admin cookie marker", () => {
    expect(isAdminCookieValid(ADMIN_COOKIE_VALUE)).toBe(true);
    expect(isAdminCookieValid("wrong")).toBe(false);
  });
});
