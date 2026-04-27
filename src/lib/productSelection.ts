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
