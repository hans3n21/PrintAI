import type { DesignAsset } from "@/lib/types";

export function markPostProcessingPending(asset: DesignAsset): DesignAsset {
  const warnings = new Set(asset.post_processing.warnings);
  warnings.add("Hintergrundentfernung ausstehend");
  warnings.add("Druckdatei noch nicht final geprüft");

  return {
    ...asset,
    post_processing: {
      ...asset.post_processing,
      background_removed: false,
      print_ready: false,
      warnings: [...warnings],
    },
  };
}
