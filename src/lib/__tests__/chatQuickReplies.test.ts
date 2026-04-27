import { describe, expect, it } from "vitest";
import { getQuickRepliesForAssistantReply } from "../chatQuickReplies";

describe("getQuickRepliesForAssistantReply", () => {
  it("does not show style suggestions when the bot asks for a slogan", () => {
    expect(
      getQuickRepliesForAssistantReply(
        "Super! Das Motiv ist ein Cartoon-Vogel. Hast du einen bestimmten Spruch im Kopf?"
      )
    ).toEqual([]);
  });

  it("shows style suggestions only for an actual style question", () => {
    expect(
      getQuickRepliesForAssistantReply("Welchen Stil möchtest du: Cartoon, modern oder vintage?")
    ).toEqual(["Cartoon/witzig", "Modern/clean", "Vintage", "Minimalistisch"]);
  });
});
