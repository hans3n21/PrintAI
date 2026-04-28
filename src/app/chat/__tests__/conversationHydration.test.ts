import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { mergeLoadedConversation } from "../conversationHydration";

describe("mergeLoadedConversation", () => {
  it("keeps an optimistic first user message when Supabase still has no history", () => {
    const optimistic: ChatMessage[] = [
      { role: "user", content: "JGA-Shirt, Mallorca, Cartoon-Style" },
    ];

    expect(mergeLoadedConversation(optimistic, [])).toBe(optimistic);
  });

  it("hydrates stored history only while the chat is still empty", () => {
    const stored: ChatMessage[] = [
      { role: "user", content: "Ein Shirt" },
      { role: "assistant", content: "Welchen Stil möchtest du?" },
    ];

    expect(mergeLoadedConversation([], stored)).toBe(stored);
  });
});
