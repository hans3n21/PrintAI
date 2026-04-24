import { PROMPT_BUILDER_SYSTEM_PROMPT } from "@/lib/prompts/promptBuilder";
import {
  openai,
  OPENAI_CHAT_MODEL,
  stripMarkdownFencedJson,
} from "@/lib/openai";
import type { OnboardingData, PromptData } from "@/lib/types";

export async function buildImagePrompt(data: OnboardingData): Promise<PromptData> {
  const response = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: PROMPT_BUILDER_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Build an image prompt for this session data:\n${JSON.stringify(
          data,
          null,
          2
        )}`,
      },
    ],
    max_tokens: 600,
    temperature: 0.6,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const text = stripMarkdownFencedJson(raw);
  return JSON.parse(text) as PromptData;
}
