import type { ChatMessage } from "@/lib/types";

export function mergeLoadedConversation(
  current: ChatMessage[],
  loaded: ChatMessage[] | null | undefined
): ChatMessage[] {
  if (!loaded?.length) return current;
  if (current.length > 0) return current;
  return loaded;
}
