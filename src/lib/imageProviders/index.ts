import { generateDesignImage as generateLegacyDesignImage } from "@/lib/gemini";
import type { ImageProviderName, ReferenceImageAsset } from "@/lib/types";

export type ImageProviderCapabilities = {
  supportsTransparentBackground: boolean;
  supportsSeed: boolean;
  supportsReferenceImage: boolean;
  supportsImageEditing: boolean;
  textRenderingQuality: "medium" | "high";
};

export type ImageGenerationRequest = {
  prompt: string;
  variantIndex: number;
  referenceImages?: ReferenceImageAsset[];
};

export type ImageGenerationResult = {
  base64: string;
  provider: ImageProviderName;
  seed: string | null;
};

export type ImageProvider = {
  name: ImageProviderName;
  capabilities: ImageProviderCapabilities;
  generateDesign(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
};

export function resolveImageProviderName(
  configured = process.env.IMAGE_PROVIDER?.trim().toLowerCase(),
  openAiKey = process.env.OPENAI_API_KEY?.trim()
): ImageProviderName {
  if (configured === "ideogram" || configured === "openai" || configured === "gemini") {
    return configured;
  }
  return openAiKey ? "openai" : "gemini";
}

export function getImageProvider(): ImageProvider {
  const name = resolveImageProviderName();
  return {
    name,
    capabilities: {
      supportsTransparentBackground: name === "openai",
      supportsSeed: name === "ideogram",
      supportsReferenceImage: name === "openai" || name === "gemini",
      supportsImageEditing: name !== "ideogram",
      textRenderingQuality: name === "gemini" ? "medium" : "high",
    },
    async generateDesign(request) {
      if (name === "ideogram") {
        throw new Error(
          "Ideogram provider is vorbereitet, aber noch nicht konfiguriert. Bitte IDEOGRAM_API_KEY und Client-Implementierung ergänzen."
        );
      }
      return {
        base64: await generateLegacyDesignImage(
          request.prompt,
          request.variantIndex,
          request.referenceImages
        ),
        provider: name,
        seed: null,
      };
    },
  };
}
