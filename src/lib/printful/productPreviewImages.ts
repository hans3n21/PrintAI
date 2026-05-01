export type PrintfulPreviewVariant = {
  variant_id: number;
  color?: string | null;
  color_hex?: string | null;
};

export type PrintfulPreviewImage = {
  catalog_variant_id?: number | null;
  color?: string | null;
  color_hex?: string | null;
  placement?: string | null;
  image_url?: string | null;
  background_color?: string | null;
  background_image?: string | null;
  mockup_style_id?: number | null;
};

export type PrintfulPreviewTemplate = {
  placement?: string | null;
  catalog_variant_ids?: number[] | null;
  image_url?: string | null;
  background_url?: string | null;
  background_color?: string | null;
  print_area_width?: number | null;
  print_area_height?: number | null;
  print_area_left?: number | null;
  print_area_top?: number | null;
  template_width?: number | null;
  template_height?: number | null;
};

export type PrintfulPreviewChoice = {
  src: string | null;
  source:
    | "product-background"
    | "template-background"
    | "product-transparent"
    | "template-image"
    | "none";
  image?: PrintfulPreviewImage;
  template?: PrintfulPreviewTemplate;
};

function normalizeColor(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function placementMatches(candidate: string | null | undefined, placement: string) {
  if (candidate === placement) return true;
  return (
    (candidate === "front" && placement === "front_large") ||
    (candidate === "front_large" && placement === "front") ||
    (candidate === "back" && placement === "back_large") ||
    (candidate === "back_large" && placement === "back")
  );
}

function imageMatchesColor(
  image: PrintfulPreviewImage,
  variants: PrintfulPreviewVariant[],
  color: string
) {
  const wanted = normalizeColor(color);
  if (normalizeColor(image.color) === wanted) return true;
  if (image.catalog_variant_id == null) return false;

  return variants.some(
    (variant) =>
      variant.variant_id === image.catalog_variant_id &&
      normalizeColor(variant.color) === wanted
  );
}

function templateMatchesColor(
  template: PrintfulPreviewTemplate,
  variants: PrintfulPreviewVariant[],
  color: string
) {
  const ids = template.catalog_variant_ids ?? [];
  if (ids.length === 0) return false;
  const wanted = normalizeColor(color);

  return variants.some((variant) => {
    if (!ids.includes(variant.variant_id) || normalizeColor(variant.color) !== wanted) {
      return false;
    }
    const templateHex = normalizeHex(template.background_color);
    const variantHex = normalizeHex(variant.color_hex);
    if (!templateHex || !variantHex) return true;
    return hexDistance(templateHex, variantHex) <= 0.08;
  });
}

function normalizeHex(hex: string | null | undefined): string | null {
  const value = hex?.trim() ?? "";
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const full = /^#?([0-9a-f]{6})$/i.exec(value);
  return full ? `#${full[1]}`.toLowerCase() : null;
}

function hexRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function hexDistance(a: string, b: string): number {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  return Math.sqrt(
    (ca.r - cb.r) ** 2 +
      (ca.g - cb.g) ** 2 +
      (ca.b - cb.b) ** 2
  );
}

function chooseTemplateByHex(
  templates: PrintfulPreviewTemplate[],
  variants: PrintfulPreviewVariant[],
  color: string,
  placement: string
) {
  const variant = variants.find((item) => normalizeColor(item.color) === normalizeColor(color));
  const targetHex = normalizeHex(variant?.color_hex);
  if (!targetHex) return undefined;
  const candidates = templates.filter(
    (template) =>
      template.background_url &&
      normalizeHex(template.background_color) &&
      placementMatches(template.placement, placement)
  );

  return candidates.reduce<PrintfulPreviewTemplate | undefined>((best, template) => {
    const templateHex = normalizeHex(template.background_color);
    if (!templateHex || hexDistance(templateHex, targetHex) > 0.08) return best;
    if (!best) return template;
    const delta = hexDistance(templateHex, targetHex);
    const bestHex = normalizeHex(best.background_color) ?? "#000000";
    const bestDelta = hexDistance(bestHex, targetHex);
    return delta < bestDelta ? template : best;
  }, undefined);
}

function chooseImage(
  images: PrintfulPreviewImage[],
  variants: PrintfulPreviewVariant[],
  color: string,
  placement: string
) {
  const renderable = images.filter(
    (image) => image.background_image?.trim() || image.image_url?.trim()
  );

  return (
    renderable.find(
      (image) =>
        placementMatches(image.placement, placement) &&
        image.background_image?.trim() &&
        imageMatchesColor(image, variants, color)
    ) ??
    renderable.find(
      (image) => image.background_image?.trim() && imageMatchesColor(image, variants, color)
    ) ??
    renderable.find(
      (image) =>
        placementMatches(image.placement, placement) && imageMatchesColor(image, variants, color)
    ) ??
    renderable.find((image) => imageMatchesColor(image, variants, color))
  );
}

function chooseTemplate(
  templates: PrintfulPreviewTemplate[],
  variants: PrintfulPreviewVariant[],
  color: string,
  placement: string
) {
  const withPreview = templates.filter(
    (template) => template.background_url?.trim() || template.image_url?.trim()
  );

  return (
    withPreview.find(
      (template) =>
        placementMatches(template.placement, placement) &&
        templateMatchesColor(template, variants, color)
    ) ??
    withPreview.find((template) => templateMatchesColor(template, variants, color)) ??
    chooseTemplateByHex(withPreview, variants, color, placement)
  );
}

export function choosePrintfulPreview({
  images,
  templates,
  variants,
  color,
  placement,
}: {
  images: PrintfulPreviewImage[];
  templates: PrintfulPreviewTemplate[];
  variants: PrintfulPreviewVariant[];
  color: string;
  placement: string;
}): PrintfulPreviewChoice {
  const image = chooseImage(images, variants, color, placement);
  const template = chooseTemplate(templates, variants, color, placement);

  const imageBackground = image?.background_image?.trim();
  if (imageBackground) {
    return { src: imageBackground, source: "product-background", image, template };
  }

  const templateBackground = template?.background_url?.trim();
  if (templateBackground) {
    return { src: templateBackground, source: "template-background", image, template };
  }

  const imageUrl = image?.image_url?.trim();
  if (imageUrl) {
    return { src: imageUrl, source: "product-transparent", image, template };
  }

  const templateUrl = template?.image_url?.trim();
  if (templateUrl) {
    return { src: templateUrl, source: "template-image", image, template };
  }

  return { src: null, source: "none", image, template };
}
