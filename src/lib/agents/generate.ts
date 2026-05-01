import { getDesignVariantCount } from "@/lib/designVariantCount";
import { createDesignAsset } from "@/lib/assets/designAssets";
import { removeBackgroundFromPng } from "@/lib/assets/backgroundRemoval";
import {
  markBackgroundRemovalFailed,
  markBackgroundRemovalSkipped,
  markBackgroundRemoved,
  markPostProcessingPending,
} from "@/lib/assets/postProcessing";
import { getImageProvider } from "@/lib/imageProviders";
import { supabaseAdmin } from "@/lib/supabase";
import type { DesignAsset, ReferenceImageAsset } from "@/lib/types";

const staggerMs = () => {
  const raw = process.env.GEMINI_IMAGE_STAGGER_MS;
  const n = raw ? Number.parseInt(raw, 10) : 3500;
  return Number.isFinite(n) && n >= 0 ? n : 3500;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function uploadPng(path: string, buffer: Buffer) {
  const { error } = await supabaseAdmin.storage
    .from("designs")
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from("designs").getPublicUrl(path);
  return data.publicUrl;
}

async function attachPrintReadyImage(asset: DesignAsset, originalBuffer: Buffer, printPath: string) {
  try {
    const transparentBuffer = await removeBackgroundFromPng(originalBuffer);
    if (!transparentBuffer) {
      return markBackgroundRemovalSkipped(asset);
    }

    const printUrl = await uploadPng(printPath, transparentBuffer);
    return markBackgroundRemoved(asset, printUrl);
  } catch (error) {
    return markBackgroundRemovalFailed(
      asset,
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function generateDesigns(
  sessionId: string,
  prompt: string,
  referenceImages: ReferenceImageAsset[] = []
): Promise<{ urls: string[]; assets: DesignAsset[] }> {
  const count = getDesignVariantCount();
  // Seriell: parallele Aufrufe triggern oft 429 (RPM/RPD).
  const provider = getImageProvider();
  const generatedImages: Array<{ base64: string; provider: typeof provider.name; seed: string | null }> = [];
  const pause = staggerMs();
  for (let i = 0; i < count; i++) {
    generatedImages.push(
      await provider.generateDesign({ prompt, variantIndex: i, referenceImages })
    );
    if (i < count - 1 && pause > 0) await sleep(pause);
  }

  const assets = await Promise.all(
    generatedImages.map(async (generated, i) => {
      const buffer = Buffer.from(generated.base64, "base64");
      const timestamp = Date.now();
      const filename = `${sessionId}/design_${i + 1}_${timestamp}.png`;
      const printFilename = `${sessionId}/design_${i + 1}_print_${timestamp}.png`;

      const previewUrl = await uploadPng(filename, buffer);
      const asset = markPostProcessingPending(
        createDesignAsset({
          previewUrl,
          provider: generated.provider,
          prompt,
          variantIndex: i,
          seed: generated.seed,
        })
      );

      return attachPrintReadyImage(asset, buffer, printFilename);
    })
  );

  return { assets, urls: assets.map((asset) => asset.preview_url) };
}
