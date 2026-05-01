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

/** Printful kann leere Strings liefern; ungueltige Werte zerstoeren die Swatch-Anzeige. */
function resolveVariantHex(hex: string | null | undefined, colorFallback: string): string {
  const t = hex?.trim() ?? "";

  // Semantic override map applied BEFORE trusting the API hex value.
  // Printful sometimes sends subtly off-white or bluish hex codes for "White" variants;
  // we correct them here so swatches look right regardless of what the API returns.
  const semanticMap: Record<string, string> = {
    black: "#1a1a1a",
    white: "#ffffff",
    navy: "#1e3a5f",
    grey: "#6b7280",
    gray: "#6b7280",
    heather: "#9ca3af",
  };
  const colorKey =
    normalizeColor(colorFallback)
      .split(/\s+|\/|,/)
      .at(0)
      ?.replace(/_/g, " ") ?? "";
  if (semanticMap[colorKey]) return semanticMap[colorKey];

  // For other colors, use the API hex if it is a valid value.
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) {
    return t.length === 4
      ? `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase()
      : t.toLowerCase();
  }

  return "#64748b";
}

function normalizeSize(size: string) {
  return size.trim().toUpperCase();
}

export function getPrintfulColorOptions(
  variants: PrintfulProductVariant[]
): PrintfulColorOption[] {
  const seen = new Map<string, PrintfulColorOption>();
  for (const variant of variants) {
    const rawLabel = variant.color?.trim() ?? "";
    const id = normalizeColor(rawLabel);
    if (!id || seen.has(id)) continue;
    seen.set(id, {
      id,
      label: rawLabel,
      hex: resolveVariantHex(variant.color_hex, rawLabel),
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
