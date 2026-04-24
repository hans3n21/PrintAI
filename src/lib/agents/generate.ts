import { getDesignVariantCount } from "@/lib/designVariantCount";
import { generateDesignImage } from "@/lib/gemini";
import { supabaseAdmin } from "@/lib/supabase";

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

export async function generateDesigns(
  sessionId: string,
  prompt: string
): Promise<string[]> {
  const count = getDesignVariantCount();
  // Seriell: parallele Aufrufe triggern oft 429 (RPM/RPD).
  const base64Images: string[] = [];
  const pause = staggerMs();
  for (let i = 0; i < count; i++) {
    base64Images.push(await generateDesignImage(prompt, i));
    if (i < count - 1 && pause > 0) await sleep(pause);
  }

  const urls = await Promise.all(
    base64Images.map(async (b64, i) => {
      const buffer = Buffer.from(b64, "base64");
      const filename = `${sessionId}/design_${i + 1}_${Date.now()}.png`;

      const { error } = await supabaseAdmin.storage
        .from("designs")
        .upload(filename, buffer, { contentType: "image/png", upsert: true });

      if (error) throw new Error(`Storage upload failed: ${error.message}`);

      const { data } = supabaseAdmin.storage.from("designs").getPublicUrl(filename);
      return data.publicUrl;
    })
  );

  return urls;
}
