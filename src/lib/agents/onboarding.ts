import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/prompts/onboarding";
import {
  openai,
  OPENAI_CHAT_MODEL,
  stripMarkdownFencedJson,
} from "@/lib/openai";
import type {
  ChatMessage,
  OnboardingData,
  ProductSelection,
  ReferenceImageAsset,
} from "@/lib/types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type OnboardingIncomplete = {
  complete: false;
  reply: string;
};

type OnboardingComplete = {
  complete: true;
  data: OnboardingData;
  summary: string;
};

export type OnboardingResult = OnboardingIncomplete | OnboardingComplete;

type OnboardingOptions = {
  referenceImageUrl?: string;
  productSelection?: ProductSelection | null;
  referenceImages?: ReferenceImageAsset[];
};

/** Extract first balanced {...} substring (best-effort for model output with extra prose). */
function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function collectJsonCandidates(raw: string): string[] {
  const out: string[] = [];
  const trimmed = raw.trim();
  out.push(stripMarkdownFencedJson(trimmed));
  out.push(trimmed);
  for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    out.push(m[1].trim());
  }
  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) out.push(balanced);
  const lastBrace = trimmed.lastIndexOf("}");
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    out.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  return [...new Set(out.filter(Boolean))];
}

function tryParseCompletePayload(
  raw: string
): { data: OnboardingData; summary: string } | null {
  for (const candidate of collectJsonCandidates(raw)) {
    try {
      const parsed = JSON.parse(candidate) as {
        status?: string;
        data?: OnboardingData;
        summary?: string;
      };
      if (
        parsed?.status === "complete" &&
        parsed.data &&
        typeof parsed.summary === "string"
      ) {
        return { data: parsed.data, summary: parsed.summary };
      }
      if (looksLikeOnboardingData(parsed)) {
        return { data: parsed, summary: extractSummary(raw, parsed) };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function looksLikeOnboardingData(value: unknown): value is OnboardingData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<OnboardingData>;
  return (
    typeof data.event_type === "string" &&
    typeof data.style === "string" &&
    typeof data.product === "string" &&
    typeof data.tonality === "string"
  );
}

function extractSummary(raw: string, data: OnboardingData): string {
  const explicit = /Zusammenfassung:\s*([\s\S]+)$/i.exec(raw)?.[1]?.trim();
  if (explicit) return explicit.replace(/^["']|["']$/g, "");

  const motif = data.insider ?? data.text_custom ?? "deinem Motiv";
  const product = data.product === "tshirt" ? "T-Shirt" : data.product;
  return `Alles klar! Ich erstelle ein ${data.tonality}es ${data.style}-${product} mit ${motif}.`;
}

export async function runForceCompleteOnboarding(
  history: ChatMessage[]
): Promise<OnboardingResult> {
  const system = `Du bist ein Backend-Parser für PrintAI.
Lies den bisherigen Chat zwischen Nutzer und Assistent.
Erzeuge EIN einziges JSON-Objekt (kein Markdown, keine Erklaerung davor oder danach) mit exakt dieser Struktur:
{
  "status": "complete",
  "data": {
    "event_type": "geburtstag" | "jga" | "abi" | "verein" | "firma" | "hochzeit" | "sonstiges",
    "group": boolean,
    "group_size": number | null,
    "names": string[] | "tbd" | null,
    "date": string | null,
    "style": "cartoon" | "anime" | "vintage" | "modern" | "minimalistisch" | "realistisch" | "pop_art" | "sonstiges",
    "product": "tshirt" | "hoodie" | "tasse" | "poster",
    "text_custom": string | null,
    "photo_upload": boolean,
    "insider": string | null,
    "tonality": "witzig" | "ernst" | "elegant" | "frech"
  },
  "summary": "Kurze deutsche Zusammenfassung für den Nutzer."
}
Nutze sinnvolle Defaults für fehlende Infos (z.B. product tshirt, style cartoon, event sonstiges, tonality witzig, group false, group_size null, names null, text_custom null, insider null, photo_upload false, date null).`;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...history.map(
      (m): ChatCompletionMessageParam => ({
        role: m.role,
        content: m.content,
      })
    ),
    {
      role: "user",
      content:
        "Schliesse das Onboarding jetzt ab und gib nur das JSON-Objekt wie beschrieben.",
    },
  ];

  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages,
    response_format: { type: "json_object" },
    max_tokens: 600,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const parsed = tryParseCompletePayload(raw);
  if (parsed) {
    return { complete: true, data: parsed.data, summary: parsed.summary };
  }
  return {
    complete: false,
    reply:
      "Konnte das Onboarding nicht automatisch abschließen. Bitte schreib noch kurz Anlass, Stil und Produkt (z.B. T-Shirt).",
  };
}

export async function runOnboardingMessage(
  history: ChatMessage[],
  userMessage: string,
  options?: OnboardingOptions
): Promise<OnboardingResult> {
  const userBlock: ChatCompletionMessageParam =
    options?.referenceImageUrl != null
      ? {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            {
              type: "image_url",
              image_url: { url: options.referenceImageUrl },
            },
          ],
        }
      : { role: "user", content: userMessage };

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: ONBOARDING_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Bekannter UI-Kontext (nicht erneut abfragen, sondern verwenden):\n${JSON.stringify(
        {
          product_selection: options?.productSelection ?? null,
          reference_image_count: options?.referenceImages?.length ?? 0,
          rules: [
            "Frage nicht nach Produkt, Farbe oder Menge, wenn product_selection gesetzt ist.",
            "Frage nicht nach Gruppe oder Anzahl, wenn quantity gesetzt ist.",
            "Wenn quantity 1 ist oder der Nutzer nur fuer mich sagt, ist group false und group_size 1.",
          ],
        },
        null,
        2
      )}`,
    },
    ...history.map(
      (m): ChatCompletionMessageParam => ({
        role: m.role,
        content: m.content,
      })
    ),
    userBlock,
  ];

  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages,
    max_tokens: 400,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const reply = stripMarkdownFencedJson(raw);

  const complete = tryParseCompletePayload(raw);
  if (complete) {
    return { complete: true, data: complete.data, summary: complete.summary };
  }

  return { complete: false, reply };
}
