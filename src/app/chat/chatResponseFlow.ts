import type { ChatMessage } from "@/lib/types";

type ChatApiResponseLike = {
  complete?: boolean;
  reply?: unknown;
};

export function getAssistantMessageForChatResponse(
  data: ChatApiResponseLike
): ChatMessage | null {
  if (data.complete) return null;
  return {
    role: "assistant",
    content: String(data.reply ?? ""),
  };
}
