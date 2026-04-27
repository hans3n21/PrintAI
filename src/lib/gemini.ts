import { GoogleGenerativeAI } from "@google/generative-ai";
import { openai } from "@/lib/openai";
import type { ReferenceImageAsset } from "@/lib/types";
import { toFile } from "openai/uploads";

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export const STYLE_VARIANTS = [
  "",
  ", warmer color palette, soft gradients, slightly brighter",
  ", darker contrasted color scheme, bold shadows, high contrast",
  ", outlined sketch style, loose linework, slightly different composition",
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableGeminiHttp(status: number | undefined, message: string) {
  if (status === 429 || status === 503) return true;
  return /429|503|Too Many|Resource exhausted|UNAVAILABLE|overloaded/i.test(
    message
  );
}

/** Gemini liefert oft „Please retry in 23.1s“ bzw. RetryInfo im JSON-Body. */
function parseRetryDelayMsFromGeminiMessage(message: string): number | undefined {
  const explicit = /Please retry in ([\d.]+)\s*s/i.exec(message);
  if (explicit) {
    const sec = Number.parseFloat(explicit[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.ceil(sec * 1000) + Math.floor(Math.random() * 400);
    }
  }
  const jsonDelay = /"retryDelay"\s*:\s*"(\d+)s"/i.exec(message);
  if (jsonDelay) {
    const sec = Number.parseInt(jsonDelay[1], 10);
    if (Number.isFinite(sec) && sec > 0) {
      return sec * 1000 + Math.floor(Math.random() * 400);
    }
  }
  return undefined;
}

/**
 * HTTP-Status aus SDK-Fehler (ohne instanceof): In Next/Turbopack kann
 * `instanceof GoogleGenerativeAIFetchError` fehlschlagen, dann fehlt 429-Retry-Logik.
 */
function getGeminiHttpStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

function getImageProvider(): "openai" | "gemini" {
  const configured = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  if (configured === "openai" || configured === "gemini") return configured;
  return process.env.OPENAI_API_KEY?.trim() ? "openai" : "gemini";
}

function supportsOpenAITransparentBackground(modelName: string): boolean {
  return (
    modelName === "gpt-image-1" ||
    modelName === "gpt-image-1.5" ||
    modelName === "chatgpt-image-latest"
  );
}

async function generateDesignImageWithOpenAI(
  prompt: string,
  variantIndex: number
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY ist nicht gesetzt");
  }

  const modelName = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const fullPrompt = prompt + STYLE_VARIANTS[variantIndex];
  const size = process.env.OPENAI_IMAGE_SIZE?.trim() || "1024x1024";
  const transparentBackgroundRequested =
    supportsOpenAITransparentBackground(modelName);

  const response = await openai.images.generate({
    model: modelName,
    prompt: fullPrompt,
    size: size as "1024x1024" | "1536x1024" | "1024x1536" | "auto",
    ...(transparentBackgroundRequested
      ? { background: "transparent" as const }
      : {}),
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(
      `OpenAI lieferte kein Bild (Modell ${modelName}). Bitte OPENAI_IMAGE_MODEL prüfen.`
    );
  }
  return b64;
}

async function fetchReferenceImageFile(image: ReferenceImageAsset) {
  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(`Referenzbild konnte nicht geladen werden: ${image.url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = image.storage_path.split("/").pop() || "reference.png";
  return toFile(buffer, filename, { type: image.mime });
}

async function generateDesignImageWithOpenAIReferences(
  prompt: string,
  variantIndex: number,
  referenceImages: ReferenceImageAsset[]
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY ist nicht gesetzt");
  }

  const modelName = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
  const fullPrompt =
    prompt +
    STYLE_VARIANTS[variantIndex] +
    "\nUse the attached reference image(s) as visual guidance while creating a clean printable design.";
  const size = process.env.OPENAI_IMAGE_SIZE?.trim() || "1024x1024";
  const images = await Promise.all(referenceImages.map(fetchReferenceImageFile));
  const response = await openai.images.edit({
    model: modelName,
    image: images,
    prompt: fullPrompt,
    size: size as "256x256" | "512x512" | "1024x1024" | "1536x1024" | "1024x1536" | "auto",
    output_format: "png",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(
      `OpenAI lieferte kein bearbeitetes Bild (Modell ${modelName}). Bitte OPENAI_IMAGE_MODEL prüfen.`
    );
  }
  return b64;
}

async function fetchReferenceImagePart(image: ReferenceImageAsset) {
  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(`Referenzbild konnte nicht geladen werden: ${image.url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    inlineData: {
      mimeType: image.mime,
      data: buffer.toString("base64"),
    },
  };
}

export async function generateDesignImage(
  prompt: string,
  variantIndex: number,
  referenceImages: ReferenceImageAsset[] = []
): Promise<string> {
  const provider = getImageProvider();
  if (provider === "openai") {
    return referenceImages.length > 0
      ? generateDesignImageWithOpenAIReferences(prompt, variantIndex, referenceImages)
      : generateDesignImageWithOpenAI(prompt, variantIndex);
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY ist nicht gesetzt");
  }

  const modelName =
    process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
  const referenceInstruction =
    referenceImages.length > 0
      ? "\nUse the attached reference image(s) as guidance for likeness, pose, objects, colors, or mood, but convert the result into a clean isolated print design."
      : "";
  const fullPrompt = prompt + STYLE_VARIANTS[variantIndex] + referenceInstruction;

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    } as never,
  });

  const maxAttempts = 8;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const content =
        referenceImages.length > 0
          ? [
              { text: fullPrompt },
              ...(await Promise.all(referenceImages.map(fetchReferenceImagePart))),
            ]
          : fullPrompt;
      const response = await model.generateContent(content);
      const result = response.response;
      const candidate = result.candidates?.[0];
      if (!candidate) {
        const fb = result.promptFeedback;
        throw new Error(
          `Gemini lieferte keinen Kandidaten (Modell ${modelName}). ${fb ? JSON.stringify(fb) : ""}`
        );
      }

      const parts = candidate.content?.parts ?? [];
      for (const part of parts) {
        if ("inlineData" in part && part.inlineData?.data) {
          return part.inlineData.data;
        }
      }

      const partKeys = parts.map((p) => Object.keys(p as object));
      throw new Error(
        `Kein Bild in der Gemini-Antwort (Modell ${modelName}, finishReason=${candidate.finishReason ?? "n/a"}, parts=${JSON.stringify(partKeys)})`
      );
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const httpStatus = getGeminiHttpStatus(e);
      if (httpStatus === 404) {
        throw new Error(
          `Gemini HTTP 404: Modell "${modelName}" existiert für diesen API-Key nicht oder ist nicht freigeschaltet. In Google AI Studio unter Modellen prüfen oder GEMINI_IMAGE_MODEL anpassen. Details: ${msg}`
        );
      }

      const retryable = isRetryableGeminiHttp(httpStatus, msg);
      if (!retryable || attempt === maxAttempts) {
        if (
          httpStatus === 429 &&
          /limit:\s*0|free_tier|billing details/i.test(msg)
        ) {
          throw new Error(
            `Gemini-Quota (429): Free-Tier für Bildmodell ausgelastet oder nicht verfügbar (Google meldet u. a. \"limit: 0\"). Warte einige Minuten/Stunden oder richte in AI Studio die Abrechnung ein. Technisch: ${msg}`
          );
        }
        throw e;
      }

      const suggested = parseRetryDelayMsFromGeminiMessage(msg);
      const fallback = Math.min(
        45_000,
        2000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 800)
      );
      // 429: Google nennt oft 20–60s Wartezeit; früher war max 10s → Retries nutzlos.
      const waitMs =
        (httpStatus === 429 || /429\s+Too\s+Many/i.test(msg)) &&
        suggested != null
          ? Math.min(120_000, Math.max(suggested, 1500))
          : fallback;
      await sleep(waitMs);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
