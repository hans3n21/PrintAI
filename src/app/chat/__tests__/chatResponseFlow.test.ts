import { describe, expect, it } from "vitest";
import { getAssistantMessageForChatResponse } from "../chatResponseFlow";

describe("getAssistantMessageForChatResponse", () => {
  it("skips assistant filler messages when onboarding completes", () => {
    expect(
      getAssistantMessageForChatResponse({
        complete: true,
        reply: "Ich bereite alles vor.",
      })
    ).toBeNull();
  });

  it("keeps normal assistant questions while onboarding continues", () => {
    expect(
      getAssistantMessageForChatResponse({
        complete: false,
        reply: "Welcher Stil soll es sein?",
      })
    ).toEqual({ role: "assistant", content: "Welcher Stil soll es sein?" });
  });
});
