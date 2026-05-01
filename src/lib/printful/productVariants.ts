export type PrintfulProductVariant = {
  variant_id: number;
  size: string;
  color: string;
  color_hex: string | null;
  price_cents?: number | null;
  stock?: unknown;
};

export type PrintfulColorOption = {
  id: string;
  label: string;
  hex: string;
};

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "XXL"];

function normalizeColor(color: string) {
  return color.trim().toLowerCase();
}

function normalizeSize(size: string) {
  return size.trim().toUpperCase();
}

export function getPrintfulColorOptions(
  variants: PrintfulProductVariant[]
): PrintfulColorOption[] {
  const seen = new Map<string, PrintfulColorOption>();
  for (const variant of variants) {
    const id = normalizeColor(variant.color);
    if (!id || seen.has(id)) continue;
    seen.set(id, {
      id,
      label: variant.color.trim(),
      hex: variant.color_hex ?? "#ffffff",
    });
  }
  return [...seen.values()];
}

export function getPrintfulSizeOptions(
  variants: PrintfulProductVariant[],
  color: string
): string[] {
  const selectedColor = normalizeColor(color);
  const sizes = new Set(
    variants
      .filter((variant) => normalizeColor(variant.color) === selectedColor)
      .map((variant) => normalizeSize(variant.size))
  );
  return [...sizes].sort((a, b) => {
    const aIndex = SIZE_ORDER.indexOf(a);
    const bIndex = SIZE_ORDER.indexOf(b);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return a.localeCompare(b);
  });
}

export function findPrintfulVariant(
  variants: PrintfulProductVariant[],
  size: string,
  color: string
): PrintfulProductVariant | undefined {
  const selectedSize = normalizeSize(size);
  const selectedColor = normalizeColor(color);
  return variants.find(
    (variant) =>
      normalizeSize(variant.size) === selectedSize &&
      normalizeColor(variant.color) === selectedColor
  );
}
