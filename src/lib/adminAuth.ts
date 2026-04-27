export const ADMIN_COOKIE_NAME = "printai_admin";
export const ADMIN_COOKIE_VALUE = "ok";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || "changeme";
}

export function isValidAdminPassword(password: unknown) {
  return typeof password === "string" && password === getAdminPassword();
}

export function isAdminCookieValid(value: unknown) {
  return value === ADMIN_COOKIE_VALUE;
}
