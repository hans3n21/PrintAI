import type { DesignAsset, ImageProviderName } from "@/lib/types";

type CreateDesignAssetInput = {
  previewUrl: string;
  provider: ImageProviderName;
  prompt: string;
  variantIndex: number;
  seed?: string | null;
  warnings?: string[];
};

export function createDesignAsset(input: CreateDesignAssetInput): DesignAsset {
  return {
    id: `variant-${input.variantIndex + 1}`,
    preview_url: input.previewUrl,
    mockup_url: null,
    print_url: null,
    source: {
      provider: input.provider,
      prompt: input.prompt,
      variant_index: input.variantIndex,
      seed: input.seed ?? null,
    },
    post_processing: {
      background_removed: false,
      print_ready: false,
      warnings: input.warnings ?? ["Druckdatei noch nicht geprüft"],
    },
  };
}

export function getDesignUrlList(assets: DesignAsset[]): string[] {
  return assets.map((asset) => asset.preview_url);
}
