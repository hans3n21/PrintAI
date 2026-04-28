import {
  openai,
  OPENAI_CHAT_MODEL,
  stripMarkdownFencedJson,
} from "@/lib/openai";
import type {
  ChatMessage,
  CreativeBrief,
  OnboardingData,
  ProductSelection,
  ReferenceImageAsset,
} from "@/lib/types";

const CREATIVE_BRIEF_SYSTEM_PROMPT = `You create production creative briefs for print-on-demand image generation.

Use the full chat history. Do not discard concrete user motifs, hobbies, animals, seasons, vehicles, locations, or inside jokes.

For any team or club shirt, preserve layout wishes such as logo, sponsor, player name,
number, front/back placement, chest/back placement, or "vorne/hinten" wording inside
must_include_visuals and source_summary. These are production/editor hints; do not invent a fixed editor schema and do not ask for data that was not provided.

Return ONLY JSON with this shape:
{
  "occasion": "geburtstag | jga | abi | verein | firma | hochzeit | sonstiges",
  "product": "tshirt | hoodie | tasse | poster",
  "style": "cartoon | anime | vintage | modern | minimalistisch | realistisch | pop_art | sonstiges",
  "tone": "witzig | ernst | elegant | frech",
  "theme": "short German theme",
  "exact_text": "text to render or null",
  "must_include_visuals": ["specific visual motif 1"],
  "avoid": ["things to avoid"],
  "reference_images": [],
  "source_summary": "concise German summary of the important user wishes"
}`;

function toTitleCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function splitMotifPhrase(phrase: string): string[] {
  return phrase
    .replace(/\b(?:und|&)\b/gi, ",")
    .split(",")
    .map((part) =>
      part
        .replace(/^(?:ich|ick|i|wir)\s+/i, "")
        .replace(/\b(?:richtig|fette|cooles?|bitte|shirt|t-?shirt)\b/gi, "")
        .trim()
    )
    .filter((part) => part.length >= 3)
    .map(toTitleCase);
}

export function extractConcreteUserMotifs(history: ChatMessage[]): string[] {
  const motifs: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const motif = toTitleCase(value);
    const key = motif.toLowerCase();
    if (!motif || seen.has(key)) return;
    seen.add(key);
    motifs.push(motif);
  };

  for (const message of history) {
    if (message.role !== "user") continue;
    const content = message.content.replace(/\n/g, " ");
    const matches = content.matchAll(
      /\b(?:steh(?:e)?\s+(?:uff|auf)|mag|liebe|lieblingstier(?:\s+ist)?|lieblingsmotiv(?:\s+ist)?)\b\s+([^.!?]+)/gi
    );
    for (const match of matches) {
      for (const motif of splitMotifPhrase(match[1] ?? "")) add(motif);
    }
  }

  return motifs;
}

function parseBrief(raw: string): Partial<CreativeBrief> {
  const text = stripMarkdownFencedJson(raw);
  return JSON.parse(text) as Partial<CreativeBrief>;
}

function mergeVisuals(modelVisuals: string[] | undefined, recovered: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const visual of [...(modelVisuals ?? []), ...recovered]) {
    const value = toTitleCase(String(visual));
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export async function buildCreativeBrief(
  history: ChatMessage[],
  onboardingData: OnboardingData,
  productSelection: ProductSelection | null | undefined,
  referenceImages: ReferenceImageAsset[]
): Promise<CreativeBrief> {
  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: CREATIVE_BRIEF_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify(
          {
            conversation_history: history,
            onboarding_data: onboardingData,
            product_selection: productSelection,
            reference_images: referenceImages,
          },
          null,
          2
        ),
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 900,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = parseBrief(raw);
  const recoveredVisuals = extractConcreteUserMotifs(history);

  return {
    occasion: parsed.occasion ?? onboardingData.event_type,
    product: productSelection?.product ?? parsed.product ?? onboardingData.product,
    style: parsed.style ?? onboardingData.style,
    tone: parsed.tone ?? onboardingData.tonality,
    theme:
      typeof parsed.theme === "string" && parsed.theme.trim()
        ? parsed.theme.trim()
        : "Personalisierter Print aus dem Chat",
    exact_text:
      typeof parsed.exact_text === "string" && parsed.exact_text.trim()
        ? parsed.exact_text.trim()
        : onboardingData.text_custom,
    must_include_visuals: mergeVisuals(parsed.must_include_visuals, recoveredVisuals),
    avoid: Array.isArray(parsed.avoid) ? parsed.avoid.map(String) : [],
    reference_images: referenceImages,
    source_summary:
      typeof parsed.source_summary === "string" && parsed.source_summary.trim()
        ? parsed.source_summary.trim()
        : history
            .filter((message) => message.role === "user")
            .map((message) => message.content)
            .join(" ")
            .slice(0, 500),
  };
}
