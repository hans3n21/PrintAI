import type { SessionStatus } from "@/lib/types";

type DesignPageGenerationInput = {
  status?: SessionStatus | string | null;
  design_urls?: unknown[] | null;
  design_assets?: unknown[] | null;
  slogans?: unknown[] | null;
};

type DesignAssetLike = {
  preview_url?: unknown;
  mockup_url?: unknown;
  print_url?: unknown;
};

function hasItems(value: unknown[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

function addUrl(out: string[], seen: Set<string>, value: unknown) {
  if (typeof value !== "string") return;
  const url = value.trim();
  if (!url || seen.has(url)) return;
  seen.add(url);
  out.push(url);
}

export function collectDisplayDesignUrls(data: DesignPageGenerationInput): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of data.design_urls ?? []) addUrl(out, seen, url);
  for (const asset of data.design_assets ?? []) {
    if (!asset || typeof asset !== "object") continue;
    const designAsset = asset as DesignAssetLike;
    addUrl(out, seen, designAsset.preview_url);
    addUrl(out, seen, designAsset.mockup_url);
    addUrl(out, seen, designAsset.print_url);
  }
  return out;
}

export function resolvePrintDesignUrl(
  data: Pick<DesignPageGenerationInput, "design_assets">,
  selectedUrl: string | null
): string | null {
  if (!selectedUrl) return null;
  for (const asset of data.design_assets ?? []) {
    if (!asset || typeof asset !== "object") continue;
    const designAsset = asset as DesignAssetLike;
    if (
      designAsset.preview_url === selectedUrl ||
      designAsset.mockup_url === selectedUrl ||
      designAsset.print_url === selectedUrl
    ) {
      return typeof designAsset.print_url === "string" && designAsset.print_url.trim()
        ? designAsset.print_url.trim()
        : selectedUrl;
    }
  }
  return selectedUrl;
}

export function getDesignPageGenerationState(data: DesignPageGenerationInput) {
  const hasDesigns = collectDisplayDesignUrls(data).length > 0;
  const hasSlogans = hasItems(data.slogans);
  const canGenerate = data.status === "generating" || data.status === "designing";

  return {
    canShowDesigns: hasDesigns,
    shouldRequestDesigns: canGenerate && !hasDesigns,
    shouldRequestSlogans: canGenerate && !hasSlogans,
  };
}
