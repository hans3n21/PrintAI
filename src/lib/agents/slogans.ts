import { SLOGAN_SYSTEM_PROMPT } from "@/lib/prompts/slogans";
import {
  openai,
  OPENAI_CHAT_MODEL,
  stripMarkdownFencedJson,
} from "@/lib/openai";
import type { OnboardingData, SloganOption } from "@/lib/types";

export async function generateSlogans(data: OnboardingData): Promise<SloganOption[]> {
  const input = {
    event_type: data.event_type,
    names: data.names,
    insider: data.insider,
    tonality: data.tonality,
    text_custom: data.text_custom,
  };

  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: SLOGAN_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(input) },
    ],
    max_tokens: 700,
    temperature: 0.8,
  });

  const raw = response.choices[0]?.message?.content ?? "[]";
  const text = stripMarkdownFencedJson(raw);
  return JSON.parse(text) as SloganOption[];
}
