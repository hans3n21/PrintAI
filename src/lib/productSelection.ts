import type { OnboardingData, ProductSelection } from "@/lib/types";

export const DEFAULT_PRODUCT_SELECTION: ProductSelection = {
  product: "tshirt",
  product_color: "black",
  quantity: 1,
};

export function normalizeQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(999, Math.max(1, Math.round(n)));
}

/** Session mit dem im Shop aktiven Printful-Produkt verknüpfen (nur wenn noch keine gültige ID gesetzt ist). */
export function withPinnedShopPrintfulProductId(
  selection: ProductSelection | null | undefined,
  printful_product_id: number
): ProductSelection {
  const existingPid = selection?.printful_product_id;
  if (
    typeof existingPid === "number" &&
    Number.isInteger(existingPid) &&
    existingPid > 0
  ) {
    return selection!;
  }

  const base: ProductSelection = {
    product: selection?.product ?? DEFAULT_PRODUCT_SELECTION.product,
    product_color: selection?.product_color ?? DEFAULT_PRODUCT_SELECTION.product_color,
    quantity: normalizeQuantity(selection?.quantity),
    printful_product_id,
  };

  if (typeof selection?.printful_variant_id === "number" && selection.printful_variant_id > 0) {
    base.printful_variant_id = selection.printful_variant_id;
  }
  if (typeof selection?.size === "string" && selection.size.trim()) {
    base.size = selection.size.trim();
  }
  if (typeof selection?.color === "string" && selection.color.trim()) {
    base.color = selection.color.trim().toLowerCase();
  }

  return base;
}

export function mergeOnboardingWithProductSelection(
  data: OnboardingData,
  selection: ProductSelection | null | undefined
): OnboardingData {
  if (!selection) return data;
  const quantity = normalizeQuantity(selection.quantity);
  return {
    ...data,
    product: selection.product,
    group: quantity > 1 ? true : data.group,
    group_size: quantity,
  };
}
