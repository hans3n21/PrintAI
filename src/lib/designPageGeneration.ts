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

export function getDesignPageGenerationState(data: DesignPageGenerationInput) {
  const hasDesigns =
    hasItems(data.design_urls) || collectDisplayDesignUrls(data).length > 0;
  const hasSlogans = hasItems(data.slogans);
  const canGenerate = data.status === "generating" || data.status === "designing";

  return {
    canShowDesigns: hasDesigns,
    shouldRequestDesigns: canGenerate && !hasDesigns,
    shouldRequestSlogans: canGenerate && !hasSlogans,
  };
}
