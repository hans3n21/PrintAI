import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
});

/** Chat model for onboarding, prompt builder, slogans (override via OPENAI_MODEL). */
export const OPENAI_CHAT_MODEL =
  process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

/** Strips optional ```json ... ``` wrappers from model output before JSON.parse. */
export function stripMarkdownFencedJson(content: string): string {
  const t = content.trim();
  const m = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(t);
  if (m) return m[1].trim();
  return t;
}
