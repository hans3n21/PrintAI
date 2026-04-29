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
import type { ChatMessage, OnboardingData, ProductSelection } from "@/lib/types";
import { buildCreativeBrief } from "../creativeBrief";

const onboardingData: OnboardingData = {
  event_type: "geburtstag",
  group: false,
  group_size: 1,
  names: ["Hansi"],
  date: null,
  style: "cartoon",
  product: "tshirt",
  text_custom: "Hansi der King",
  photo_upload: false,
  insider: null,
  tonality: "witzig",
};

const productSelection: ProductSelection = {
  product: "tshirt",
  product_color: "black",
  quantity: 1,
};

describe("buildCreativeBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps concrete user motifs from the full conversation as must-include visuals", async () => {
    const history: ChatMessage[] = [
      {
        role: "user",
        content:
          "Ey Kollege ich will ne richtig fette party feiern und mich wie der größte King fühlen. Mein Name ist Hansi. Ick steh uff mopeds, Schweine und Sommer",
      },
      { role: "assistant", content: "Für welchen Anlass brauchst du das Shirt?" },
      { role: "user", content: "Jeburtstag" },
    ];
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              occasion: "geburtstag",
              product: "tshirt",
              style: "cartoon",
              tone: "witzig",
              theme: "Hansi der King als Geburtstagsmotiv",
              exact_text: "Hansi der King",
              must_include_visuals: ["Krone", "Konfetti"],
              avoid: [],
              reference_images: [],
              source_summary: "Geburtstagsshirt für Hansi im Cartoon-Stil.",
            }),
          },
        },
      ],
    } as never);

    const brief = await buildCreativeBrief(history, onboardingData, productSelection, []);

    expect(brief.must_include_visuals).toEqual(
      expect.arrayContaining(["Mopeds", "Schweine", "Sommer"])
    );
  });

  it("instructs the model to preserve team shirt layout wishes without requiring a fixed data model", async () => {
    const history: ChatMessage[] = [
      {
        role: "user",
        content:
          "Ich bin im Verein und möchte fürs ganze Team Shirts. Logo vorne, Sponsor drunter, Name hinten und Nummer auf die Rückseite.",
      },
    ];
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              occasion: "verein",
              product: "tshirt",
              style: "modern",
              tone: "ernst",
              theme: "Teamshirt für den Verein",
              exact_text: null,
              must_include_visuals: [
                "Vereinslogo vorne",
                "Sponsor unter dem Logo",
                "Name hinten",
                "Rückennummer",
              ],
              avoid: [],
              reference_images: [],
              source_summary:
                "Vereinsshirt fürs ganze Team mit Logo vorne, Sponsor darunter, Name hinten und Nummer auf der Rückseite.",
            }),
          },
        },
      ],
    } as never);

    const brief = await buildCreativeBrief(
      history,
      { ...onboardingData, event_type: "verein", group: true, group_size: 12, text_custom: null },
      { ...productSelection, quantity: 12 },
      []
    );
    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const system = call.messages?.[0];
    const content = typeof system?.content === "string" ? system.content : "";

    expect(content).toContain("team or club shirt");
    expect(content).toContain("front/back placement");
    expect(content).toContain("do not invent a fixed editor schema");
    expect(brief.must_include_visuals).toEqual(
      expect.arrayContaining([
        "Vereinslogo vorne",
        "Sponsor unter dem Logo",
        "Name hinten",
        "Rückennummer",
      ])
    );
  });

  it("recovers concrete user scene actions instead of reducing them to object motifs", async () => {
    const history: ChatMessage[] = [
      {
        role: "user",
        content:
          "Mach ein Motiv, wo zwei Leute einen Brokkoli jagen. Dazu die Einweihung des chinesischen Klappstuhls im Aquarell-Stil.",
      },
      { role: "assistant", content: "Alles klar." },
      { role: "user", content: "Genau, die beiden sollen den Brokkoli jagen." },
    ];
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              occasion: "sonstiges",
              product: "tshirt",
              style: "sonstiges",
              tone: "witzig",
              theme: "Aquarell-Brokkoli mit Klappstuhl",
              exact_text: "Einweihung des chinesischen Klappstuhls",
              must_include_visuals: ["Brokkoli", "chinesischer Klappstuhl"],
              avoid: [],
              reference_images: [],
              source_summary:
                "Aquarell-Shirt zur Einweihung des chinesischen Klappstuhls mit Brokkoli-Motiv.",
            }),
          },
        },
      ],
    } as never);

    const brief = await buildCreativeBrief(
      history,
      { ...onboardingData, event_type: "sonstiges", style: "sonstiges" },
      productSelection,
      []
    );
    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const system = call.messages?.[0];
    const content = typeof system?.content === "string" ? system.content : "";

    expect(content).toContain("concrete actions");
    expect(content).toContain("who does what to whom");
    expect(brief.must_include_visuals).toEqual(
      expect.arrayContaining([
        "Zwei Leute einen Brokkoli jagen",
        "Die beiden sollen den Brokkoli jagen",
      ])
    );
  });
});
