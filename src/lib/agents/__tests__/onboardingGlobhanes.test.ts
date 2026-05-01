import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  OPENAI_CHAT_MODEL: "gpt-4o-mini",
  stripMarkdownFencedJson: (s: string) => s,
}));

import { openai } from "@/lib/openai";
import type { ProductSelection } from "@/lib/types";
import { runOnboardingMessage } from "../onboarding";

const productSelection: ProductSelection = {
  product: "tshirt",
  product_color: "black",
  quantity: 1,
};

describe("runOnboardingMessage globhanes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes known product selection so the bot does not ask for product or quantity again", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: "Welche Stilrichtung soll es sein?" } }],
    } as never);

    await runOnboardingMessage(
      [],
      "Ich will ein Shirt mit einem Wal auf einer Musikbox - comicstyle",
      { productSelection }
    );

    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const context = call.messages?.find(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("Bekannter UI-Kontext")
    );

    expect(context?.content).toContain('"product": "tshirt"');
    expect(context?.content).toContain('"quantity": 1');
    expect(context?.content).toContain("Frage nicht nach Produkt, Farbe oder Menge");
  });

  it("uses strict onboarding rules against redundant occasion, style, group and date questions", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: "Alles klar!" } }],
    } as never);

    await runOnboardingMessage(
      [],
      "Der Anlass interessiert nicht, nur für mich, bitte Comicstyle.",
      { productSelection }
    );

    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const system = call.messages?.[0];
    const content = typeof system?.content === "string" ? system.content : "";

    expect(content).toContain("Keine Nachfragen nach Anlass");
    expect(content).toContain("Keine Nachfragen nach Datum");
    expect(content).toContain("Keine Nachfrage nach Gruppe");
    expect(content).toContain("Keine erneute Stilfrage");
    expect(call.temperature).toBeLessThanOrEqual(0.3);
  });

  it("forbids user-visible preparation filler before completion", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: "Ich bereite alles vor." } }],
    } as never);

    await runOnboardingMessage(
      [],
      "JGA-Shirt, Mallorca, Cartoon-Style",
      { productSelection }
    );

    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const system = call.messages?.[0];
    const content = typeof system?.content === "string" ? system.content : "";

    expect(content).toContain('"Ich mache jetzt das JSON fertig"');
    expect(content).toContain('"Ich bereite alles vor"');
    expect(content).toContain("Abschluss-Fuellsaetze");
    expect(content).toContain("gib sofort das JSON aus");
    expect(content).not.toContain("Sage stattdessen nutzerfreundlich");
  });

  it("includes concrete examples forbidding date and slogan follow-up when required fields are known", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: "Alles klar!" } }],
    } as never);

    await runOnboardingMessage(
      [],
      "JGA-Shirt, Mallorca, Cartoon-Style",
      { productSelection }
    );

    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const system = call.messages?.[0];
    const content = typeof system?.content === "string" ? system.content : "";

    expect(content).toContain('FALSCH: "Wann ist der JGA?"');
    expect(content).toContain('FALSCH: "Gibt es einen speziellen Text oder Slogan?"');
    expect(content).toContain("text_custom immer null");
  });

  it("allows neutral shirt requests to default to sonstiges instead of asking for an occasion", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: "Alles klar!" } }],
    } as never);

    await runOnboardingMessage(
      [],
      "Ich brauche ein schwarzes Shirt mit einem coolen Fuchs im Cartoonstyle",
      { productSelection }
    );

    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const system = call.messages?.[0];
    const content = typeof system?.content === "string" ? system.content : "";

    expect(content).toContain("Bei neutralen Shirt-Wuenschen ist event_type sonstiges");
    expect(content).toContain('FALSCH: "Für welchen Anlass ist das Shirt?"');
  });

  it("overrides redundant occasion questions for motif and style-only requests", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Für welchen Anlass möchtest du das Shirt mit der Comicfigur im Disney-Stil?",
          },
        },
      ],
    } as never);

    const result = await runOnboardingMessage(
      [],
      "Ein schwarzes Shirt mit einer Comicfigur im Disney-Stil",
      { productSelection }
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.data.event_type).toBe("sonstiges");
      expect(result.data.product).toBe("tshirt");
      expect(result.data.style).toBe("cartoon");
      expect(result.summary).toContain("Comicfigur im Disney-Stil");
    }
  });

  it("treats prose-wrapped onboarding data as complete instead of leaking it to chat", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: `Alles klar! Lass mich das kurz zusammenfassen.
{
  "event_type": "sonstiges",
  "group": false,
  "group_size": 1,
  "names": null,
  "date": null,
  "style": "cartoon",
  "product": "tshirt",
  "text_custom": null,
  "photo_upload": false,
  "insider": null,
  "tonality": "witzig"
}
Zusammenfassung: Ein witziges Cartoon-T-Shirt mit einem Vogel, der einen Bio-Apfel isst und Motorrad fährt.`,
          },
        },
      ],
    } as never);

    const result = await runOnboardingMessage(
      [],
      "Nein, habe ich nicht.",
      { productSelection }
    );

    expect(result.complete).toBe(true);
    if (result.complete) {
      expect(result.data.style).toBe("cartoon");
      expect(result.summary).toBe(
        "Ein witziges Cartoon-T-Shirt mit einem Vogel, der einen Bio-Apfel isst und Motorrad fährt."
      );
    }
  });
});
