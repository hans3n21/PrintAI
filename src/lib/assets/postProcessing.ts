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

export function markBackgroundRemoved(asset: DesignAsset, printUrl: string): DesignAsset {
  return {
    ...asset,
    print_url: printUrl,
    post_processing: {
      ...asset.post_processing,
      background_removed: true,
      print_ready: true,
      warnings: [],
    },
  };
}

export function markBackgroundRemovalSkipped(asset: DesignAsset): DesignAsset {
  const warnings = new Set(asset.post_processing.warnings);
  warnings.add("Hintergrundentfernung nicht konfiguriert");
  warnings.add("Druckdatei nutzt aktuell das Originalbild");

  return {
    ...asset,
    print_url: asset.preview_url,
    post_processing: {
      ...asset.post_processing,
      background_removed: false,
      print_ready: false,
      warnings: [...warnings],
    },
  };
}

export function markBackgroundRemovalFailed(asset: DesignAsset, reason: string): DesignAsset {
  const warnings = new Set(asset.post_processing.warnings);
  warnings.add(`Hintergrundentfernung fehlgeschlagen: ${reason}`);
  warnings.add("Druckdatei nutzt aktuell das Originalbild");

  return {
    ...asset,
    print_url: asset.preview_url,
    post_processing: {
      ...asset.post_processing,
      background_removed: false,
      print_ready: false,
      warnings: [...warnings],
    },
  };
}
