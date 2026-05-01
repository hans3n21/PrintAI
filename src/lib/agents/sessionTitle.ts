import { openai, OPENAI_CHAT_MODEL } from "@/lib/openai";

export type SessionTitleInput = {
  onboarding_data: Record<string, unknown> | null;
  conversation_history: Array<{ role: string; content: string }> | null;
  design_urls?: string[] | null;
};

const SYSTEM_PROMPT = `Du generierst ultrakurze Galerietitel für KI-generierte T-Shirt-Designs.
Regeln:
- Maximal 5 Wörter, maximal 40 Zeichen
- Deutsch
- Kein Punkt am Ende
- Kein generisches Label wie "Design 1" oder "T-Shirt"
- Erfasse den Kern des Motivs prägnant
- Beispiele: "Pinguin spielt Shamisen", "Kainz – Held des Tages", "Verrückte Gehirn-Punk-Combo"`;

function normalizeTitle(raw: string): string {
  let t = raw.trim().replace(/^["'„«]+|["'„»]+$/gu, "");
  t = t.replace(/\.+$/u, "").trim();
  if (!t) return "Mein Design";
  return t.length > 40 ? t.slice(0, 40).trim() : t;
}

export async function generateSessionTitle(session: SessionTitleInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return "Mein Design";
  }

  const messages = session.conversation_history ?? [];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const userPrompt = `Onboarding-Daten: ${JSON.stringify(session.onboarding_data ?? null)}
Letzter User-Prompt: ${JSON.stringify(lastUserMessage)}

Antworte nur mit dem Titel, ohne Anführungszeichen, ohne Erklärung.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 30,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return normalizeTitle(text);
  } catch {
    return "Mein Design";
  }
}
