import { describe, expect, it } from "vitest";
import { getQuickRepliesForAssistantReply } from "../chatQuickReplies";

describe("getQuickRepliesForAssistantReply", () => {
  it("shows helpful text suggestions when the bot asks for a slogan", () => {
    expect(
      getQuickRepliesForAssistantReply(
        "Welchen Text oder Slogan möchtest du auf das Shirt haben?"
      )
    ).toEqual(["Denk dir was aus", "Witzig", "Kurz & clean"]);
  });

  it("does not fall back to yes/no for open text questions", () => {
    expect(
      getQuickRepliesForAssistantReply(
        "Super! Das Motiv ist ein Cartoon-Vogel. Hast du einen bestimmten Spruch im Kopf?"
      )
    ).toEqual(["Denk dir was aus", "Witzig", "Kurz & clean"]);
  });

  it("shows style suggestions only for an actual style question", () => {
    expect(
      getQuickRepliesForAssistantReply("Welchen Stil möchtest du: Cartoon, modern oder vintage?")
    ).toEqual(["Cartoon/witzig", "Modern/clean", "Vintage", "Minimalistisch"]);
  });

  it("shows style suggestions when the bot asks for a style in mind", () => {
    expect(
      getQuickRepliesForAssistantReply(
        "Wie soll das Motiv aussehen? Hast du einen bestimmten Stil im Kopf?"
      )
    ).toEqual(["Cartoon/witzig", "Modern/clean", "Vintage", "Minimalistisch"]);
  });

  it("shows a confirmation button when the bot asks to confirm the summary", () => {
    expect(
      getQuickRepliesForAssistantReply(
        "Zusammenfassung: JGA-Shirt, Mallorca, Cartoon-Style. Passt das so?"
      )
    ).toEqual(["Bestätigen"]);
  });

  it("keeps explicit yes/no questions available", () => {
    expect(
      getQuickRepliesForAssistantReply("Soll ich ein Foto verwenden? Antworte mit Ja oder Nein.")
    ).toEqual(["Ja", "Nein"]);
  });
});
