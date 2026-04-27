import type { SessionStatus } from "@/lib/types";

type DesignPageGenerationInput = {
  status?: SessionStatus | string | null;
  design_urls?: unknown[] | null;
  slogans?: unknown[] | null;
};

function hasItems(value: unknown[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

export function getDesignPageGenerationState(data: DesignPageGenerationInput) {
  const hasDesigns = hasItems(data.design_urls);
  const hasSlogans = hasItems(data.slogans);
  const canGenerate = data.status === "generating" || data.status === "designing";

  return {
    canShowDesigns: hasDesigns,
    shouldRequestDesigns: canGenerate && !hasDesigns,
    shouldRequestSlogans: canGenerate && !hasSlogans,
  };
}
